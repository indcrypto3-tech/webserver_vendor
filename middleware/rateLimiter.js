const rateLimit = require('express-rate-limit');

// Helper function to safely get request IP (handles IPv6)
function getClientIdentifier(req) {
  // Use authenticated vendor ID if available
  if (req.user?._id) {
    return `vendor:${req.user._id.toString()}`;
  }
  // Otherwise use IP address (handles both IPv4 and IPv6)
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// General rate limiter for presence updates
// Allows 1 request per second, max 60 requests per minute per vendor
const presenceRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // Max 60 requests per window per IP/vendor
  message: {
    ok: false,
    error: 'Too many presence updates. Please try again later.',
    details: ['Rate limit: 60 requests per minute'],
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Use vendorId from auth middleware as key if available
  keyGenerator: (req) => getClientIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      error: 'Too many presence updates. Please try again later.',
      details: ['Rate limit exceeded: 60 requests per minute per vendor'],
    });
  },
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test' && process.env.SKIP_RATE_LIMIT === 'true';
  },
});

// Stricter rate limiter: 1 request per second
const strictPresenceRateLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 1, // Max 1 request per second
  message: {
    ok: false,
    error: 'Too many requests. Maximum 1 request per second.',
    details: ['Rate limit: 1 request per second'],
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIdentifier(req),
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      error: 'Too many requests. Maximum 1 request per second.',
      details: ['Rate limit exceeded: 1 request per second per vendor'],
    });
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && process.env.SKIP_RATE_LIMIT === 'true';
  },
});

// Rate limiter for dev/mock order endpoints
// Allows 10 requests per minute (configurable via env)
const devOrderRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: parseInt(process.env.DEV_ORDER_RATE_LIMIT) || 10, // Default: 10 requests per minute
  message: {
    ok: false,
    error: 'Too many mock order requests. Please try again later.',
    details: ['Rate limit: 10 requests per minute'],
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  handler: (req, res) => {
    const limit = parseInt(process.env.DEV_ORDER_RATE_LIMIT) || 10;
    res.status(429).json({
      ok: false,
      error: 'Too many mock order requests. Please try again later.',
      details: [`Rate limit exceeded: ${limit} requests per minute`],
    });
  },
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test' && process.env.SKIP_RATE_LIMIT === 'true';
  },
});

module.exports = {
  presenceRateLimiter,
  strictPresenceRateLimiter,
  devOrderRateLimiter,
};
