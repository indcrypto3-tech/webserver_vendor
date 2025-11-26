const Vendor = require('../models/vendor');


/**
 * Send push notification to vendor
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} notification - Notification payload { title, body, image? }
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} - { success: boolean, successCount?: number, failureCount?: number, error?: string }
 */
async function sendPushToVendor(vendorId, notification, data = {}) {
  try {
    // Require lazily so tests can mock ../config/firebase before this runs
    const { getMessaging } = require('../config/firebase');
    const messaging = getMessaging && getMessaging();
    if (!messaging) {
      console.log('⚠️  Firebase not configured, skipping push notification');
      return { success: false, error: 'Firebase not configured' };
    }

    // Get vendor's FCM tokens
    const vendor = await Vendor.findById(vendorId).select('fcmTokens');
    if (!vendor || !vendor.fcmTokens || vendor.fcmTokens.length === 0) {
      console.log(`⚠️  No FCM tokens found for vendor ${vendorId}`);
      return { success: false, error: 'No FCM tokens registered' };
    }

    // Get all valid tokens (limit to 500 per FCM requirement)
    const tokens = vendor.fcmTokens.map(t => t.token).slice(0, 500);

    console.log('📤 Sending FCM notification:', {
      vendorId,
      tokenCount: tokens.length,
      notification: notification,
      data: data
    });

    // Prepare message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.image || undefined,
      },
      data: {
        ...data,
        clickAction: data.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      tokens, // Send to all registered devices
    };

    console.log('📨 FCM Message payload:', JSON.stringify(message, null, 2));

    // Send notification using whichever multicast API the SDK/mock exposes
    const sendFn = messaging.sendMulticast || messaging.sendEachForMulticast || messaging.sendEachForMulticastAsync || messaging.sendAll || messaging.send;
    if (!sendFn) {
      console.log('⚠️  Messaging send function not available on mocked messaging object');
      return { success: false, error: 'Messaging API not available' };
    }

    const response = await sendFn.call(messaging, message);

    console.log(`✅ Push notification sent successfully: ${response.successCount}/${tokens.length} delivered`);

    // Handle failed tokens (expired/invalid)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.log(`❌ Failed to send to token ${idx}: ${resp.error?.code} - ${resp.error?.message}`);
        }
      });

      // Remove invalid tokens
      await removeInvalidTokens(vendorId, failedTokens);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    console.error('Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Send new order notification to vendor
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} order - Order document
 * @returns {Promise<Object>} - Push send result
 */
async function notifyVendorNewOrder(vendorId, order) {
  const notification = {
    title: '🔔 New Order Assigned!',
    body: `Order #${order._id.toString().slice(-6)} - ₹${order.fare}\nPickup: ${order.pickup.address}`,
  };

  const data = {
    type: 'new_order',
    orderId: order._id.toString(),
    fare: order.fare.toString(),
    pickupLat: order.pickup.coordinates[1].toString(),
    pickupLng: order.pickup.coordinates[0].toString(),
    dropLat: order.drop.coordinates[1].toString(),
    dropLng: order.drop.coordinates[0].toString(),
  };

  return await sendPushToVendor(vendorId, notification, data);
}

/**
 * Send order status update notification to vendor
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} order - Order document
 * @param {String} status - New status
 * @returns {Promise<Object>} - Push send result
 */
async function notifyVendorOrderStatusUpdate(vendorId, order, status) {
  const statusMessages = {
    accepted: '✅ Order Accepted',
    in_progress: '🚗 Order In Progress',
    completed: '✅ Order Completed',
    cancelled: '❌ Order Cancelled',
  };

  const notification = {
    title: statusMessages[status] || 'Order Update',
    body: `Order #${order._id.toString().slice(-6)} status updated`,
  };

  const data = {
    type: 'order_status_update',
    orderId: order._id.toString(),
    status,
  };

  return await sendPushToVendor(vendorId, notification, data);
}

/**
 * Send order status update notification to customer (placeholder)
 * @param {String} customerId - Customer ID
 * @param {Object} order - Order document
 * @param {String} status - New status
 * @returns {Promise<Object>} - Push send result
 */
async function notifyCustomerOrderStatusUpdate(customerId, order, status) {
  // TODO: Implement customer push notifications when customer model/FCM tokens are available
  console.log(`📧 Would notify customer ${customerId} about order ${order._id} status: ${status}`);
  return { success: true, message: 'Customer notifications not implemented yet' };
}

/**
 * Remove invalid/expired FCM tokens from vendor document
 * @param {String} vendorId - Vendor ObjectId
 * @param {Array<String>} tokens - Array of invalid tokens to remove
 */
async function removeInvalidTokens(vendorId, tokens) {
  try {
    await Vendor.updateOne(
      { _id: vendorId },
      { $pull: { fcmTokens: { token: { $in: tokens } } } }
    );
    console.log(`🗑️  Removed ${tokens.length} invalid tokens for vendor ${vendorId}`);
  } catch (error) {
    console.error('Error removing invalid tokens:', error);
  }
}

module.exports = {
  sendPushToVendor,
  notifyVendorNewOrder,
  notifyVendorOrderStatusUpdate,
  notifyCustomerOrderStatusUpdate,
  removeInvalidTokens,
};
