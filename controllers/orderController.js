const { updateOrderStatus } = require('../services/orderService');

// Lazy load these to avoid circular dependency issues on serverless
let notificationService;
let socketService;

function getNotificationService() {
  if (!notificationService) {
    notificationService = require('../services/notificationService');
  }
  return notificationService;
}

function getSocketService() {
  if (!socketService) {
    socketService = require('../services/socketService');
  }
  return socketService;
}

/**
 * POST /api/orders/:id/accept
 * Accept an order assigned to authenticated vendor
 */
async function acceptOrder(req, res) {
  try {
    const { id } = req.params;
    const vendor = req.user; // Set by authenticate middleware

    // Get order and verify it's assigned to this vendor
    const Order = require('../models/order');
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'Order not found',
      });
    }

    if (!order.vendorId || order.vendorId.toString() !== vendor._id.toString()) {
      return res.status(403).json({
        ok: false,
        error: 'Order not assigned to you',
      });
    }

    if (order.status !== 'assigned') {
      return res.status(400).json({
        ok: false,
        error: `Cannot accept order in ${order.status} status`,
      });
    }

    // Update order status
    const updatedOrder = await updateOrderStatus(id, 'accepted');

    // Send notifications
    const { notifyVendorOrderStatusUpdate, notifyCustomerOrderStatusUpdate } = getNotificationService();
    await notifyVendorOrderStatusUpdate(vendor._id, updatedOrder, 'accepted');
    if (updatedOrder.customerId) {
      await notifyCustomerOrderStatusUpdate(updatedOrder.customerId, updatedOrder, 'accepted');
    }

    // Emit socket event
    const { emitOrderStatusUpdate } = getSocketService();
    emitOrderStatusUpdate(vendor._id, updatedOrder, 'accepted');

    return res.status(200).json({
      ok: true,
      message: 'Order accepted successfully',
      data: updatedOrder.toPublicJSON ? updatedOrder.toPublicJSON() : updatedOrder,
    });
  } catch (error) {
    console.error('Accept order error:', error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Server error occurred',
    });
  }
}

/**
 * POST /api/orders/:id/reject
 * Reject an order assigned to authenticated vendor
 */
async function rejectOrder(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const vendor = req.user; // Set by authenticate middleware

    // Get order and verify it's assigned to this vendor
    const Order = require('../models/order');
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'Order not found',
      });
    }

    if (!order.vendorId || order.vendorId.toString() !== vendor._id.toString()) {
      return res.status(403).json({
        ok: false,
        error: 'Order not assigned to you',
      });
    }

    if (order.status !== 'assigned') {
      return res.status(400).json({
        ok: false,
        error: `Cannot reject order in ${order.status} status`,
      });
    }

    // Update order status to cancelled with rejection reason
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.metadata = {
      ...order.metadata,
      rejectionReason: reason || 'Rejected by vendor',
      rejectedBy: vendor._id,
    };
    await order.save();

    // Send notifications
    const { notifyVendorOrderStatusUpdate, notifyCustomerOrderStatusUpdate } = getNotificationService();
    await notifyVendorOrderStatusUpdate(vendor._id, order, 'cancelled');
    if (order.customerId) {
      await notifyCustomerOrderStatusUpdate(order.customerId, order, 'cancelled');
    }

    // Emit socket event
    const { emitOrderStatusUpdate } = getSocketService();
    emitOrderStatusUpdate(vendor._id, order, 'cancelled');

    return res.status(200).json({
      ok: true,
      message: 'Order rejected successfully',
      data: order.toPublicJSON ? order.toPublicJSON() : order,
    });
  } catch (error) {
    console.error('Reject order error:', error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Server error occurred',
    });
  }
}

/**
 * GET /api/orders/:id
 * Get order details
 */
async function getOrder(req, res) {
  try {
    const { id } = req.params;
    const vendor = req.user; // Set by authenticate middleware

    const Order = require('../models/order');
    const order = await Order.findById(id).populate('vendorId');

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'Order not found',
      });
    }

    // Verify vendor has access to this order
    if (order.vendorId && order.vendorId._id.toString() !== vendor._id.toString()) {
      return res.status(403).json({
        ok: false,
        error: 'Access denied',
      });
    }

    return res.status(200).json({
      ok: true,
      data: order.toPublicJSON ? order.toPublicJSON() : order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Server error occurred',
    });
  }
}

module.exports = {
  acceptOrder,
  rejectOrder,
  getOrder,
};
