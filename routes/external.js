const express = require('express');
const Joi = require('joi');
const Vendor = require('../models/vendor');
const { info, error: logError, warn } = require('../utils/logger');
const router = express.Router();

// Environment variable required: EXTERNAL_VENDOR_SECRET
// Set in .env file or environment

/**
 * Maps flexible incoming field names to our canonical schema
 * @param {Object} payload - Raw incoming payload
 * @returns {Object} - Mapped canonical payload
 */
function mapVendorFields(payload) {
  const fieldMappings = {
    vendorId: ['vendorId', 'id', 'vendor_id', 'vendor_id_str'],
    vendorName: ['vendorName', 'name', 'vendor_name'],
    vendorPhone: ['vendorPhone', 'phone', 'mobile'],
    vendorAddress: ['vendorAddress', 'address', 'addr'],
    serviceType: ['serviceType', 'service', 'type'],
    assignedOrderId: ['assignedOrderId', 'orderId', 'order_id', 'assigned_order'],
    status: ['status', 'state', 'vendorStatus']
  };

  const mapped = {};
  
  for (const [canonicalField, variations] of Object.entries(fieldMappings)) {
    for (const variant of variations) {
      if (payload[variant] !== undefined) {
        mapped[canonicalField] = payload[variant];
        break;
      }
    }
  }

  return mapped;
}

/**
 * Validation schema for canonical vendor payload
 */
const vendorUpdateSchema = Joi.object({
  vendorId: Joi.string().required().messages({
    'any.required': 'vendorId is required',
    'string.empty': 'vendorId cannot be empty'
  }),
  vendorName: Joi.string().optional(),
  vendorPhone: Joi.string().optional(),
  vendorAddress: Joi.string().optional(), 
  serviceType: Joi.string().optional(),
  assignedOrderId: Joi.string().optional(),
  status: Joi.string().valid('accepted', 'rejected', 'enroute', 'completed', 'cancelled').optional()
});

/**
 * Middleware to validate vendor secret authentication
 */
function validateVendorSecret(req, res, next) {
  const secret = process.env.EXTERNAL_VENDOR_SECRET;
  const providedSecret = req.get('x-vendor-secret');
  
  if (!providedSecret) {
    warn({ route: req.path, method: req.method, ip: req.ip }, 'Missing vendor secret header');
    return res.status(401).json({ error: 'missing vendor secret' });
  }
  
  if (providedSecret !== secret) {
    warn({ route: req.path, method: req.method, ip: req.ip }, 'Invalid vendor secret provided');
    return res.status(401).json({ error: 'invalid vendor secret' });
  }
  
  next();
}

/**
 * POST /api/external/vendor-update
 * 
 * Accepts vendor updates from external partners with flexible field mapping.
 * Authenticates using x-vendor-secret header.
 * Upserts vendor data and optionally updates associated orders.
 * 
 * Example requests:
 * 
 * curl -X POST https://webserver-vendor.vercel.app/api/external/vendor-update \
 *   -H "Content-Type: application/json" \
 *   -H "x-vendor-secret: ${EXTERNAL_VENDOR_SECRET}" \
 *   -d '{
 *     "id": "vendor-123",
 *     "name": "John'\''s Kitchen",
 *     "mobile": "+911234567890",
 *     "address": "123 Main St", 
 *     "service": "delivery",
 *     "orderId": "order-456",
 *     "state": "accepted"
 *   }'
 * 
 * curl -X POST https://webserver-vendor.vercel.app/api/external/vendor-update \
 *   -H "Content-Type: application/json" \
 *   -H "x-vendor-secret: ${EXTERNAL_VENDOR_SECRET}" \
 *   -d '{
 *     "vendor_id": "vendor-789",
 *     "vendor_name": "Quick Fix Services",
 *     "phone": "+12125551234",
 *     "addr": "456 Oak Ave",
 *     "type": "repair", 
 *     "assigned_order": "67890",
 *     "vendorStatus": "enroute"
 *   }'
 */
router.post('/vendor-update', validateVendorSecret, async (req, res) => {
  try {
    // Log request arrival
    const mappedPayload = mapVendorFields(req.body);
    info({ 
      route: req.path, 
      method: req.method, 
      vendorId: mappedPayload.vendorId,
      assignedOrderId: mappedPayload.assignedOrderId,
      ip: req.ip 
    }, 'Vendor update request received');

    // Validate mapped payload
    const { error: validationError, value: validatedPayload } = vendorUpdateSchema.validate(mappedPayload);
    
    if (validationError) {
      warn({ 
        route: req.path, 
        method: req.method, 
        vendorId: mappedPayload.vendorId,
        ip: req.ip,
        validationErrors: validationError.details 
      }, 'Validation failed for vendor update');
      
      return res.status(400).json({
        error: 'validation error',
        details: validationError.details.map(detail => detail.message)
      });
    }

    const { vendorId, assignedOrderId, ...vendorData } = validatedPayload;
    
    // Check if vendor exists before update to determine if it's an upsert
    const existingVendor = await Vendor.findOne({ vendorId }).select('_id');
    const wasUpserted = !existingVendor;
    
    // Prepare update object, excluding undefined values to avoid null constraint issues
    const updateFields = {};
    if (vendorData.vendorName) updateFields.vendorName = vendorData.vendorName;
    if (vendorData.vendorPhone) updateFields.mobile = vendorData.vendorPhone;
    if (vendorData.vendorAddress) updateFields.businessAddress = vendorData.vendorAddress;
    if (vendorData.serviceType) updateFields.selectedServices = [vendorData.serviceType];
    if (vendorData.status) updateFields.vendorStatus = vendorData.status;

    // Upsert vendor in database
    const vendorResult = await Vendor.findOneAndUpdate(
      { vendorId },
      { $set: updateFields },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    let orderUpdated = false;
    
    // Handle order update if assignedOrderId provided
    if (assignedOrderId) {
      try {
        // Try to require Order model - it may not exist
        const Order = require('../models/order');
        
        // Try to find and update order by orderId or _id
        let orderUpdateResult = await Order.findOneAndUpdate(
          { $or: [{ _id: assignedOrderId }, { orderId: assignedOrderId }] },
          { 
            $set: {
              vendorId: vendorResult._id,
              ...(validatedPayload.status && { 
                status: validatedPayload.status === 'accepted' ? 'assigned' : 
                       validatedPayload.status === 'enroute' ? 'in_progress' :
                       validatedPayload.status === 'completed' ? 'completed' :
                       validatedPayload.status === 'cancelled' ? 'cancelled' :
                       validatedPayload.status === 'rejected' ? 'pending' :
                       validatedPayload.status
              })
            }
          },
          { new: true }
        );
        
        if (orderUpdateResult) {
          orderUpdated = true;
          info({ 
            vendorId,
            orderId: assignedOrderId,
            newStatus: orderUpdateResult.status 
          }, 'Order updated successfully');
        }
      } catch (orderError) {
        // Order model might not exist or order not found - continue without error
        info({ vendorId, assignedOrderId }, 'Order update skipped - model not found or order not found');
      }
    }

    // Success response
    res.status(200).json({
      success: true,
      vendorId,
      upserted: wasUpserted,
      orderUpdated
    });

    info({ 
      vendorId,
      upserted: wasUpserted,
      orderUpdated 
    }, 'Vendor update completed successfully');

  } catch (dbError) {
    logError({ 
      route: req.path,
      method: req.method,
      error: dbError.message,
      stack: dbError.stack 
    }, 'Database error during vendor update');
    
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;