const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendor');
const authenticate = require('../middleware/auth');
const { uploadIdentityImages, handleUploadErrors } = require('../middleware/upload');
const { signToken } = require('../utils/jwt');

/**
 * Helper function to normalize gender input to lowercase
 * Handles case-insensitive input (Male, MALE, male -> male)
 */
function normalizeGender(gender) {
  if (!gender || typeof gender !== 'string') return '';
  const normalized = gender.trim().toLowerCase();
  // Only return if it's a valid enum value
  if (['male', 'female', 'other'].includes(normalized)) {
    return normalized;
  }
  return ''; // Return empty string for invalid values
}

/**
 * Helper function to parse selectedServices
 * Accepts JSON array string or comma-separated values
 */
function parseSelectedServices(input) {
  if (!input) return [];
  
  if (Array.isArray(input)) return input;
  
  if (typeof input === 'string') {
    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not JSON, try CSV
      return input.split(',').map(s => s.trim()).filter(s => s);
    }
  }
  
  return [];
}

/**
 * Helper function to build file paths for uploaded files
 */
function getFilePaths(files) {
  const paths = {
    profile: '',
    id: '',
    cert: '',
  };

  if (files.profile && files.profile[0]) {
    paths.profile = `/uploads/${files.profile[0].filename}`;
  }
  if (files.id && files.id[0]) {
    paths.id = `/uploads/${files.id[0].filename}`;
  }
  if (files.cert && files.cert[0]) {
    paths.cert = `/uploads/${files.cert[0].filename}`;
  }

  return paths;
}

/**
 * POST /api/vendors
 * Create a new vendor with multipart form data
 */
router.post('/', uploadIdentityImages, handleUploadErrors, async (req, res) => {
  try {
    const { vendorName, mobile, gender, businessName, businessAddress, businessType, selectedServices } = req.body;

    // Validate required fields
    if (!vendorName || !mobile) {
      return res.status(400).json({ message: 'vendorName and mobile are required' });
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ mobile: mobile.trim() });
    if (existingVendor) {
      return res.status(409).json({ message: 'Vendor with this mobile number already exists' });
    }

    // Parse selectedServices
    const parsedServices = parseSelectedServices(selectedServices);

    // Get file paths from uploaded files
    const identityImages = getFilePaths(req.files || {});

    // Normalize gender to lowercase
    const normalizedGender = normalizeGender(gender);

    // Create new vendor
    const vendor = new Vendor({
      vendorName: vendorName.trim(),
      mobile: mobile.trim(),
      mobileVerified: true, // Assume verified if they reached this step
      gender: normalizedGender,
      businessName: businessName || '',
      businessAddress: businessAddress || '',
      businessType: businessType || '',
      selectedServices: parsedServices,
      identityImages,
    });

    await vendor.save();

    // Generate JWT token
    const token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });

    return res.status(201).json({
      message: 'Vendor created successfully',
      vendor: vendor.toPublicJSON(),
      token,
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Vendor with this mobile number already exists' });
    }
    
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/vendors/me
 * Get current vendor's profile (protected route)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Check if user is in pre-registration state
    if (req.user.isPreRegistration) {
      return res.status(404).json({ 
        message: 'Vendor profile not created yet',
        mobile: req.user.mobile 
      });
    }

    return res.status(200).json({
      vendor: req.user.toPublicJSON(),
    });
  } catch (error) {
    console.error('Get vendor error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PATCH /api/vendors/me
 * Update current vendor's profile (protected route)
 * Accepts partial updates and multipart files
 */
router.patch('/me', authenticate, uploadIdentityImages, handleUploadErrors, async (req, res) => {
  try {
    // Check if user is in pre-registration state
    if (req.user.isPreRegistration) {
      return res.status(404).json({ 
        message: 'Vendor profile not created yet. Use POST /api/vendors to create.',
        mobile: req.user.mobile 
      });
    }

    const vendor = req.user;

    // Fields allowed to be updated
    const allowedUpdates = [
      'vendorName',
      'gender',
      'businessName',
      'businessAddress',
      'businessType',
      'selectedServices',
    ];

    // Apply text field updates
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'selectedServices') {
          vendor[field] = parseSelectedServices(req.body[field]);
        } else if (field === 'gender') {
          vendor[field] = normalizeGender(req.body[field]);
        } else {
          vendor[field] = req.body[field];
        }
      }
    });

    // Update file paths if new files uploaded
    if (req.files) {
      const newFilePaths = getFilePaths(req.files);
      
      if (newFilePaths.profile) {
        vendor.identityImages.profile = newFilePaths.profile;
      }
      if (newFilePaths.id) {
        vendor.identityImages.id = newFilePaths.id;
      }
      if (newFilePaths.cert) {
        vendor.identityImages.cert = newFilePaths.cert;
      }
    }

    await vendor.save();

    return res.status(200).json({
      message: 'Vendor updated successfully',
      vendor: vendor.toPublicJSON(),
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
