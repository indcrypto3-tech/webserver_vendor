const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const workTypesController = require('../controllers/workTypesController');

/**
 * GET /api/work-types
 * Get list of available work types
 * No authentication required
 */
router.get('/', workTypesController.getWorkTypes);

/**
 * POST /api/vendors/me/work-types
 * Update vendor's selected work types
 * Requires authentication
 */
router.post('/vendors/me/work-types', authenticate, workTypesController.updateVendorWorkTypes);

module.exports = router;
