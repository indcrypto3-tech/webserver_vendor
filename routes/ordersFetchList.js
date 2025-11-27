/**
 * Order fetch list endpoints
 * GET /api/orders/fetchlist - vendor orders (authenticated)
 * GET /api/orders/fetchlist/vendor/:vendorId - proxy endpoint (service token)
 */

const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const { authenticate } = require('../middleware/auth');
const requireServiceAuth = require('../middleware/serviceAuth');
const logger = require('../utils/logger');

const MAX_LIMIT = 200;

// Valid order statuses
const VALID_STATUSES = [
  'pending',
  'assigned',
  'accepted',
  'in_progress',
  'payment_requested',
  'payment_confirmed',
  'arrival_confirmed',
  'completed',
  'cancelled'
];

/**
 * Parse pagination params with defaults
 */
function parsePaging(req, defaultLimit = 5) {
  let limit = parseInt(req.query.limit ?? defaultLimit, 10);
  let offset = parseInt(req.query.offset ?? 0, 10);
  
  if (!Number.isFinite(limit) || limit <= 0) limit = defaultLimit;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  limit = Math.min(limit, MAX_LIMIT);
  
  return { limit, offset };
}

/**
 * Build MongoDB filter from query params
 */
function buildFilter(req, vendorId) {
  const filter = { vendorId };
  const { status, from, to } = req.query;
  
  if (status && status !== 'all') {
    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    filter.status = status;
  }
  
  if (from || to) {
    filter.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        throw new Error('Invalid from date');
      }
      filter.createdAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        throw new Error('Invalid to date');
      }
      filter.createdAt.$lte = toDate;
    }
  }
  
  return filter;
}

/**
 * GET /api/orders/fetchlist
 * Vendor-authenticated endpoint - uses req.user.vendorId
 */
router.get('/fetchlist', authenticate, async (req, res) => {
  const vendorId = req.user?._id?.toString();
  const logCtx = { requestId: req.id, vendorId };
  
  try {
    if (!vendorId) {
      logger.warn('fetchlist: missing vendorId', logCtx);
      return res.status(401).json({
        ok: false,
        error: 'vendor_required',
        message: 'Vendor ID not found in auth token'
      });
    }

    const { limit, offset } = parsePaging(req, 5);
    const filter = buildFilter(req, vendorId);
    
    logger.info('fetchlist query', { ...logCtx, limit, offset, filter });

    // Calculate completed orders for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const completedThisMonth = await Order.countDocuments({
      vendorId,
      status: 'completed',
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Get total count and paginated results
    const total = await Order.countDocuments(filter);
    const rows = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('_id status createdAt customer fare paymentRequests vendorId')
      .lean();

    const returned = rows.length;
    const remaining = Math.max(0, total - (offset + returned));

    logger.info('fetchlist success', { ...logCtx, total, returned, remaining, completedThisMonth });

    return res.json({
      ok: true,
      limit,
      offset,
      rows,
      returned,
      remaining,
      completedThisMonth
    });
  } catch (err) {
    logger.error('fetchlist failed', { ...logCtx, error: err.message, stack: err.stack });
    
    if (err.message.includes('Invalid') && err.message.includes('date')) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_date',
        message: err.message
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: 'Failed to fetch orders'
    });
  }
});

/**
 * GET /api/orders/fetchlist/vendor/:vendorId
 * Service-authenticated proxy endpoint
 */
router.get('/fetchlist/vendor/:vendorId', requireServiceAuth, async (req, res) => {
  const vendorId = req.params.vendorId;
  const logCtx = { requestId: req.id, vendorId, proxy: true };
  
  try {
    if (!vendorId) {
      return res.status(400).json({
        ok: false,
        error: 'vendor_id_required',
        message: 'vendorId parameter is required'
      });
    }

    const { limit, offset } = parsePaging(req, 5);
    const filter = buildFilter(req, vendorId);
    
    logger.info('fetchlist proxy query', { ...logCtx, limit, offset, filter });

    // Calculate completed orders for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const completedThisMonth = await Order.countDocuments({
      vendorId,
      status: 'completed',
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const total = await Order.countDocuments(filter);
    const rows = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('_id status createdAt customer fare paymentRequests vendorId')
      .lean();

    const returned = rows.length;
    const remaining = Math.max(0, total - (offset + returned));

    logger.info('fetchlist proxy success', { ...logCtx, total, returned, remaining, completedThisMonth });

    return res.json({
      ok: true,
      limit,
      offset,
      rows,
      returned,
      remaining,
      completedThisMonth
    });
  } catch (err) {
    logger.error('fetchlist proxy failed', { ...logCtx, error: err.message, stack: err.stack });
    
    if (err.message.includes('Invalid') && err.message.includes('date')) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_date',
        message: err.message
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: 'Failed to fetch orders'
    });
  }
});

module.exports = router;
