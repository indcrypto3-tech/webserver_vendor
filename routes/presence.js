const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { presenceRateLimiter, strictPresenceRateLimiter } = require('../middleware/rateLimiter');
const presenceController = require('../controllers/presenceController');

/**
 * POST /api/vendors/me/presence
 * Update vendor online/offline status and location
 * Protected route - requires authentication
 * Rate limited: 1 request/second, 60 requests/minute
 */
router.post(
  '/me/presence',
  authenticate,
  strictPresenceRateLimiter,
  presenceRateLimiter,
  presenceController.updatePresence
);

/**
 * GET /api/vendors/me/presence
 * Get current vendor's presence status
 * Protected route - requires authentication
 */
router.get('/me/presence', authenticate, presenceController.getPresence);

/**
 * GET /api/vendors/presence/online
 * Get all online vendors (admin/internal use)
 * Protected route - requires authentication
 */
router.get('/presence/online', authenticate, presenceController.getOnlineVendors);

/**
 * GET /api/vendors/presence/nearby
 * Find online vendors near a location (admin/internal use)
 * Query params: lat, lng, maxDistance (optional, default 5000m)
 * Protected route - requires authentication
 */
router.get('/presence/nearby', authenticate, presenceController.getNearbyVendors);

module.exports = router;
