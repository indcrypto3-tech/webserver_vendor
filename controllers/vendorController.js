const Vendor = require('../models/vendor');
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
 * Helper function to sanitize string input
 * Prevents XSS and injection attacks
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  // Remove any HTML tags, script content, and trim
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Validate vendor update fields
 * Returns { valid: boolean, errors: string[] }
 */
function validateVendorUpdate(data) {
  const errors = [];

  // Validate vendorName if provided
  if (data.vendorName !== undefined) {
    if (typeof data.vendorName !== 'string' || data.vendorName.trim().length === 0) {
      errors.push('vendorName must be a non-empty string');
    } else if (data.vendorName.trim().length > 100) {
      errors.push('vendorName must not exceed 100 characters');
    }
  }

  // Validate gender if provided
  if (data.gender !== undefined) {
    const normalized = normalizeGender(data.gender);
    if (data.gender !== '' && !['male', 'female', 'other'].includes(normalized)) {
      errors.push('gender must be one of: male, female, other, or empty string');
    }
  }

  // Validate businessName if provided
  if (data.businessName !== undefined && typeof data.businessName !== 'string') {
    errors.push('businessName must be a string');
  }

  // Validate businessAddress if provided
  if (data.businessAddress !== undefined && typeof data.businessAddress !== 'string') {
    errors.push('businessAddress must be a string');
  }

  // Validate availabilityMode if provided
  if (data.availabilityMode !== undefined) {
    const validModes = ['instant', 'schedule', 'both', ''];
    if (!validModes.includes(data.availabilityMode)) {
      errors.push('availabilityMode must be one of: instant, schedule, both, or empty string');
    }
  }

  // Validate selectedServices if provided
  if (data.selectedServices !== undefined) {
    const parsed = parseSelectedServices(data.selectedServices);
    if (!Array.isArray(parsed)) {
      errors.push('selectedServices must be an array or comma-separated string');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * GET /api/vendors/me
 * Get current vendor's profile (protected route)
 */
async function getMe(req, res) {
  try {
    // Check if user is in pre-registration state
    if (req.user.isPreRegistration) {
      return res.status(404).json({ 
        ok: false,
        error: 'Vendor profile not created yet'
      });
    }

    // Get vendor data and exclude sensitive fields
    const vendorData = req.user.toPublicJSON();

    return res.status(200).json({
      ok: true,
      data: vendorData
    });
  } catch (error) {
    console.error('Get vendor error:', error);
    return res.status(500).json({ 
      ok: false, 
      error: 'Server error occurred while fetching profile' 
    });
  }
}

/**
 * PATCH /api/vendors/me
 * Update current vendor's profile (protected route)
 * Accepts partial updates and multipart files
 */
async function updateMe(req, res) {
  try {
    // Check if user is in pre-registration state
    if (req.user.isPreRegistration) {
      return res.status(404).json({ 
        ok: false,
        error: 'Vendor profile not created yet. Use POST /api/vendors to create.'
      });
    }

    // Validate request body
    const validation = validateVendorUpdate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const vendor = req.user;

    // Fields allowed to be updated
    const allowedUpdates = [
      'vendorName',
      'gender',
      'businessName',
      'businessAddress',
      'availabilityMode',
      'selectedServices',
    ];

    // Track if any changes were made
    let hasChanges = false;

    // Apply text field updates with sanitization
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        hasChanges = true;
        if (field === 'selectedServices') {
          vendor[field] = parseSelectedServices(req.body[field]);
        } else if (field === 'gender') {
          vendor[field] = normalizeGender(req.body[field]);
        } else if (field === 'availabilityMode') {
          // No sanitization needed for enum field
          vendor[field] = req.body[field];
        } else {
          // Sanitize string inputs
          vendor[field] = sanitizeString(req.body[field]);
        }
      }
    });

    // Update file paths if new files uploaded
    if (req.files && Object.keys(req.files).length > 0) {
      hasChanges = true;
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

    // If no changes detected, return early
    if (!hasChanges) {
      return res.status(400).json({
        ok: false,
        error: 'No valid fields provided for update'
      });
    }

    // Save updates
    await vendor.save();

    return res.status(200).json({
      ok: true,
      data: vendor.toPublicJSON()
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: 'Server error occurred while updating profile' 
    });
  }
}

/**
 * POST /api/vendors
 * Create a new vendor with multipart form data
 */
async function createVendor(req, res) {
  try {
    const { vendorName, mobile, gender, businessName, businessAddress, businessType, availabilityMode, selectedServices } = req.body;

    // Validate required fields
    if (!vendorName || !mobile) {
      return res.status(400).json({ 
        ok: false,
        error: 'vendorName and mobile are required' 
      });
    }

    // Validate availabilityMode if provided
    if (availabilityMode && !['instant', 'schedule', 'both', ''].includes(availabilityMode)) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: ['availabilityMode must be one of: instant, schedule, both, or empty string']
      });
    }

    // Validate vendorName length
    if (vendorName.trim().length > 100) {
      return res.status(400).json({
        ok: false,
        error: 'vendorName must not exceed 100 characters'
      });
    }

    // Validate mobile format (basic validation)
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile.trim())) {
      return res.status(400).json({
        ok: false,
        error: 'mobile must be a 10-digit number'
      });
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ mobile: mobile.trim() });
    if (existingVendor) {
      return res.status(409).json({ 
        ok: false,
        error: 'Vendor with this mobile number already exists' 
      });
    }

    // Parse selectedServices
    const parsedServices = parseSelectedServices(selectedServices);

    // Get file paths from uploaded files
    const identityImages = getFilePaths(req.files || {});

    // Normalize and sanitize inputs
    const normalizedGender = normalizeGender(gender);

    // Create new vendor
    const vendor = new Vendor({
      vendorName: sanitizeString(vendorName),
      mobile: mobile.trim(),
      mobileVerified: true, // Assume verified if they reached this step
      gender: normalizedGender,
      businessName: sanitizeString(businessName || ''),
      businessAddress: sanitizeString(businessAddress || ''),
      businessType: sanitizeString(businessType || ''),
      availabilityMode: availabilityMode || '',
      selectedServices: parsedServices,
      identityImages,
    });

    await vendor.save();

    // Generate JWT token
    const token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });

    return res.status(201).json({
      ok: true,
      message: 'Vendor created successfully',
      data: vendor.toPublicJSON(),
      token,
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        ok: false,
        error: 'Vendor with this mobile number already exists' 
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    
    return res.status(500).json({ 
      ok: false, 
      error: 'Server error occurred while creating vendor' 
    });
  }
}

/**
 * POST /api/vendors/me/fcm-token
 * Register or update vendor's FCM token for push notifications
 */
async function registerFCMToken(req, res) {
  try {
    const { token, deviceId, platform } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'FCM token is required',
      });
    }

    const vendor = req.user;

    // Check if token already exists
    const existingTokenIndex = vendor.fcmTokens.findIndex(t => t.token === token);

    if (existingTokenIndex !== -1) {
      // Update existing token
      vendor.fcmTokens[existingTokenIndex].lastUsed = new Date();
      vendor.fcmTokens[existingTokenIndex].platform = platform || 'android';
      if (deviceId) {
        vendor.fcmTokens[existingTokenIndex].deviceId = deviceId;
      }
    } else {
      // Add new token
      vendor.fcmTokens.push({
        token,
        deviceId: deviceId || null,
        platform: platform || 'android',
        lastUsed: new Date(),
      });
    }

    await vendor.save();

    return res.status(200).json({
      ok: true,
      message: 'FCM token registered successfully',
      data: {
        tokenCount: vendor.fcmTokens.length,
      },
    });
  } catch (error) {
    console.error('Register FCM token error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Server error occurred',
    });
  }
}

/**
 * DELETE /api/vendors/me/fcm-token
 * Remove vendor's FCM token (on logout)
 */
async function removeFCMToken(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'FCM token is required',
      });
    }

    const vendor = req.user;

    vendor.fcmTokens = vendor.fcmTokens.filter(t => t.token !== token);
    await vendor.save();

    return res.status(200).json({
      ok: true,
      message: 'FCM token removed successfully',
    });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Server error occurred',
    });
  }
}

module.exports = {
  getMe,
  updateMe,
  createVendor,
  registerFCMToken,
  removeFCMToken,
  // Export helper functions for testing
  normalizeGender,
  parseSelectedServices,
  sanitizeString,
  validateVendorUpdate
};
