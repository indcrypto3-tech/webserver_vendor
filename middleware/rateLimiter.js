const rateLimit = require('express-rate-limit');

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
  keyGenerator: (req, res) => {
    // If vendor is authenticated, use vendorId, otherwise fall back to IP
    return req.user?._id?.toString() || req.ip;
  },
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
  keyGenerator: (req, res) => {
    return req.user?._id?.toString() || req.ip;
  },
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

module.exports = {
  presenceRateLimiter,
  strictPresenceRateLimiter,
};
