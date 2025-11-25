const VendorPresence = require('../models/vendorPresence');
const config = require('../config');

// Get PRESENCE_TTL from environment or default to 90 seconds
const PRESENCE_TTL_SECONDS = parseInt(process.env.PRESENCE_TTL_SECONDS) || 90;
const PRESENCE_TTL_MS = PRESENCE_TTL_SECONDS * 1000;

/**
 * Update vendor presence (online/offline status and location)
 * POST /api/vendors/me/presence
 */
exports.updatePresence = async (req, res) => {
  try {
    const vendorId = req.user._id;
    const { online, lat, lng, accuracy, timestamp } = req.body;

    // Validation: online must be boolean
    if (typeof online !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: ['online must be a boolean value'],
      });
    }

    const errors = [];

    // Validate latitude if provided
    if (lat !== undefined && lat !== null) {
      if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        errors.push('lat must be a number between -90 and 90');
      }
    }

    // Validate longitude if provided
    if (lng !== undefined && lng !== null) {
      if (typeof lng !== 'number' || lng < -180 || lng > 180) {
        errors.push('lng must be a number between -180 and 180');
      }
    }

    // Validate accuracy if provided
    if (accuracy !== undefined && accuracy !== null) {
      if (typeof accuracy !== 'number' || accuracy < 0) {
        errors.push('accuracy must be a non-negative number');
      }
    }

    // Check if both lat and lng are provided together
    if ((lat !== undefined && lat !== null) !== (lng !== undefined && lng !== null)) {
      errors.push('lat and lng must be provided together');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Case 1: Vendor going offline
    if (online === false) {
      await VendorPresence.findOneAndDelete({ vendorId });
      
      return res.status(200).json({
        ok: true,
        data: {
          vendorId,
          online: false,
          message: 'Vendor is now offline',
        },
      });
    }

    // Case 2: Vendor going online
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PRESENCE_TTL_MS);

    const updateOperation = {
      $set: {
        online: true,
        updatedAt: now,
        expiresAt,
      },
      $setOnInsert: { vendorId }, // Only set vendorId on insert
    };

    // Add location data if provided
    if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
      updateOperation.$set.loc = {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
      };
      
      // Add accuracy if provided
      if (accuracy !== undefined && accuracy !== null) {
        updateOperation.$set.accuracy = accuracy;
      }
    }

    // Atomic upsert: create if not exists, update if exists
    const presence = await VendorPresence.findOneAndUpdate(
      { vendorId },
      updateOperation,
      {
        upsert: true,
        new: true,
        runValidators: false, // Disable to avoid issues with partial updates
      }
    );

    return res.status(200).json({
      ok: true,
      data: {
        vendorId: presence.vendorId,
        online: presence.online,
        location: presence.hasValidLocation()
          ? {
              lat: presence.loc.coordinates[1],
              lng: presence.loc.coordinates[0],
              accuracy: presence.accuracy,
            }
          : null,
        updatedAt: presence.updatedAt,
        expiresAt: presence.expiresAt,
        ttlSeconds: PRESENCE_TTL_SECONDS,
      },
    });
  } catch (error) {
    console.error('Error updating vendor presence:', error);

    // Handle duplicate key error (should not happen with upsert, but just in case)
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: 'Presence record conflict',
        details: ['A presence record already exists for this vendor'],
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: ['Failed to update vendor presence'],
    });
  }
};

/**
 * Get current vendor's presence status
 * GET /api/vendors/me/presence
 */
exports.getPresence = async (req, res) => {
  try {
    const vendorId = req.user._id;

    const presence = await VendorPresence.findOne({ vendorId });

    if (!presence) {
      return res.status(200).json({
        ok: true,
        data: {
          vendorId,
          online: false,
          location: null,
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        vendorId: presence.vendorId,
        online: presence.online,
        location: presence.hasValidLocation()
          ? {
              lat: presence.loc.coordinates[1],
              lng: presence.loc.coordinates[0],
              accuracy: presence.accuracy,
            }
          : null,
        updatedAt: presence.updatedAt,
        expiresAt: presence.expiresAt,
        ttlSeconds: PRESENCE_TTL_SECONDS,
      },
    });
  } catch (error) {
    console.error('Error fetching vendor presence:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: ['Failed to fetch vendor presence'],
    });
  }
};

/**
 * Find online vendors (admin/internal use)
 * GET /api/vendors/presence/online
 */
exports.getOnlineVendors = async (req, res) => {
  try {
    const onlineVendors = await VendorPresence.findOnlineVendors();

    return res.status(200).json({
      ok: true,
      data: onlineVendors.map((presence) => ({
        vendorId: presence.vendorId,
        online: presence.online,
        location: presence.hasValidLocation()
          ? {
              lat: presence.loc.coordinates[1],
              lng: presence.loc.coordinates[0],
              accuracy: presence.accuracy,
            }
          : null,
        updatedAt: presence.updatedAt,
      })),
      count: onlineVendors.length,
    });
  } catch (error) {
    console.error('Error fetching online vendors:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: ['Failed to fetch online vendors'],
    });
  }
};

/**
 * Find online vendors near a location (admin/internal use)
 * GET /api/vendors/presence/nearby?lat=12.97&lng=77.59&maxDistance=5000
 */
exports.getNearbyVendors = async (req, res) => {
  try {
    const { lat, lng, maxDistance } = req.query;

    // Validate required params
    if (!lat || !lng) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: ['lat and lng query parameters are required'],
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const distance = maxDistance ? parseInt(maxDistance) : 5000; // Default 5km

    // Validate numbers
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: ['lat must be a number between -90 and 90'],
      });
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: ['lng must be a number between -180 and 180'],
      });
    }

    const nearbyVendors = await VendorPresence.findNearby(longitude, latitude, distance);

    return res.status(200).json({
      ok: true,
      data: nearbyVendors.map((presence) => ({
        vendorId: presence.vendorId,
        online: presence.online,
        location: presence.hasValidLocation()
          ? {
              lat: presence.loc.coordinates[1],
              lng: presence.loc.coordinates[0],
              accuracy: presence.accuracy,
            }
          : null,
        updatedAt: presence.updatedAt,
      })),
      count: nearbyVendors.length,
      searchRadius: distance,
    });
  } catch (error) {
    console.error('Error fetching nearby vendors:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error',
      details: ['Failed to fetch nearby vendors'],
    });
  }
};
