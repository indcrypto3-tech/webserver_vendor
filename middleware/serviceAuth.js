/**
 * Service authentication middleware
 * Validates X-Service-Token header for trusted backend-to-backend calls
 */

const logger = require('../utils/logger');

function requireServiceAuth(req, res, next) {
  const serviceToken = req.get('X-Service-Token');
  const expectedToken = process.env.SERVICE_API_KEY;

  // Build log context
  const logCtx = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip
  };

  if (!expectedToken) {
    logger.error('SERVICE_API_KEY not configured', logCtx);
    return res.status(500).json({
      ok: false,
      error: 'service_auth_not_configured',
      message: 'Service authentication is not configured'
    });
  }

  if (!serviceToken) {
    logger.warn('Service auth failed: missing X-Service-Token header', logCtx);
    return res.status(403).json({
      ok: false,
      error: 'service_token_required',
      message: 'X-Service-Token header is required'
    });
  }

  if (serviceToken !== expectedToken) {
    logger.warn('Service auth failed: invalid token', logCtx);
    return res.status(403).json({
      ok: false,
      error: 'invalid_service_token',
      message: 'Invalid service token'
    });
  }

  logger.info('Service auth successful', logCtx);
  next();
}

module.exports = requireServiceAuth;
