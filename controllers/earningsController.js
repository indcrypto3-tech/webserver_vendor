const { buildBase, info, error } = require('../utils/logger');
const earningsService = require('../services/earningsService');

/**
 * GET /api/earnings/summary
 * Get earnings summary for the authenticated vendor
 */
async function getSummary(req, res) {
  const rid = req.requestId;
  let vendorId = req.user && req.user._id;

  // Admin override: allow querying another vendor's earnings
  if (req.user && req.user.isAdmin && req.query.vendorId) {
    vendorId = req.query.vendorId;
  }

  if (!vendorId) {
    const meta = buildBase({ requestId: rid, route: '/api/earnings/summary', method: 'GET' });
    // Log authorization header presence and length (do not log token itself)
    const authHeader = req.headers && req.headers.authorization;
    error({ ...meta, authPresent: !!authHeader, authLen: authHeader ? String(authHeader).length : 0 }, 'Unauthorized: vendorId missing');
    return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Vendor ID not found' });
  }

  info(buildBase({ requestId: rid, route: '/api/earnings/summary', method: 'GET', vendorId }), 'Get earnings summary');

  try {
    // Parse optional date filters
    const { start, end, tz } = req.query;

    // Validate dates if provided
    if (start && isNaN(Date.parse(start))) {
      return res.status(400).json({ ok: false, error: 'invalid_date', message: 'Invalid start date' });
    }
    if (end && isNaN(Date.parse(end))) {
      return res.status(400).json({ ok: false, error: 'invalid_date', message: 'Invalid end date' });
    }

    const filters = { start, end, tz };
    const summary = await earningsService.getEarningsSummary(vendorId, filters);

    return res.status(200).json({
      ok: true,
      summary
    });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/earnings/summary', method: 'GET', vendorId }), 'Get earnings summary error', err.stack);
    return res.status(500).json({ ok: false, requestId: rid, message: 'Internal server error' });
  }
}

/**
 * GET /api/earnings/history
 * Get paginated earnings history for the authenticated vendor
 */
async function getHistory(req, res) {
  const rid = req.requestId;
  let vendorId = req.user && req.user._id;

  // Admin override
  if (req.user && req.user.isAdmin && req.query.vendorId) {
    vendorId = req.query.vendorId;
  }

  if (!vendorId) {
    const meta = buildBase({ requestId: rid, route: '/api/earnings/history', method: 'GET' });
    const authHeader = req.headers && req.headers.authorization;
    error({ ...meta, authPresent: !!authHeader, authLen: authHeader ? String(authHeader).length : 0 }, 'Unauthorized: vendorId missing');
    return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Vendor ID not found' });
  }

  info(buildBase({ requestId: rid, route: '/api/earnings/history', method: 'GET', vendorId }), 'Get earnings history');

  try {
    // Parse query params
    const { from, to, limit, offset, page, perPage, tz } = req.query;

    // Validate dates
    if (from && isNaN(Date.parse(from))) {
      return res.status(400).json({ ok: false, error: 'invalid_date', message: 'Invalid from date' });
    }
    if (to && isNaN(Date.parse(to))) {
      return res.status(400).json({ ok: false, error: 'invalid_date', message: 'Invalid to date' });
    }

    // Validate pagination params
    if (limit && (isNaN(limit) || parseInt(limit, 10) < 1)) {
      return res.status(400).json({ ok: false, error: 'invalid_param', message: 'Invalid limit' });
    }
    if (offset && (isNaN(offset) || parseInt(offset, 10) < 0)) {
      return res.status(400).json({ ok: false, error: 'invalid_param', message: 'Invalid offset' });
    }

    // Convert page/perPage to limit/offset if provided
    let finalLimit = limit;
    let finalOffset = offset;

    if (page && perPage) {
      const pageNum = parseInt(page, 10);
      const perPageNum = parseInt(perPage, 10);
      if (pageNum > 0 && perPageNum > 0) {
        finalLimit = perPageNum;
        finalOffset = (pageNum - 1) * perPageNum;
      }
    }

    const options = {
      from,
      to,
      limit: finalLimit,
      offset: finalOffset,
      tz
    };

    const result = await earningsService.getEarningsHistory(vendorId, options);

    return res.status(200).json({
      ok: true,
      ...result
    });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/earnings/history', method: 'GET', vendorId }), 'Get earnings history error', err.stack);
    return res.status(500).json({ ok: false, requestId: rid, message: 'Internal server error' });
  }
}

module.exports = {
  getSummary,
  getHistory
};
