const mongoose = require('mongoose');

const vendorPresenceSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      unique: true,
    },
    online: {
      type: Boolean,
      required: true,
      default: false,
    },
    loc: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    accuracy: {
      type: Number,
      min: 0,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false, // We're managing updatedAt manually
  }
);

// Indexes (vendorId already indexed via unique:true in schema)
vendorPresenceSchema.index({ loc: '2dsphere' }, { sparse: true }); // Sparse index: only index docs with loc
vendorPresenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Method to check if location is valid
vendorPresenceSchema.methods.hasValidLocation = function () {
  return (
    this.loc &&
    this.loc.coordinates &&
    Array.isArray(this.loc.coordinates) &&
    this.loc.coordinates.length === 2
  );
};

// Static method to find online vendors
vendorPresenceSchema.statics.findOnlineVendors = function () {
  return this.find({ online: true });
};

// Static method to find online vendors near a location
vendorPresenceSchema.statics.findNearby = function (lng, lat, maxDistance = 5000) {
  return this.find({
    online: true,
    loc: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        $maxDistance: maxDistance, // in meters
      },
    },
  });
};

module.exports = mongoose.model('VendorPresence', vendorPresenceSchema);
