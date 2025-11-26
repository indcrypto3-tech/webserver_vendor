const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requestId = require('../middleware/requestId');

// Load our new orders controller (keeps existing file untouched)
const ordersController = require('../controllers/ordersController');

// Apply requestId and auth middleware
const authMiddleware = authenticate || ((req, res, next) => next());

router.use(requestId);

// List orders for vendor
router.get('/', authMiddleware, (req, res) => ordersController.listOrders(req, res));

// Get single order
router.get('/:orderId', authMiddleware, (req, res) => ordersController.getOrder(req, res));

// Accept / Reject / Start / Complete / Cancel
router.post('/:orderId/accept', authMiddleware, (req, res) => ordersController.acceptOrder(req, res));
router.post('/:orderId/reject', authMiddleware, (req, res) => ordersController.rejectOrder(req, res));
router.post('/:orderId/start', authMiddleware, (req, res) => ordersController.startOrder(req, res));
router.post('/:orderId/complete', authMiddleware, (req, res) => ordersController.completeOrder(req, res));
router.post('/:orderId/cancel', authMiddleware, (req, res) => ordersController.cancelOrder(req, res));

// Module 3: Payment and OTP endpoints
router.post('/:orderId/payment-request', authMiddleware, (req, res) => ordersController.paymentRequest(req, res));
router.post('/:orderId/request-otp', authMiddleware, (req, res) => ordersController.requestOTP(req, res));
router.post('/:orderId/verify-otp', authMiddleware, (req, res) => ordersController.verifyOTPEndpoint(req, res));

// Deprecated: per new workflow vendors should update order fare via PATCH /:orderId/fare
// and then create a payment request. The per-request PATCH endpoint has been removed.

// Update order fare (vendor can adjust price before creating payment request)
router.patch('/:orderId/fare', authMiddleware, (req, res) => ordersController.updateFare(req, res));
module.exports = router;