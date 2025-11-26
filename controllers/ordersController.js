const { buildBase, info, warn, error } = require('../utils/logger');
const ordersService = require('../services/ordersService');
const notificationService = require('../services/notificationService');
const Order = require('../models/order');

// Helper: normalize order to Flutter shape for list
function mapOrderForList(order) {
  return {
    orderId: order._id.toString(),
    status: order.status === 'in_progress' ? 'started' : order.status,
    fare: order.fare,
    pickup: {
      lat: order.pickup.coordinates[1],
      lng: order.pickup.coordinates[0],
      address: order.pickup.address,
    },
    drop: {
      lat: order.drop.coordinates[1],
      lng: order.drop.coordinates[0],
      address: order.drop.address,
    },
    items: order.items || [],
    customerNameMasked: (order.metadata && order.metadata.customerNameMasked) || null,
    customerPhoneMasked: (order.metadata && order.metadata.customerPhoneMasked) || null,
    scheduledAt: order.scheduledAt ? order.scheduledAt.toISOString() : null,
    createdAt: order.createdAt ? order.createdAt.toISOString() : null,
    updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
  };
}

function normalizePublicOrder(publicOrder) {
  if (!publicOrder) return publicOrder;
  const o = { ...publicOrder };
  if (o.status === 'in_progress') o.status = 'started';
  return o;
}

async function listOrders(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { status, limit = 50, offset = 0 } = req.query;

  info(buildBase({ requestId: rid, route: '/api/orders', method: 'GET', vendorId }), 'Listing orders');

  try {
    const { total, orders } = await ordersService.listOrdersForVendor(vendorId, { status, limit, offset });

    return res.status(200).json({
      ok: true,
      data: orders.map(mapOrderForList),
      meta: { total, limit: parseInt(limit, 10) || 50, offset: parseInt(offset, 10) || 0 },
    });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders', method: 'GET', vendorId }), 'List orders error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

async function getOrder(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;

  info(buildBase({ requestId: rid, route: '/api/orders/:id', method: 'GET', vendorId, orderId }), 'Get order');

  try {
    const order = await ordersService.getOrderForVendor(vendorId, orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    return res.status(200).json({ ok: true, data: normalizePublicOrder(order.toPublicJSON()) });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id', method: 'GET', vendorId, orderId }), 'Get order error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

async function acceptOrder(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;

  info(buildBase({ requestId: rid, route: '/api/orders/:id/accept', method: 'POST', vendorId, orderId }), 'Accept order');

  try {
    // Idempotent: if already accepted by this vendor, return order
    const existing = await Order.findById(orderId);
    if (!existing) return res.status(404).json({ ok: false, error: 'Order not found' });

    // If already accepted, handle idempotency/conflict
    if (existing.status === 'accepted') {
      // If accepted by this vendor and previously accepted via the endpoint (acceptedAt set), treat as idempotent success
      if (existing.vendorId && existing.vendorId.toString() === vendorId.toString()) {
        if (existing.acceptedAt) {
          return res.status(200).json({ ok: true, data: existing.toPublicJSON() });
        }
        // Order marked accepted but missing acceptedAt timestamp — treat as invalid state
        return res.status(400).json({ ok: false, error: `Cannot accept order in ${existing.status} status` });
      }
      if (existing.vendorId) {
        // Accepted by another vendor -> conflict
        return res.status(409).json({ ok: false, error: 'Order already accepted by another vendor' });
      }
      // Accepted but no vendor assigned -> invalid state
      return res.status(400).json({ ok: false, error: `Cannot accept order in ${existing.status} status` });
    }

    let updated = null;

    // If order was explicitly assigned to this vendor, allow accept from 'assigned' -> 'accepted'
    if (existing.status === 'assigned') {
      if (!existing.vendorId || existing.vendorId.toString() !== vendorId.toString()) {
        return res.status(403).json({ ok: false, error: 'Order assigned to another vendor' });
      }

      updated = await Order.findOneAndUpdate(
        { _id: orderId, status: 'assigned', vendorId },
        { $set: { status: 'accepted', acceptedAt: new Date() } },
        { new: true }
      );
      if (!updated) return res.status(409).json({ ok: false, error: 'Order transition conflict' });
    } else if (existing.status === 'pending') {
      // Atomic claim: if order is pending, attempt to claim it
      updated = await ordersService.transitionOrderAtomic(orderId, { status: 'pending' }, { vendorId, status: 'accepted', acceptedAt: new Date(), assignedAt: new Date() });
      if (!updated) {
        // Could be claimed by someone else or not pending
        return res.status(409).json({ ok: false, error: 'Order already claimed or not available' });
      }
    } else {
      // Other statuses are invalid for accepting
      return res.status(400).json({ ok: false, error: `Cannot accept order in ${existing.status} status` });
    }

    // Notify customer (best-effort)
    if (updated.customerId) {
      try {
        await notificationService.notifyCustomerOrderStatusUpdate(updated.customerId, updated, 'accepted');
      } catch (e) {
        warn(buildBase({ requestId: rid, route: '/api/orders/:id/accept', method: 'POST', vendorId, orderId }), `Customer notification failed: ${e.message}`);
      }
    }

    return res.status(200).json({ ok: true, data: normalizePublicOrder(updated.toPublicJSON()) });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/accept', method: 'POST', vendorId, orderId }), 'Accept order error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

async function rejectOrder(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;
  const { reason } = req.body || {};

  info(buildBase({ requestId: rid, route: '/api/orders/:id/reject', method: 'POST', vendorId, orderId }), 'Reject order');

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    // Allow rejection when order is pending or when assigned to this vendor
    if (order.status !== 'pending' && !(order.status === 'assigned' && order.vendorId && order.vendorId.toString() === vendorId.toString())) {
      return res.status(400).json({ ok: false, error: `Cannot reject order in ${order.status} status` });
    }

    const query = { _id: orderId };
    if (order.status === 'pending') query.status = 'pending';
    if (order.status === 'assigned') query.status = 'assigned';

    // If rejecting a pending order, mark as 'rejected'. If rejecting an assigned order, treat as 'cancelled'.
    const newStatus = order.status === 'pending' ? 'rejected' : 'cancelled';

    const updated = await Order.findOneAndUpdate(
      query,
      { $set: { status: newStatus, cancelledAt: new Date(), 'metadata.rejectionReason': reason || 'Rejected by vendor', cancelledBy: 'vendor' } },
      { new: true }
    );

    if (!updated) return res.status(409).json({ ok: false, error: 'Order transition conflict' });

    if (updated.customerId) {
      try { await notificationService.notifyCustomerOrderStatusUpdate(updated.customerId, updated, newStatus); } catch (e) {}
    }

    return res.status(200).json({ ok: true, data: normalizePublicOrder(updated.toPublicJSON()) });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/reject', method: 'POST', vendorId, orderId }), 'Reject order error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

async function startOrder(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;

  info(buildBase({ requestId: rid, route: '/api/orders/:id/start', method: 'POST', vendorId, orderId }), 'Start order');

  try {
    const updated = await ordersService.transitionOrderAtomic(orderId, { status: 'accepted', vendorId }, { status: 'in_progress', assignedAt: new Date(), acceptedAt: new Date() });
    if (!updated) return res.status(400).json({ ok: false, error: 'Invalid transition or not assigned to you' });

    if (updated.customerId) { try { await notificationService.notifyCustomerOrderStatusUpdate(updated.customerId, updated, 'in_progress'); } catch (e) {} }

    return res.status(200).json({ ok: true, data: normalizePublicOrder(updated.toPublicJSON()) });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/start', method: 'POST', vendorId, orderId }), 'Start order error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

async function completeOrder(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;

  info(buildBase({ requestId: rid, route: '/api/orders/:id/complete', method: 'POST', vendorId, orderId }), 'Complete order');

  try {
    const updated = await ordersService.transitionOrderAtomic(orderId, { status: 'in_progress', vendorId }, { status: 'completed', completedAt: new Date() });
    if (!updated) return res.status(400).json({ ok: false, error: 'Invalid transition or not assigned to you' });

    if (updated.customerId) { try { await notificationService.notifyCustomerOrderStatusUpdate(updated.customerId, updated, 'completed'); } catch (e) {} }

    return res.status(200).json({ ok: true, data: normalizePublicOrder(updated.toPublicJSON()) });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/complete', method: 'POST', vendorId, orderId }), 'Complete order error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

async function cancelOrder(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;
  const { reason } = req.body || {};

  info(buildBase({ requestId: rid, route: '/api/orders/:id/cancel', method: 'POST', vendorId, orderId }), 'Cancel order');

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    // Allow cancellation from accepted or in_progress
    if (!['accepted', 'in_progress'].includes(order.status)) {
      return res.status(400).json({ ok: false, error: `Cannot cancel order in ${order.status} status` });
    }

    const updated = await Order.findOneAndUpdate(
      { _id: orderId },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancellationReason: reason || 'Cancelled by vendor', cancelledBy: 'vendor' } },
      { new: true }
    );

    if (updated.customerId) { try { await notificationService.notifyCustomerOrderStatusUpdate(updated.customerId, updated, 'cancelled'); } catch (e) {} }

    return res.status(200).json({ ok: true, data: updated.toPublicJSON() });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/cancel', method: 'POST', vendorId, orderId }), 'Cancel order error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

module.exports = {
  listOrders,
  getOrder,
  acceptOrder,
  rejectOrder,
  startOrder,
  completeOrder,
  cancelOrder,
};
