const mongoose = require('mongoose');

const PreSignupFcmTokenSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  fcmToken: { type: String, required: true, unique: true, index: true },
  deviceType: { type: String, enum: ['android', 'ios', 'web'], default: 'web' },
  deviceId: { type: String, default: null, index: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
});

// TTL index to automatically remove expired tokens
PreSignupFcmTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

PreSignupFcmTokenSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PreSignupFcmToken', PreSignupFcmTokenSchema);
