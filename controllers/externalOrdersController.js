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
 * Creates a new service order from customer webserver and broadcasts to online vendors
 * 
 * Expected request body:
 * {
 *   customerId: string,
 *   customerName: string,
 *   customerPhone: string,
 *   customerAddress: string,
 *   workType: string,
 *   description: string,
 *   location: { latitude: number, longitude: number },
 *   estimatedPrice?: number,
 *   urgency?: string
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
      }, 'External service order creation request received');

      // Validate required fields for service orders
      const requiredFields = ['customerId', 'customerName', 'customerPhone', 'customerAddress', 'workType', 'description', 'location'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed',
          details: missingFields.map(field => `${field} is required`)
        });
      }

      // Validate location coordinates
      const { latitude, longitude } = req.body.location;
      if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed',
          details: ['location.latitude must be a number between -90 and 90']
        });
      }
      
      if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          ok: false,
          error: 'Validation failed',
          details: ['location.longitude must be a number between -180 and 180']
        });
      }

      // Transform service request into delivery order format expected by orderService
      const orderData = {
        customerId: req.body.customerId,
        // Use customer location as both pickup and drop for service orders
        pickup: {
          lat: latitude,
          lng: longitude,
          address: req.body.customerAddress
        },
        drop: {
          lat: latitude,
          lng: longitude,
          address: req.body.customerAddress
        },
        // Create service item from work request
        items: [{
          title: `${req.body.workType}: ${req.body.description}`,
          qty: 1,
          price: req.body.estimatedPrice || 0
        }],
        fare: req.body.estimatedPrice || 0,
        paymentMethod: 'cod', // Default payment method for service orders
        customerNotes: req.body.description,
        metadata: {
          orderType: 'service',
          workType: req.body.workType,
          customerName: req.body.customerName,
          customerPhone: req.body.customerPhone,
          urgency: req.body.urgency || 'normal',
          originalServiceRequest: req.body
        },
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