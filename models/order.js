const mongoose = require('mongoose');

/**
 * Order Schema
 * Represents a service order placed by a customer
 */
const orderSchema = new mongoose.Schema({
  // Customer information
  customerId: {
    type: String,
    default: null,
    index: true,
  },

  // Vendor assignment
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null,
    index: true,
  },

  // Pickup location (GeoJSON Point)
  pickup: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },

  // Drop location (GeoJSON Point)
  drop: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
  },

  // Order items/services
  items: [
    {
      title: {
        type: String,
        required: true,
      },
      qty: {
        type: Number,
        required: true,
        min: 1,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
    },
  ],

  // Pricing
  fare: {
    type: Number,
    required: true,
    min: 0,
  },

  // Payment information
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'wallet'],
    required: true,
    default: 'cod',
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },

  // Order status
  status: {
    type: String,
    enum: [
      'pending',
      'assigned',
      'accepted',
      'in_progress',
      'payment_requested',
      'payment_confirmed',
      'arrival_confirmed',
      'completed',
      'cancelled'
    ],
    default: 'pending',
    index: true,
  },

  // Scheduling
  scheduledAt: {
    type: Date,
    default: null,
  },

  // Timestamps for order lifecycle
  assignedAt: {
    type: Date,
    default: null,
  },

  acceptedAt: {
    type: Date,
    default: null,
  },

  completedAt: {
    type: Date,
    default: null,
  },

  cancelledAt: {
    type: Date,
    default: null,
  },

  // Cancellation details
  cancellationReason: {
    type: String,
    default: null,
  },

  cancelledBy: {
    type: String,
    enum: ['customer', 'vendor', 'admin'],
    default: null,
  },

  // Notes
  customerNotes: {
    type: String,
    default: '',
  },

  vendorNotes: {
    type: String,
    default: '',
  },

  // Payment requests (Module 3)
  paymentRequests: [
    {
      id: {
        type: String,
        required: true,
      },
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
      notes: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        enum: ['requested', 'confirmed', 'rejected'],
        default: 'requested',
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      confirmedAt: {
        type: Date,
        default: null,
      },
      meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  ],

  // OTP for arrival/completion verification (Module 3)
  otp: {
    otpId: {
      type: String,
      default: null,
    },
    codeHash: {
      type: String,
      default: null,
    },
    purpose: {
      type: String,
      enum: ['arrival', 'completion'],
      default: null,
    },
    createdAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Indexes for efficient queries
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ vendorId: 1, status: 1 });
orderSchema.index({ vendorId: 1, createdAt: -1 }); // For fetchlist pagination
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ 'pickup.coordinates': '2dsphere' });
orderSchema.index({ 'drop.coordinates': '2dsphere' });

// Virtual for order age
orderSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Method to convert to public JSON
orderSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    customerId: this.customerId,
    vendorId: this.vendorId,
    pickup: {
      lat: this.pickup.coordinates[1],
      lng: this.pickup.coordinates[0],
      address: this.pickup.address,
    },
    drop: {
      lat: this.drop.coordinates[1],
      lng: this.drop.coordinates[0],
      address: this.drop.address,
    },
    items: this.items,
    fare: this.fare,
    paymentMethod: this.paymentMethod,
    paymentStatus: this.paymentStatus,
    status: this.status,
    scheduledAt: this.scheduledAt,
    assignedAt: this.assignedAt,
    acceptedAt: this.acceptedAt,
    completedAt: this.completedAt,
    cancelledAt: this.cancelledAt,
    cancellationReason: this.cancellationReason,
    cancelledBy: this.cancelledBy,
    customerNotes: this.customerNotes,
    vendorNotes: this.vendorNotes,
    paymentRequests: this.paymentRequests,
    otp: this.otp && this.otp.otpId ? {
      otpId: this.otp.otpId,
      purpose: this.otp.purpose,
      createdAt: this.otp.createdAt,
      expiresAt: this.otp.expiresAt,
      verified: this.otp.verified,
      attempts: this.otp.attempts,
    } : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    metadata: this.metadata,
  };
};

module.exports = mongoose.model('Order', orderSchema);
