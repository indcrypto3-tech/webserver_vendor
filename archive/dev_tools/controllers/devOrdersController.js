const devOrdersService = require('../services/devOrdersService');
const config = require('../config');

/**
 * Middleware to check x-dev-key header
 * Validates that request includes correct dev API key
 */
function checkDevKey(req, res, next) {
  const devKey = req.header('x-dev-key');
  
  if (!devKey) {
    return res.status(401).json({
      ok: false,
      error: 'Missing x-dev-key header',
    });
  }

  if (devKey !== config.mockOrdersSecret) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid x-dev-key',
    });
  }

  next();
}

/**
 * POST /api/dev/orders/mock
 * Create a mock order for testing purposes
 */
async function createMockOrder(req, res) {
  try {
    const {
      customerId,
      vendorId,
      pickup,
      drop,
      items,
      fare,
      paymentMethod,
      scheduledAt,
      customerNotes,
      autoAssignVendor,
      clientRequestId,
      metadata,
    } = req.body;

    // Extract request metadata
    const requestMetadata = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.header('user-agent'),
    };

    // Call service to create mock order
    const result = await devOrdersService.createMockOrder({
      customerId,
      vendorId,
      pickup,
      drop,
      items,
      fare,
      paymentMethod,
      scheduledAt,
      customerNotes,
      autoAssignVendor,
      clientRequestId,
      metadata,
    }, requestMetadata);

    // Return response with idempotency information
    // Keep legacy shape where `data` is the order object, but also include `data.order` for newer clients/tests
    const orderJson = result.order.toPublicJSON();
    const responseData = {
      ok: true,
      data: Object.assign({}, orderJson, { order: orderJson }),
    };

    if (result.isIdempotent) {
      // Place idempotent flag both at top-level and inside data for different consumer expectations
      responseData.idempotent = true;
      responseData.data.idempotent = true;
      responseData.message = 'Order already exists (idempotent request)';
      responseData.originalCallTimestamp = result.originalCallTimestamp;
      return res.status(200).json(responseData);
    }

    return res.status(201).json(responseData);
  } catch (error) {
    console.error('Mock order creation error:', error);

    // Handle validation errors
    if (error.statusCode === 400) {
      return res.status(400).json({
        ok: false,
        error: error.message,
        details: error.details || [],
      });
    }

    // Handle not found errors
    if (error.statusCode === 404) {
      return res.status(404).json({
        ok: false,
        error: error.message,
      });
    }

    // Generic server error
    return res.status(500).json({
      ok: false,
      error: 'Server error occurred while creating mock order',
    });
  }
}

/**
 * GET /api/dev/orders/stats
 * Get statistics about mock order calls (optional endpoint)
 */
async function getMockOrderStats(req, res) {
  try {
    const stats = await devOrdersService.getMockOrderStats();
    return res.status(200).json({
      ok: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching mock order stats:', error);
    return res.status(500).json({
      ok: false,
      error: 'Server error occurred while fetching stats',
    });
  }
}

module.exports = {
  checkDevKey,
  createMockOrder,
  getMockOrderStats,
};
