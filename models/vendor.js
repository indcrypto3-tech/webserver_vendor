const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    vendorName: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    mobileVerified: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    businessName: {
      type: String,
      trim: true,
      default: '',
    },
    businessAddress: {
      type: String,
      trim: true,
      default: '',
    },
    selectedServices: {
      type: [String],
      default: [],
    },
    availabilityMode: {
      type: String,
      enum: ['instant', 'schedule', 'both', ''],
      default: '',
    },
    identityImages: {
      profile: {
        type: String,
        default: '',
      },
      id: {
        type: String,
        default: '',
      },
      cert: {
        type: String,
        default: '',
      },
    },
    // FCM tokens for push notifications
    fcmTokens: [{
      token: {
        type: String,
        required: true,
      },
      deviceId: {
        type: String,
        default: null,
      },
      platform: {
        type: String,
        enum: ['android', 'ios', 'web'],
        default: 'android',
      },
      lastUsed: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for performance
vendorSchema.index({ mobile: 1 }, { unique: true });
vendorSchema.index({ businessType: 1 });
vendorSchema.index({ 'fcmTokens.token': 1 });

// Method to get public vendor data (exclude sensitive fields if needed)
vendorSchema.methods.toPublicJSON = function () {
  const vendor = this.toObject();
  return vendor;
};

const Vendor = mongoose.model('Vendor', vendorSchema);

module.exports = Vendor;
