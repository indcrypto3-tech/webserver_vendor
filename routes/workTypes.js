const express = require('express');
const router = express.Router();
const workTypesController = require('../controllers/workTypesController');

/**
 * GET /api/work-types
 * Get list of available work types
 * No authentication required
 */
router.get('/', workTypesController.getWorkTypes);

module.exports = router;
