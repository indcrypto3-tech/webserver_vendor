const orderService = require('./orderService');
const MockOrderCall = require('../models/mockOrderCall');

/**
 * Create a mock order with idempotency support
 * This service wraps the production order creation logic
 * and adds audit trail tracking
 * 
 * @param {Object} data - Order creation data
 * @param {Object} metadata - Request metadata (IP, user agent, etc.)
 * @returns {Promise<Object>} - { order, isIdempotent }
 */
async function createMockOrder(data, metadata = {}) {
  const { clientRequestId } = data;

  // Check for existing mock order call with same clientRequestId
  if (clientRequestId) {
    const existingCall = await MockOrderCall.findOne({ clientRequestId });
    
    if (existingCall) {
      console.log(`Idempotent request detected: ${clientRequestId}`);
      
      // Fetch the original order
      const order = await orderService.getOrderById(existingCall.orderId);
      
      if (order) {
        return {
          order,
          isIdempotent: true,
          originalCallTimestamp: existingCall.createdAt,
        };
      }
      
      // If order was deleted, allow re-creation
      console.warn(`Original order ${existingCall.orderId} not found, allowing re-creation`);
    }
  }

  // Create the order using production logic
  let order;
  let responseStatus = 201;
  let errorMessage = null;

  try {
    order = await orderService.createOrder({
      customerId: data.customerId,
      vendorId: data.vendorId,
      pickup: data.pickup,
      drop: data.drop,
      items: data.items,
      fare: data.fare,
      paymentMethod: data.paymentMethod,
      scheduledAt: data.scheduledAt,
      customerNotes: data.customerNotes,
      autoAssignVendor: data.autoAssignVendor || false,
      metadata: {
        ...data.metadata,
        source: 'mock-api',
        mockRequestId: clientRequestId || null,
      },
    });
  } catch (error) {
    responseStatus = error.statusCode || 500;
    errorMessage = error.message;
    
    // Create audit record for failed requests
    if (clientRequestId) {
      try {
        await MockOrderCall.create({
          clientRequestId,
          requestPayload: data,
          orderId: null,
          vendorId: null,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          autoAssigned: data.autoAssignVendor || false,
          responseStatus,
          errorMessage,
        });
      } catch (auditError) {
        // Audit record creation failed, but still throw the original error
        console.error('Failed to create audit record:', auditError);
      }
    }
    
    throw error;
  }

  // Create audit record for successful order creation
  const auditData = {
    requestPayload: data,
    orderId: order._id,
    vendorId: order.vendorId || null,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    autoAssigned: data.autoAssignVendor || false,
    responseStatus,
    errorMessage,
  };

  if (clientRequestId) {
    auditData.clientRequestId = clientRequestId;
  }

  await MockOrderCall.create(auditData);

  console.log(`Mock order audit created: ${order._id}`);

  return {
    order,
    isIdempotent: false,
  };
}

/**
 * Get mock order call statistics
 * @returns {Promise<Object>} - Statistics object
 */
async function getMockOrderStats() {
  const totalCalls = await MockOrderCall.countDocuments();
  const successfulCalls = await MockOrderCall.countDocuments({ responseStatus: 201 });
  const failedCalls = await MockOrderCall.countDocuments({ responseStatus: { $ne: 201 } });
  const idempotentCalls = await MockOrderCall.countDocuments({ 
    clientRequestId: { $exists: true, $ne: null } 
  });

  return {
    totalCalls,
    successfulCalls,
    failedCalls,
    idempotentCalls,
  };
}

module.exports = {
  createMockOrder,
  getMockOrderStats,
};
