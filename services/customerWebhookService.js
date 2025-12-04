const axios = require('axios');
const config = require('../config');
const { info, warn, error } = require('../utils/logger');

/**
 * Customer Webhook Service
 * 
 * Sends HTTP callbacks to customer server when order status changes.
 * Includes retry logic and proper error handling.
 */

/**
 * Send order status update to customer server webhook
 * @param {Object} order - Order document from MongoDB
 * @param {String} previousStatus - Previous order status (optional)
 * @param {Object} options - Additional options { retries: number, timeout: number }
 * @returns {Promise<Object>} - { success: boolean, response?: Object, error?: string }
 */
async function notifyCustomerOrderUpdate(order, previousStatus = null, options = {}) {
  const { 
    retries = 3, 
    timeout = 10000, // 10 seconds
    includeVendorDetails = false 
  } = options;

  // Check if webhook URL is configured
  if (!config.customerWebhookUrl) {
    info({ orderId: order._id }, 'Customer webhook URL not configured, skipping notification');
    return { success: false, error: 'Webhook URL not configured' };
  }

  // Prepare webhook payload
  const payload = {
    orderId: order._id.toString(),
    customerId: order.customerId,
    status: order.status,
    previousStatus,
    updatedAt: new Date().toISOString(),
    orderData: {
      fare: order.fare,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      pickup: {
        address: order.pickup.address,
        coordinates: order.pickup.coordinates
      },
      drop: {
        address: order.drop.address,
        coordinates: order.drop.coordinates
      },
      items: order.items,
      customerNotes: order.customerNotes,
      vendorNotes: order.vendorNotes,
      scheduledAt: order.scheduledAt,
      assignedAt: order.assignedAt,
      acceptedAt: order.acceptedAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      cancelledBy: order.cancelledBy,
      createdAt: order.createdAt,
      metadata: order.metadata || {}
    }
  };

  // Include vendor details if requested and available
  if (includeVendorDetails && order.vendorId) {
    try {
      const Vendor = require('../models/vendor');
      const vendor = await Vendor.findById(order.vendorId).select('vendorName mobile businessAddress selectedServices');
      if (vendor) {
        payload.vendorDetails = {
          vendorId: vendor._id.toString(),
          vendorName: vendor.vendorName,
          mobile: vendor.mobile,
          businessAddress: vendor.businessAddress,
          selectedServices: vendor.selectedServices
        };
      }
    } catch (vendorError) {
      warn({ orderId: order._id, error: vendorError.message }, 'Failed to fetch vendor details for webhook');
    }
  }

  // Prepare request configuration
  const requestConfig = {
    method: 'POST',
    url: config.customerWebhookUrl,
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-server-secret': config.customerServerSecret,
      'x-webhook-event': 'order.status_changed',
      'x-webhook-timestamp': new Date().toISOString(),
      'x-webhook-order-id': order._id.toString(),
      'User-Agent': 'VendorServer-Webhook/1.0'
    },
    data: payload,
    timeout,
    validateStatus: (status) => status >= 200 && status < 300
  };

  // Attempt to send webhook with retry logic
  let lastError = null;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      info({ 
        orderId: order._id, 
        status: order.status, 
        previousStatus,
        attempt,
        webhookUrl: config.customerWebhookUrl
      }, 'Sending order status webhook to customer server');

      const response = await axios(requestConfig);
      
      info({ 
        orderId: order._id, 
        status: order.status,
        responseStatus: response.status,
        responseData: response.data,
        attempt 
      }, 'Customer webhook sent successfully');

      return {
        success: true,
        response: {
          status: response.status,
          data: response.data,
          headers: response.headers
        },
        attempts: attempt
      };

    } catch (requestError) {
      lastError = requestError;
      
      const errorDetails = {
        orderId: order._id,
        status: order.status,
        attempt,
        maxRetries: retries + 1,
        error: requestError.message,
        webhookUrl: config.customerWebhookUrl
      };

      if (requestError.response) {
        // Server responded with error status
        errorDetails.responseStatus = requestError.response.status;
        errorDetails.responseData = requestError.response.data;
        
        // Don't retry for 4xx client errors (except 408, 429)
        if (requestError.response.status >= 400 && requestError.response.status < 500 && 
            ![408, 429].includes(requestError.response.status)) {
          error(errorDetails, 'Customer webhook failed with client error (no retry)');
          break;
        }
      } else if (requestError.code === 'ECONNREFUSED' || requestError.code === 'ETIMEDOUT') {
        errorDetails.connectionError = true;
      }

      if (attempt === retries + 1) {
        error(errorDetails, 'Customer webhook failed after all retries');
      } else {
        warn(errorDetails, `Customer webhook failed, retrying in ${attempt * 1000}ms`);
        
        // Exponential backoff: wait longer between retries
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message : 'Unknown error',
    attempts: retries + 1,
    lastError: lastError ? {
      message: lastError.message,
      code: lastError.code,
      response: lastError.response ? {
        status: lastError.response.status,
        data: lastError.response.data
      } : null
    } : null
  };
}

/**
 * Send batch order status updates to customer server
 * @param {Array<Object>} orderUpdates - Array of { order, previousStatus } objects
 * @param {Object} options - Webhook options
 * @returns {Promise<Object>} - { success: boolean, results: Array, successCount: number, failureCount: number }
 */
async function notifyCustomerOrderUpdatesBatch(orderUpdates, options = {}) {
  if (!orderUpdates || orderUpdates.length === 0) {
    return { success: true, results: [], successCount: 0, failureCount: 0 };
  }

  info({ count: orderUpdates.length }, 'Sending batch order status webhooks');

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  // Process webhooks in parallel (limit concurrent requests)
  const concurrency = options.concurrency || 3;
  const batches = [];
  
  for (let i = 0; i < orderUpdates.length; i += concurrency) {
    batches.push(orderUpdates.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const promises = batch.map(async ({ order, previousStatus }) => {
      const result = await notifyCustomerOrderUpdate(order, previousStatus, options);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      return {
        orderId: order._id.toString(),
        status: order.status,
        previousStatus,
        ...result
      };
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  info({ 
    totalOrders: orderUpdates.length,
    successCount,
    failureCount 
  }, 'Batch order status webhooks completed');

  return {
    success: failureCount === 0,
    results,
    successCount,
    failureCount
  };
}

/**
 * Test webhook connection to customer server
 * @param {String} testUrl - Optional test URL (defaults to config webhook URL)
 * @returns {Promise<Object>} - { success: boolean, response?: Object, error?: string }
 */
async function testCustomerWebhookConnection(testUrl = null) {
  const webhookUrl = testUrl || config.customerWebhookUrl;
  
  if (!webhookUrl) {
    return { success: false, error: 'No webhook URL configured' };
  }

  const testPayload = {
    test: true,
    timestamp: new Date().toISOString(),
    message: 'Webhook connection test from vendor server'
  };

  try {
    const response = await axios({
      method: 'POST',
      url: webhookUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-vendor-server-secret': config.customerServerSecret,
        'x-webhook-event': 'connection.test',
        'x-webhook-timestamp': new Date().toISOString(),
        'User-Agent': 'VendorServer-Webhook/1.0'
      },
      data: testPayload,
      timeout: 5000
    });

    return {
      success: true,
      response: {
        status: response.status,
        data: response.data
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    };
  }
}

module.exports = {
  notifyCustomerOrderUpdate,
  notifyCustomerOrderUpdatesBatch,
  testCustomerWebhookConnection
};