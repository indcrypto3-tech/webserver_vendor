const { notifyCustomerOrderUpdate } = require('../services/customerWebhookService');
const { info, error } = require('../utils/logger');

/**
 * Order Status Change Middleware
 * 
 * Detects when order status changes and triggers customer webhook notifications.
 * Can be used as Mongoose middleware or as an explicit function call.
 */

/**
 * Mongoose pre-save middleware to capture original status before save
 * Add this to your Order schema with: orderSchema.pre('save', captureOriginalStatus);
 */
function captureOriginalStatus() {
  // Store original status in a temporary property for comparison after save
  if (this.isModified('status') && !this.isNew) {
    this._originalStatus = this.getUpdate ? this.getUpdate().$set?.status : this._original?.status;
  }
}

/**
 * Mongoose post-save middleware to send webhook after status change
 * Add this to your Order schema with: orderSchema.post('save', sendWebhookOnStatusChange);
 */
async function sendWebhookOnStatusChange(doc) {
  // Only send webhook if status was actually changed
  if (doc._originalStatus && doc._originalStatus !== doc.status) {
    try {
      info({ 
        orderId: doc._id, 
        oldStatus: doc._originalStatus, 
        newStatus: doc.status 
      }, 'Order status changed, sending customer webhook');

      const webhookResult = await notifyCustomerOrderUpdate(doc, doc._originalStatus, {
        includeVendorDetails: true
      });

      if (!webhookResult.success) {
        error({ 
          orderId: doc._id, 
          status: doc.status, 
          webhookError: webhookResult.error 
        }, 'Failed to send customer webhook for status change');
      }
    } catch (webhookError) {
      error({ 
        orderId: doc._id, 
        status: doc.status, 
        error: webhookError.message 
      }, 'Error sending customer webhook for status change');
    } finally {
      // Clean up temporary property
      delete doc._originalStatus;
    }
  }
}

/**
 * Mongoose post-findOneAndUpdate middleware to send webhook after status change
 * Add this to your Order schema with: orderSchema.post('findOneAndUpdate', sendWebhookOnFindOneAndUpdate);
 */
async function sendWebhookOnFindOneAndUpdate(doc) {
  if (!doc) return;

  // Get the update operation to check if status was changed
  const update = this.getUpdate();
  if (update.$set && update.$set.status && doc.status !== update.$set.status) {
    try {
      info({ 
        orderId: doc._id, 
        oldStatus: doc.status, 
        newStatus: update.$set.status 
      }, 'Order status updated via findOneAndUpdate, sending customer webhook');

      // Update doc status to new value for webhook
      const updatedDoc = { ...doc.toObject(), status: update.$set.status };
      
      const webhookResult = await notifyCustomerOrderUpdate(updatedDoc, doc.status, {
        includeVendorDetails: true
      });

      if (!webhookResult.success) {
        error({ 
          orderId: doc._id, 
          oldStatus: doc.status,
          newStatus: update.$set.status,
          webhookError: webhookResult.error 
        }, 'Failed to send customer webhook for findOneAndUpdate status change');
      }
    } catch (webhookError) {
      error({ 
        orderId: doc._id, 
        error: webhookError.message 
      }, 'Error sending customer webhook for findOneAndUpdate status change');
    }
  }
}

/**
 * Manual function to trigger webhook for order status change
 * Use this when you need explicit control over when webhooks are sent
 * 
 * @param {Object} order - Order document
 * @param {String} previousStatus - Previous order status
 * @param {Object} options - Webhook options
 * @returns {Promise<Object>} - Webhook result
 */
async function triggerOrderStatusWebhook(order, previousStatus, options = {}) {
  try {
    info({ 
      orderId: order._id, 
      oldStatus: previousStatus, 
      newStatus: order.status 
    }, 'Manually triggering customer webhook for order status change');

    const webhookResult = await notifyCustomerOrderUpdate(order, previousStatus, {
      includeVendorDetails: true,
      ...options
    });

    if (webhookResult.success) {
      info({ 
        orderId: order._id, 
        status: order.status 
      }, 'Customer webhook sent successfully');
    } else {
      error({ 
        orderId: order._id, 
        status: order.status, 
        webhookError: webhookResult.error 
      }, 'Failed to send customer webhook');
    }

    return webhookResult;
  } catch (webhookError) {
    error({ 
      orderId: order._id, 
      status: order.status, 
      error: webhookError.message 
    }, 'Error triggering customer webhook');
    
    return { 
      success: false, 
      error: webhookError.message 
    };
  }
}

/**
 * Batch trigger webhooks for multiple order status changes
 * @param {Array<Object>} orderChanges - Array of { order, previousStatus } objects
 * @param {Object} options - Webhook options
 * @returns {Promise<Object>} - Batch webhook result
 */
async function triggerOrderStatusWebhooksBatch(orderChanges, options = {}) {
  if (!orderChanges || orderChanges.length === 0) {
    return { success: true, results: [], successCount: 0, failureCount: 0 };
  }

  try {
    info({ count: orderChanges.length }, 'Triggering batch customer webhooks for order status changes');

    const { notifyCustomerOrderUpdatesBatch } = require('../services/customerWebhookService');
    const webhookResult = await notifyCustomerOrderUpdatesBatch(orderChanges, {
      includeVendorDetails: true,
      ...options
    });

    if (webhookResult.success) {
      info({ 
        totalOrders: orderChanges.length,
        successCount: webhookResult.successCount 
      }, 'Batch customer webhooks sent successfully');
    } else {
      error({ 
        totalOrders: orderChanges.length,
        successCount: webhookResult.successCount,
        failureCount: webhookResult.failureCount
      }, 'Some batch customer webhooks failed');
    }

    return webhookResult;
  } catch (webhookError) {
    error({ 
      count: orderChanges.length,
      error: webhookError.message 
    }, 'Error triggering batch customer webhooks');
    
    return { 
      success: false, 
      error: webhookError.message,
      results: [],
      successCount: 0,
      failureCount: orderChanges.length
    };
  }
}

/**
 * Utility function to check if webhook should be sent for status change
 * @param {String} oldStatus - Previous status
 * @param {String} newStatus - New status
 * @returns {Boolean} - Whether to send webhook
 */
function shouldSendWebhookForStatusChange(oldStatus, newStatus) {
  // Don't send webhook if status hasn't changed
  if (oldStatus === newStatus) {
    return false;
  }

  // Don't send webhook for initial status setting (no previous status)
  if (!oldStatus && newStatus === 'pending') {
    return false;
  }

  // Send webhook for all other status changes
  return true;
}

module.exports = {
  captureOriginalStatus,
  sendWebhookOnStatusChange,
  sendWebhookOnFindOneAndUpdate,
  triggerOrderStatusWebhook,
  triggerOrderStatusWebhooksBatch,
  shouldSendWebhookForStatusChange
};