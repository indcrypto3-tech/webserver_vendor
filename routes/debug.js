const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendor');
const VendorPresence = require('../models/vendorPresence');

/**
 * Debug endpoint to check vendor and presence data
 * GET /api/debug/vendors-status
 */
router.get('/vendors-status', async (req, res) => {
  try {
    // Get all vendors
    const allVendors = await Vendor.find({}, { vendorName: 1, mobile: 1, fcmTokens: 1 });
    
    // Get all online presences
    const onlinePresences = await VendorPresence.find({ online: true });
    
    // Get vendors with FCM tokens
    const vendorsWithTokens = allVendors.filter(v => v.fcmTokens && v.fcmTokens.length > 0);
    
    // Get online vendors with FCM tokens
    const onlineVendorIds = onlinePresences.map(p => p.vendorId.toString());
    const onlineVendorsWithTokens = vendorsWithTokens.filter(v => 
      onlineVendorIds.includes(v._id.toString())
    );

    res.json({
      summary: {
        totalVendors: allVendors.length,
        vendorsWithFcmTokens: vendorsWithTokens.length,
        onlineVendors: onlinePresences.length,
        onlineVendorsWithTokens: onlineVendorsWithTokens.length
      },
      vendors: allVendors.map(v => ({
        id: v._id,
        name: v.vendorName,
        mobile: v.mobile,
        fcmTokenCount: v.fcmTokens ? v.fcmTokens.length : 0,
        isOnline: onlineVendorIds.includes(v._id.toString())
      })),
      onlinePresences: onlinePresences.map(p => ({
        vendorId: p.vendorId,
        online: p.online,
        lastSeen: p.lastSeen,
        location: p.location
      }))
    });
  } catch (error) {
    console.error('Debug vendors-status error:', error);
    res.status(500).json({
      error: 'Failed to get vendor status',
      message: error.message
    });
  }
});

/**
 * Debug endpoint to check order details
 * GET /api/debug/order/:orderId
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const Order = require('../models/order');
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      order: {
        _id: order._id,
        status: order.status,
        vendorId: order.vendorId,
        customerId: order.customerId,
        pickup: order.pickup,
        drop: order.drop,
        items: order.items,
        fare: order.fare,
        paymentMethod: order.paymentMethod,
        metadata: order.metadata,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error('Debug order error:', error);
    res.status(500).json({
      error: 'Failed to get order details',
      message: error.message
    });
  }
});

module.exports = router;