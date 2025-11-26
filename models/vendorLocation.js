const mongoose = require('mongoose');

const vendorLocationSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true,
  },
  loc: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  accuracy: { type: Number, default: null },
  timestamp: { type: Date, default: Date.now },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
}, { timestamps: true });

vendorLocationSchema.index({ loc: '2dsphere' });

module.exports = mongoose.model('VendorLocation', vendorLocationSchema);
