const express = require('express');
const router = express.Router();
const externalOrdersController = require('../controllers/externalOrdersController');

/**
 * External Orders API Routes
 * 
 * These endpoints are designed for customer webservers to submit orders
 * to this vendor backend. They are standalone and can be easily removed
 * without affecting other APIs.
 * 
 * Authentication: Uses x-customer-secret header validation
 */

// POST /api/external/orders - Create new order from customer webserver
router.post('/orders', externalOrdersController.createOrderFromCustomer);

module.exports = router;