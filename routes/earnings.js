const express = require('express');
const { authenticate } = require('../middleware/auth');
const earningsController = require('../controllers/earningsController');

const router = express.Router();

/**
 * GET /api/earnings/summary
 * Get earnings summary for the authenticated vendor
 * Query params:
 *   - start (optional): Start date for filtering
 *   - end (optional): End date for filtering
 *   - tz (optional): Timezone
 *   - vendorId (optional, admin only): Override vendor ID
 */
router.get('/summary', authenticate, earningsController.getSummary);

/**
 * GET /api/earnings/history
 * Get paginated earnings history for the authenticated vendor
 * Query params:
 *   - from (optional): Start date
 *   - to (optional): End date
 *   - limit (optional, default 50, max 200): Items per page
 *   - offset (optional, default 0): Skip items
 *   - page (optional): Page number (alternative to offset)
 *   - perPage (optional): Items per page (alternative to limit)
 *   - tz (optional): Timezone
 *   - vendorId (optional, admin only): Override vendor ID
 */
router.get('/history', authenticate, earningsController.getHistory);

module.exports = router;
