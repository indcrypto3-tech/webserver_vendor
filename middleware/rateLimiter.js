const rateLimit = require('express-rate-limit');

// General rate limiter for presence updates
// Allows 1 request per second, max 60 requests per minute per vendor
// Uses default IP-based limiting (IPv6 safe)
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
// Uses default IP-based limiting (IPv6 safe)
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
  // For dev endpoints, just use IP - don't use custom keyGenerator to avoid IPv6 issues
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
