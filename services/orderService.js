const Order = require('../models/order');
const Vendor = require('../models/vendor');
const VendorPresence = require('../models/vendorPresence');
const { notifyVendorNewOrder } = require('./notificationService');
const socketService = require('./socketService');
// Socket.IO disabled for serverless - using FCM for real-time notifications
// const { emitNewOrderToVendor } = require('./socketService');

/**
 * Validate order creation payload
 * @param {Object} data - Order data
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateOrderData(data) {
  const errors = [];

  // Validate pickup location
  if (!data.pickup) {
    errors.push('pickup location is required');
  } else {
    if (typeof data.pickup.lat !== 'number' || data.pickup.lat < -90 || data.pickup.lat > 90) {
      errors.push('pickup.lat must be a number between -90 and 90');
    }
    if (typeof data.pickup.lng !== 'number' || data.pickup.lng < -180 || data.pickup.lng > 180) {
      errors.push('pickup.lng must be a number between -180 and 180');
    }
    if (!data.pickup.address || typeof data.pickup.address !== 'string' || data.pickup.address.trim() === '') {
      errors.push('pickup.address is required');
    }
  }

  // Validate drop location
  if (!data.drop) {
    errors.push('drop location is required');
  } else {
    if (typeof data.drop.lat !== 'number' || data.drop.lat < -90 || data.drop.lat > 90) {
      errors.push('drop.lat must be a number between -90 and 90');
    }
    if (typeof data.drop.lng !== 'number' || data.drop.lng < -180 || data.drop.lng > 180) {
      errors.push('drop.lng must be a number between -180 and 180');
    }
    if (!data.drop.address || typeof data.drop.address !== 'string' || data.drop.address.trim() === '') {
      errors.push('drop.address is required');
    }
  }

  // Validate items
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push('items must be a non-empty array');
  } else {
    data.items.forEach((item, index) => {
      if (!item.title || typeof item.title !== 'string' || item.title.trim() === '') {
        errors.push(`items[${index}].title is required`);
      }
      if (typeof item.qty !== 'number' || item.qty < 1) {
        errors.push(`items[${index}].qty must be a number >= 1`);
      }
      if (typeof item.price !== 'number' || item.price < 0) {
        errors.push(`items[${index}].price must be a number >= 0`);
      }
    });
  }

  // Validate fare
  if (typeof data.fare !== 'number' || data.fare < 0) {
    errors.push('fare must be a number >= 0');
  }

  // Validate payment method
  if (!data.paymentMethod || !['cod', 'online', 'wallet'].includes(data.paymentMethod)) {
    errors.push('paymentMethod must be one of: cod, online, wallet');
  }

  // Validate scheduledAt if provided
  if (data.scheduledAt) {
    const scheduledDate = new Date(data.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      errors.push('scheduledAt must be a valid ISO-8601 date string');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Find nearby online vendors using vendor presence data
 * @param {Object} location - { lat, lng }
 * @param {Number} maxDistanceMeters - Maximum distance in meters
 * @returns {Promise<Array>} - Array of vendor IDs
 */
async function findNearbyOnlineVendors(location, maxDistanceMeters = 10000) {
  try {
    console.log(`🔍 [TEST MODE] Finding ALL online vendors (ignoring location)`);
    
    // TESTING: Get ALL online vendors regardless of location
    const allOnlinePresences = await VendorPresence.find({ online: true }).limit(10);
    
    console.log(`✅ Found ${allOnlinePresences.length} online vendors`);
    allOnlinePresences.forEach(p => {
      console.log(`   - Vendor ${p.vendorId} at [${p.loc?.coordinates}]`);
    });

    return allOnlinePresences.map(p => p.vendorId);
  } catch (error) {
    console.error('❌ Error finding online vendors:', error);
    console.error('Error details:', error.message);
    return [];
  }
}

/**
 * Broadcast order to all online vendors
 * Sends push notifications to ALL online vendors
 * Order status remains 'pending' until a vendor accepts
 * @param {Object} order - Order document
 * @returns {Promise<Object>} - Result with notification stats
 */
async function broadcastOrderToVendors(order) {
  try {
    // Find all online vendors
    const onlineVendorIds = await findNearbyOnlineVendors({
      lat: order.pickup.coordinates[1],
      lng: order.pickup.coordinates[0],
    });

    if (onlineVendorIds.length === 0) {
      console.log('No online vendors found to broadcast');
      return { success: false, notifiedCount: 0 };
    }

    console.log(`📢 Broadcasting order ${order._id} to ${onlineVendorIds.length} online vendors`);

    // Send push notification to ALL online vendors
    let successCount = 0;
    let failureCount = 0;

    for (const vendorId of onlineVendorIds) {
      try {
        const result = await notifyVendorNewOrder(vendorId, order);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        console.error(`Failed to notify vendor ${vendorId}:`, error.message);
        failureCount++;
      }
    }

    console.log(`✅ Broadcast complete: ${successCount} sent, ${failureCount} failed`);

    return { 
      success: true, 
      notifiedCount: successCount,
      failedCount: failureCount,
      totalVendors: onlineVendorIds.length
    };
  } catch (error) {
    console.error('Error broadcasting to vendors:', error);
    return { success: false, notifiedCount: 0 };
  }
}

/**
 * Assign a vendor to an order (DEPRECATED - use broadcastOrderToVendors instead)
 * This is kept for backward compatibility
 */
async function assignVendorToOrder(order) {
  try {
    // New behavior: Broadcast to all online vendors instead of assigning to one
    return await broadcastOrderToVendors(order);
  } catch (error) {
    console.error('Error in assignVendorToOrder:', error);
    return null;
  }
}

/**
 * Create a new order
 * Main order creation logic used by both production and dev endpoints
 * @param {Object} data - Order creation data
 * @returns {Promise<Object>} - Created order document
 */
async function createOrder(data) {
  // Validate input
  const validation = validateOrderData(data);
  if (!validation.valid) {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.details = validation.errors;
    throw error;
  }

  // Build order document
  const orderData = {
    customerId: data.customerId || null,
    vendorId: data.vendorId || null,
    pickup: {
      type: 'Point',
      coordinates: [data.pickup.lng, data.pickup.lat],
      address: data.pickup.address.trim(),
    },
    drop: {
      type: 'Point',
      coordinates: [data.drop.lng, data.drop.lat],
      address: data.drop.address.trim(),
    },
    items: data.items.map(item => ({
      title: item.title.trim(),
      qty: item.qty,
      price: item.price,
    })),
    fare: data.fare,
    paymentMethod: data.paymentMethod,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    customerNotes: data.customerNotes || '',
    metadata: data.metadata || {},
  };

  // Create order
  const order = await Order.create(orderData);

  // Auto-assign vendor if requested and no specific vendor provided
  if (data.autoAssignVendor && !data.vendorId) {
    // In test or mock mode, pick the first online vendor (deterministic for tests)
    if (process.env.ENABLE_MOCK_ORDERS === 'true' || process.env.NODE_ENV === 'test') {
      const onlineVendorIds = await findNearbyOnlineVendors({ lat: order.pickup.coordinates[1], lng: order.pickup.coordinates[0] });
      if (onlineVendorIds.length > 0) {
        // Prefer vendors that have an active Socket.IO connection when possible
        let assignedVendorId = onlineVendorIds[0];
        try {
          const socketServiceLocal = require('./socketService');
          const onlineConnected = onlineVendorIds.filter(id => socketServiceLocal.isVendorOnline && socketServiceLocal.isVendorOnline(id));
          if (onlineConnected && onlineConnected.length > 0) {
            assignedVendorId = onlineConnected[0];
          }
        } catch (e) {
          // ignore - socket service might not be initialized in some environments
        }
        order.vendorId = assignedVendorId;
        order.status = 'assigned';
        order.assignedAt = new Date();
        await order.save();

        // Notify the chosen vendor (push) and emit Socket.IO event if available
        try {
          await notifyVendorNewOrder(assignedVendorId, order);
        } catch (e) {
          console.warn('Notify vendor failed during auto-assign', e.message);
        }

        try {
          // Emit socket event to vendor if Socket.IO initialized
          if (socketService && socketService.emitNewOrderToVendor) {
            socketService.emitNewOrderToVendor(assignedVendorId, order);
          }
        } catch (e) {
          console.warn('Emit socket event failed during auto-assign', e.message);
        }
      } else {
        // No online vendors: broadcast (keeps pending)
        const broadcastResult = await broadcastOrderToVendors(order);
        console.log(`📢 Order broadcast result:`, broadcastResult);
      }

      // Reload order to get latest data
      await order.populate('vendorId');
    } else {
      // Production behavior: Broadcast to all online vendors (order stays in 'pending')
      const broadcastResult = await broadcastOrderToVendors(order);
      console.log(`📢 Order broadcast result:`, broadcastResult);
      await order.populate('vendorId');
    }
  } else if (data.vendorId) {
    // Verify vendor exists and update order status
    const vendor = await Vendor.findById(data.vendorId);
    if (!vendor) {
      const error = new Error('Vendor not found');
      error.statusCode = 404;
      throw error;
    }
    order.vendorId = data.vendorId;
    order.status = 'assigned';
    order.assignedAt = new Date();
    await order.save();
    
    // Send notifications for explicitly assigned orders
    await notifyVendorNewOrder(data.vendorId, order);
    // Socket.IO disabled for serverless
    // emitNewOrderToVendor(data.vendorId, order);
    
    // Reload order to get updated data
    await order.populate('vendorId');
  }

  return order;
}

/**
 * Get order by ID
 * @param {String} orderId - Order ID
 * @returns {Promise<Object|null>} - Order document or null
 */
async function getOrderById(orderId) {
  try {
    return await Order.findById(orderId).populate('vendorId');
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
}

/**
 * Update order status
 * @param {String} orderId - Order ID
 * @param {String} status - New status
 * @returns {Promise<Object>} - Updated order document
 */
async function updateOrderStatus(orderId, status) {
  const order = await Order.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  order.status = status;

  // Update timestamps based on status
  switch (status) {
    case 'accepted':
      order.acceptedAt = new Date();
      break;
    case 'completed':
      order.completedAt = new Date();
      break;
    case 'cancelled':
      order.cancelledAt = new Date();
      break;
  }

  await order.save();

  // TODO: In production, trigger status change notifications

  return order;
}

module.exports = {
  createOrder,
  getOrderById,
  updateOrderStatus,
  assignVendorToOrder,
  findNearbyOnlineVendors,
  validateOrderData,
};
