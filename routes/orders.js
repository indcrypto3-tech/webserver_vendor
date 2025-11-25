const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

// Debug logging for serverless environments
if (!orderController.getOrder || !orderController.acceptOrder || !orderController.rejectOrder) {
  console.error('ERROR: orderController functions missing!', {
    getOrder: typeof orderController.getOrder,
    acceptOrder: typeof orderController.acceptOrder,
    rejectOrder: typeof orderController.rejectOrder,
    keys: Object.keys(orderController),
  });
}

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get('/:id', authenticate, orderController.getOrder || ((req, res) => {
  res.status(500).json({ error: 'getOrder function not loaded' });
}));

/**
 * POST /api/orders/:id/accept
 * Accept an order (vendor only)
 */
router.post('/:id/accept', authenticate, orderController.acceptOrder);

/**
 * POST /api/orders/:id/reject
 * Reject an order (vendor only)
 */
router.post('/:id/reject', authenticate, orderController.rejectOrder);

module.exports = router;
