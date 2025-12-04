const config = require('../config');
const orderService = require('../services/orderService');
const { info, error } = require('../utils/logger');

/**
 * External Orders Controller
 * 
 * Handles order creation requests from customer webservers.
 * Validates authentication and delegates to orderService for processing.
 * 
 * This module is standalone and can be removed without affecting other APIs.
 */

/**
 * Middleware to validate customer server authentication
 * Checks x-customer-secret header against configured secret
 */
function validateCustomerServerAuth(req, res, next) {
  const customerSecret = req.headers['x-customer-secret'];
  
  if (!customerSecret) {
    error({
      route: req.route?.path || req.path,
      method: req.method,
      ip: req.ip
    }, 'Missing x-customer-secret header', null);
    
    return res.status(401).json({
      ok: false,
      error: 'Authentication required: Missing x-customer-secret header'
    });
  }
  
  if (customerSecret !== config.customerServerSecret) {
    error({
      route: req.route?.path || req.path,
      method: req.method,
      ip: req.ip
    }, 'Invalid x-customer-secret header', null);
    
    return res.status(401).json({
      ok: false,
      error: 'Authentication failed: Invalid x-customer-secret'
    });
  }
  
  // Authentication successful
  next();
}

/**
 * POST /api/external/orders
 * Creates a new order from customer webserver and broadcasts to online vendors
 * 
 * Expected request body:
 * {
 *   customerId: string,
 *   pickup: { lat: number, lng: number, address: string },
 *   drop: { lat: number, lng: number, address: string },
 *   items: [{ title: string, qty: number, price: number }],
 *   fare: number,
 *   paymentMethod: 'cod' | 'online' | 'wallet',
 *   scheduledAt?: string (ISO date),
 *   customerNotes?: string,
 *   metadata?: object
 * }
 */
async function createOrderFromCustomer(req, res) {
  // Validate authentication first
  validateCustomerServerAuth(req, res, async () => {
    try {
      info({
        route: req.route?.path || req.path,
        method: req.method,
        customerId: req.body?.customerId || null,
        ip: req.ip
      }, 'External order creation request received');

      // Extract order data from request body
      const orderData = {
        customerId: req.body.customerId,
        pickup: req.body.pickup,
        drop: req.body.drop,
        items: req.body.items,
        fare: req.body.fare,
        paymentMethod: req.body.paymentMethod,
        scheduledAt: req.body.scheduledAt,
        customerNotes: req.body.customerNotes,
        metadata: req.body.metadata || {},
        // Force broadcast to online vendors (no specific vendor assignment)
        autoAssignVendor: false
      };

      // Create order using existing service
      const order = await orderService.createOrder(orderData);

      // Broadcast to online vendors (order remains in 'pending' status)
      // Note: broadcastOrderToVendors is called automatically in createOrder for broadcast mode
      const broadcastResult = { success: true, notifiedCount: 0, failedCount: 0 };

      info({
        route: req.route?.path || req.path,
        method: req.method,
        customerId: orderData.customerId,
        orderId: order._id.toString(),
        ip: req.ip
      }, `Order created successfully with status: ${order.status}`);

      // Return success response
      return res.status(201).json({
        ok: true,
        message: 'Order created successfully',
        data: {
          orderId: order._id,
          status: order.status,
          broadcast: {
            success: broadcastResult.success,
            notifiedVendors: broadcastResult.notifiedCount || 0,
            failedNotifications: broadcastResult.failedCount || 0
          }
        }
      });

    } catch (err) {
      console.error('External order creation error:', err);
      
      // Log the error
      const errorMeta = {
        route: req.route?.path || req.path,
        method: req.method,
        customerId: req.body?.customerId || null,
        ip: req.ip
      };
      
      if (err.statusCode === 400 && err.details) {
        // Validation error from orderService
        error(errorMeta, `Order validation failed: ${err.details.join(', ')}`, err.stack);
        return res.status(400).json({
          ok: false,
          error: 'Order validation failed',
          details: err.details
        });
      }
      
      // Generic server error
      error(errorMeta, err.message || 'Order creation failed', err.stack);
      return res.status(err.statusCode || 500).json({
        ok: false,
        error: err.message || 'Internal server error occurred'
      });
    }
  });
}

module.exports = {
  createOrderFromCustomer,
  validateCustomerServerAuth
};