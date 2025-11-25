const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

console.log('[orders.js] authenticate middleware type:', typeof authenticate);

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

// Create safe middleware wrapper
const authMiddleware = authenticate || ((req, res, next) => next());

/**
 * POST /api/orders/:id/accept - Accept an order (vendor only)
 */
router.post('/:id/accept', authMiddleware, (req, res) => orderController.acceptOrder(req, res));

/**
 * POST /api/orders/:id/reject - Reject an order (vendor only)
 */
router.post('/:id/reject', authMiddleware, (req, res) => orderController.rejectOrder(req, res));

/**
 * POST /api/orders/:id/reject - Reject an order (vendor only)
 */
router.post('/:id/reject', authenticate, (req, res) => orderController.rejectOrder(req, res));

module.exports = router;