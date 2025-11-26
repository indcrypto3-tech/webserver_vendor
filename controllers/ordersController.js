const { buildBase, info, warn, error } = require('../utils/logger');
const ordersService = require('../services/ordersService');
const notificationService = require('../services/notificationService');
const Order = require('../models/order');
const { createPaymentRequest, confirmPaymentRequest, validateAmount } = require('../utils/payment');
const { generateOTP, createOTP, verifyOTP, isOTPExpired, hasTooManyAttempts } = require('../utils/otpHelper');

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

/**
 * POST /api/orders/:orderId/payment-request
 * Create a payment request for an order
 */
async function paymentRequest(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;
  const { amount, currency = 'INR', autoConfirm = false } = req.body;

  info(buildBase({ requestId: rid, route: '/api/orders/:id/payment-request', method: 'POST', vendorId, orderId }), 'Payment request');

  try {
    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'order_not_found', message: 'Order not found' });
    }

    // If client didn't provide `amount`, use the canonical order fare so vendors
    // can update the order fare first and then create a payment request.
    const finalAmount = (amount === undefined || amount === null) ? order.fare : amount;

    // Validate amount (either provided or derived from order.fare)
    if (!validateAmount(finalAmount)) {
      return res.status(400).json({ ok: false, error: 'invalid_amount', message: 'Amount must be a positive number' });
    }

    // Create payment request using the final resolved amount (notes are not used per new workflow)
    const paymentReq = createPaymentRequest({ amount: finalAmount, currency });

    // If autoConfirm is enabled (dev/test mode)
    if (autoConfirm) {
      const confirmedPaymentReq = confirmPaymentRequest(paymentReq);

      // Atomically add confirmed payment request and update status
      const updated = await Order.findByIdAndUpdate(
        orderId,
        {
          $push: { paymentRequests: confirmedPaymentReq },
          $set: { status: 'payment_confirmed' },
        },
        { new: true }
      );

      // Send FCM to vendor
      if (updated.vendorId) {
        try {
          await notificationService.sendPushToVendor(updated.vendorId, {
            title: 'Payment Confirmed',
            body: `Payment request ${confirmedPaymentReq.id} auto-confirmed for order ${orderId}`,
            data: {
              orderId: orderId.toString(),
              paymentRequestId: confirmedPaymentReq.id,
              status: 'payment_confirmed',
              amount: confirmedPaymentReq.amount.toString(),
            },
          });
        } catch (err) {
          warn(buildBase({ requestId: rid, vendorId, orderId }), 'Failed to send FCM for auto-confirmed payment', err.message);
        }
      }

      info(buildBase({ requestId: rid, vendorId, orderId, paymentRequestId: confirmedPaymentReq.id }), 'Payment auto-confirmed');

      return res.status(200).json({
        ok: true,
        paymentRequestId: confirmedPaymentReq.id,
        autoConfirmed: true,
        paymentRequest: confirmedPaymentReq,
      });
    }

    // Normal flow: add payment request and update status to payment_requested
    const updated = await Order.findByIdAndUpdate(
      orderId,
      {
        $push: { paymentRequests: paymentReq },
        $set: { status: 'payment_requested' },
      },
      { new: true }
    );

    info(buildBase({ requestId: rid, vendorId, orderId, paymentRequestId: paymentReq.id }), 'Payment request created');

    return res.status(200).json({
      ok: true,
      paymentRequestId: paymentReq.id,
    });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/payment-request', method: 'POST', vendorId, orderId }), 'Payment request error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

// PATCH /api/orders/:orderId/payment-requests/:paymentRequestId removed
// Per the new workflow vendors should update order fare via PATCH /api/orders/:orderId/fare
// and then create a payment request. Editing a payment request after creation is deprecated.

/**
 * PATCH /api/orders/:orderId/fare
 * Allow vendor to update order fare before creating a payment request
 */
async function updateFare(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;
  const { amount } = req.body || {};

  info(buildBase({ requestId: rid, route: '/api/orders/:id/fare', method: 'PATCH', vendorId, orderId }), 'Update order fare');

  try {
    if (amount === undefined) {
      return res.status(400).json({ ok: false, error: 'missing_amount', message: 'Amount is required' });
    }

    if (!validateAmount(amount)) {
      return res.status(400).json({ ok: false, error: 'invalid_amount', message: 'Amount must be a positive number' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'order_not_found', message: 'Order not found' });

    // Only disallow updating fare when order is paid. other statuses are allowed.
    if (order.status === 'paid') {
      return res.status(400).json({ ok: false, error: 'cannot_modify_fare', message: `Cannot modify fare when order status is ${order.status}` });
    }

    // If order has a vendor assigned, only that vendor may update fare
    if (order.vendorId && vendorId && order.vendorId.toString() !== vendorId.toString()) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'Not authorized to modify fare for this order' });
    }

    const updated = await Order.findByIdAndUpdate(orderId, { $set: { fare: amount } }, { new: true });

    info(buildBase({ requestId: rid, vendorId, orderId }), `Order fare updated to ${amount}`);

    return res.status(200).json({ ok: true, fare: updated.fare });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/fare', method: 'PATCH', vendorId, orderId }), 'Update fare error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

/**
 * POST /api/orders/:orderId/request-otp
 * Generate and send OTP for arrival or completion verification
 */
async function requestOTP(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;
  const { purpose = 'arrival', ttlSeconds = 300 } = req.body;

  info(buildBase({ requestId: rid, route: '/api/orders/:id/request-otp', method: 'POST', vendorId, orderId, purpose }), 'Request OTP');

  try {
    // Validate purpose
    if (!['arrival', 'completion'].includes(purpose)) {
      return res.status(400).json({ ok: false, error: 'invalid_purpose', message: 'Purpose must be "arrival" or "completion"' });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'order_not_found', message: 'Order not found' });
    }

    // Check if previous OTP exists and is still valid (and not already verified)
    // Allow override if verified or expired
    if (order.otp && order.otp.otpId && !isOTPExpired(order.otp) && !order.otp.verified) {
      // Allow requesting a new OTP with different purpose (overrides existing)
      // Only block if same purpose
      if (order.otp.purpose === purpose) {
        return res.status(429).json({
          ok: false,
          error: 'otp_already_sent',
          message: 'An OTP is already active for this order',
          expiresAt: order.otp.expiresAt,
        });
      }
    }

    // Generate OTP
    const otpCode = generateOTP();
    const otpObject = await createOTP({ code: otpCode, purpose, ttlSeconds });

    // Save OTP to order
    await Order.findByIdAndUpdate(orderId, { $set: { otp: otpObject } });

    // Log OTP for development/debugging (always log regardless of sending status)
    info(buildBase({ requestId: rid, vendorId, orderId, otpId: otpObject.otpId, purpose }), `OTP generated: ${otpCode} (expires: ${otpObject.expiresAt})`);

    // Send OTP (FCM fallback since SMS not configured)
    let sent = false;
    if (order.customerId) {
      try {
        // In production, this would send SMS. For now, use FCM as fallback
        await notificationService.notifyCustomerOrderStatusUpdate(order.customerId, order, 'otp_sent', {
          otpCode: process.env.NODE_ENV === 'production' ? undefined : otpCode, // Don't send in prod
          purpose,
          expiresAt: otpObject.expiresAt,
        });
        sent = true;
        info(buildBase({ requestId: rid, vendorId, orderId, customerId: order.customerId }), `OTP sent to customer via FCM`);
      } catch (err) {
        warn(buildBase({ requestId: rid, vendorId, orderId }), 'Failed to send OTP notification to customer', err.message);
      }
    } else {
      warn(buildBase({ requestId: rid, vendorId, orderId }), 'No customerId found - OTP not sent to customer');
    }

    info(buildBase({ requestId: rid, vendorId, orderId, otpId: otpObject.otpId, purpose }), 'OTP created');

    // In non-production, return OTP code for dev/test automation
    const response = {
      ok: true,
      otpId: otpObject.otpId,
      sent,
    };

    if (process.env.NODE_ENV !== 'production') {
      response.devCode = otpCode;
    }

    return res.status(200).json(response);
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/request-otp', method: 'POST', vendorId, orderId }), 'Request OTP error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
}

/**
 * POST /api/orders/:orderId/verify-otp
 * Verify OTP and update order status accordingly
 */
async function verifyOTPEndpoint(req, res) {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { orderId } = req.params;
  const { otp, purpose } = req.body;

  info(buildBase({ requestId: rid, route: '/api/orders/:id/verify-otp', method: 'POST', vendorId, orderId, purpose }), 'Verify OTP');

  try {
    // Validate input
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ ok: false, error: 'invalid_otp', message: 'OTP is required' });
    }

    if (!purpose || !['arrival', 'completion'].includes(purpose)) {
      return res.status(400).json({ ok: false, error: 'invalid_purpose', message: 'Purpose must be "arrival" or "completion"' });
    }

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'order_not_found', message: 'Order not found' });
    }

    // Check if OTP exists
    if (!order.otp || !order.otp.otpId || !order.otp.codeHash) {
      return res.status(400).json({ ok: false, error: 'no_otp', message: 'No OTP found for this order' });
    }

    // Check if purpose matches
    if (order.otp.purpose !== purpose) {
      return res.status(400).json({ ok: false, error: 'purpose_mismatch', message: `OTP purpose is ${order.otp.purpose}, not ${purpose}` });
    }

    // Check if expired
    if (isOTPExpired(order.otp)) {
      return res.status(410).json({ ok: false, error: 'otp_expired', message: 'OTP has expired' });
    }

    // Check if too many attempts
    if (hasTooManyAttempts(order.otp, 5)) {
      return res.status(429).json({ ok: false, error: 'too_many_attempts', message: 'Too many failed attempts' });
    }

    // Verify OTP
    const isValid = await verifyOTP(otp, order.otp.codeHash);

    if (!isValid) {
      // Increment attempts
      await Order.findByIdAndUpdate(orderId, { $inc: { 'otp.attempts': 1 } });

      warn(buildBase({ requestId: rid, vendorId, orderId }), 'Invalid OTP attempt');

      return res.status(401).json({ ok: false, error: 'invalid_otp', message: 'Invalid OTP code' });
    }

    // OTP is valid - update order status based on purpose
    let newStatus;
    switch (purpose) {
      case 'arrival':
        newStatus = 'arrival_confirmed';
        break;
      case 'completion':
        newStatus = 'completed';
        break;
      default:
        newStatus = 'in_progress';
    }

    const updated = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          'otp.verified': true,
          status: newStatus,
          ...(newStatus === 'completed' && { completedAt: new Date() }),
        },
      },
      { new: true }
    );

    // Send FCM to vendor
    if (updated.vendorId) {
      try {
        await notificationService.sendPushToVendor(updated.vendorId, {
          title: 'OTP Verified',
          body: `Order ${orderId} status updated to ${newStatus}`,
          data: {
            orderId: orderId.toString(),
            status: newStatus,
            purpose,
          },
        });
      } catch (err) {
        warn(buildBase({ requestId: rid, vendorId, orderId }), 'Failed to send FCM for OTP verification', err.message);
      }
    }

    info(buildBase({ requestId: rid, vendorId, orderId, newStatus }), 'OTP verified successfully');

    return res.status(200).json({
      ok: true,
      verified: true,
      status: newStatus,
    });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/orders/:id/verify-otp', method: 'POST', vendorId, orderId }), 'Verify OTP error', err.stack);
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
  paymentRequest,
  requestOTP,
  verifyOTPEndpoint,
  updateFare,
};
