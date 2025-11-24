const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { uploadIdentityImages, handleUploadErrors } = require('../middleware/upload');
const vendorController = require('../controllers/vendorController');

/**
 * POST /api/vendors
 * Create a new vendor with multipart form data
 */
router.post('/', uploadIdentityImages, handleUploadErrors, vendorController.createVendor);

/**
 * GET /api/vendors/me
 * Get current vendor's profile (protected route)
 */
router.get('/me', authenticate, vendorController.getMe);

/**
 * PATCH /api/vendors/me
 * Update current vendor's profile (protected route)
 * Accepts partial updates and multipart files
 */
router.patch('/me', authenticate, uploadIdentityImages, handleUploadErrors, vendorController.updateMe);

module.exports = router;
