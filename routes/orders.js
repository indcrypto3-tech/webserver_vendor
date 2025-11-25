const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Try-catch wrapper to handle module loading issues on serverless
let orderController;
try {
  orderController = require('../controllers/orderController');
  console.log('[orders.js] orderController loaded successfully:', Object.keys(orderController));
} catch (error) {
  console.error('[orders.js] CRITICAL: Failed to load orderController:', error.message);
  console.error(error.stack);
  // Create dummy controller to prevent crashes
  orderController = {
    getOrder: (req, res) => res.status(500).json({ error: 'orderController failed to load' }),
    acceptOrder: (req, res) => res.status(500).json({ error: 'orderController failed to load' }),
    rejectOrder: (req, res) => res.status(500).json({ error: 'orderController failed to load' }),
  };
}

// Validate that functions exist
if (typeof orderController.getOrder !== 'function') {
  console.error('[orders.js] ERROR: getOrder is not a function, type:', typeof orderController.getOrder);
  console.error('[orders.js] getOrder value:', orderController.getOrder);
}
if (typeof orderController.acceptOrder !== 'function') {
  console.error('[orders.js] ERROR: acceptOrder is not a function, type:', typeof orderController.acceptOrder);
  console.error('[orders.js] acceptOrder value:', orderController.acceptOrder);
}
if (typeof orderController.rejectOrder !== 'function') {
  console.error('[orders.js] ERROR: rejectOrder is not a function, type:', typeof orderController.rejectOrder);
  console.error('[orders.js] rejectOrder value:', orderController.rejectOrder);
}

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get('/:id', authenticate, function getOrderWrapper(req, res) {
  return orderController.getOrder(req, res);
});

/**
 * POST /api/orders/:id/accept
 * Accept an order (vendor only)
 */
router.post('/:id/accept', authenticate, acceptOrderFunc);

/**
 * POST /api/orders/:id/reject
 * Reject an order (vendor only)
/**
 * POST /api/orders/:id/accept
 * Accept an order (vendor only)
 */
router.post('/:id/accept', authenticate, function acceptOrderWrapper(req, res) {
  return orderController.acceptOrder(req, res);
});

/**
 * POST /api/orders/:id/reject
 * Reject an order (vendor only)
 */
router.post('/:id/reject', authenticate, function rejectOrderWrapper(req, res) {
  return orderController.rejectOrder(req, res);
});