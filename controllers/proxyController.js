const { buildBase, info, error } = require('../utils/logger');
const earningsService = require('../services/earningsService');
const config = require('../config');

async function requireInternalKey(req, res) {
  const key = req.headers['x-internal-key'] || req.headers['x-internal-api-key'];
  if (!key || key !== config.internalApiKey) {
    const meta = buildBase({ route: req.path, method: req.method });
    error({ ...meta, authPresent: !!key, authLen: key ? String(key).length : 0 }, 'Proxy auth failed: missing or invalid internal key');
    return res.status(401).json({ ok: false, error: 'unauthorized', message: 'Invalid internal API key' });
  }
  return null;
}

async function postEarningsSummary(req, res) {
  const rid = req.requestId;

  const invalid = await requireInternalKey(req, res);
  if (invalid) return; // response already sent

  try {
    const { vendorId, start, end, tz } = req.body || {};
    if (!vendorId) {
      return res.status(400).json({ ok: false, error: 'invalid_param', message: 'vendorId is required in body' });
    }

    const meta = buildBase({ requestId: rid, route: '/api/proxy/earnings/summary', method: 'POST', vendorId });
    info({ ...meta }, 'Proxy: fetching earnings summary');

    const summary = await earningsService.getEarningsSummary(vendorId, { start, end, tz });

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/proxy/earnings/summary', method: 'POST' }), 'Proxy summary error', err.stack);
    return res.status(500).json({ ok: false, requestId: rid, message: 'Internal server error' });
  }
}

async function postEarningsHistory(req, res) {
  const rid = req.requestId;

  const invalid = await requireInternalKey(req, res);
  if (invalid) return;

  try {
    const { vendorId, from, to, limit, offset, page, perPage, tz } = req.body || {};
    if (!vendorId) {
      return res.status(400).json({ ok: false, error: 'invalid_param', message: 'vendorId is required in body' });
    }

    const meta = buildBase({ requestId: rid, route: '/api/proxy/earnings/history', method: 'POST', vendorId });
    info({ ...meta }, 'Proxy: fetching earnings history');

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
      tz,
    };

    const result = await earningsService.getEarningsHistory(vendorId, options);

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/proxy/earnings/history', method: 'POST' }), 'Proxy history error', err.stack);
    return res.status(500).json({ ok: false, requestId: rid, message: 'Internal server error' });
  }
}

module.exports = {
  postEarningsSummary,
  postEarningsHistory,
};
