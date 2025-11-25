const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get('/:id', authenticate, orderController.getOrder);

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
