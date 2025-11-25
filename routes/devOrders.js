const express = require('express');
const router = express.Router();
const devOrdersController = require('../controllers/devOrdersController');
const { devOrderRateLimiter } = require('../middleware/rateLimiter');

/**
 * All routes in this file require x-dev-key header
 * Checked by checkDevKey middleware
 */
router.use(devOrdersController.checkDevKey);

/**
 * POST /api/dev/orders/mock
 * Create a mock order for testing purposes
 * 
 * Headers:
 *   x-dev-key: <MOCK_ORDERS_SECRET>
 * 
 * Body:
 *   {
 *     "customerId": "optional-string",
 *     "vendorId": "optional-objectid",
 *     "pickup": { "lat": 12.97, "lng": 77.59, "address": "..." },
 *     "drop": { "lat": 12.98, "lng": 77.60, "address": "..." },
 *     "items": [{ "title": "Service A", "qty": 1, "price": 150 }],
 *     "fare": 150,
 *     "paymentMethod": "cod",
 *     "scheduledAt": "ISO-8601 string (optional)",
 *     "customerNotes": "optional notes",
 *     "autoAssignVendor": true,
 *     "clientRequestId": "optional-idempotency-key",
 *     "metadata": {}
 *   }
 */
router.post('/orders/mock', devOrderRateLimiter, devOrdersController.createMockOrder);

/**
 * GET /api/dev/orders/stats
 * Get statistics about mock order API calls
 * 
 * Headers:
 *   x-dev-key: <MOCK_ORDERS_SECRET>
 */
router.get('/orders/stats', devOrdersController.getMockOrderStats);

module.exports = router;
