const mongoose = require('mongoose');

/**
 * MockOrderCall Schema
 * Audit log for all mock order API calls
 * Tracks request details, idempotency, and created orders
 */
const mockOrderCallSchema = new mongoose.Schema({
  // Idempotency key
  clientRequestId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },

  // Request payload (stored for audit)
  requestPayload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  // Created order reference
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
    default: null,
    index: true,
  },

  // Vendor assigned to the order
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null,
  },

  // Request metadata
  ipAddress: {
    type: String,
    default: null,
  },

  userAgent: {
    type: String,
    default: null,
  },

  // Auto-assignment flag
  autoAssigned: {
    type: Boolean,
    default: false,
  },

  // Response status
  responseStatus: {
    type: Number,
    required: true,
  },

  // Error details if any
  errorMessage: {
    type: String,
    default: null,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Index for querying recent calls
mockOrderCallSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MockOrderCall', mockOrderCallSchema);
