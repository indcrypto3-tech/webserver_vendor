const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const PreSignupFcmToken = require('../models/preSignupFcmToken');

// Rate limiter: protect against abuse (IP-based)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.PRE_SIGNUP_FCM_RATE_LIMIT) || 10,
  message: {
    status: 'error',
    message: 'Rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && process.env.SKIP_RATE_LIMIT === 'true';
  },
});

// Helper: simple E.164-ish validation
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const v = phone.trim();
  // allow + and digits, length between 7 and 15 digits
  return /^\+?\d{7,15}$/.test(v);
}

// POST /api/public/fcm-token
router.post('/fcm-token', limiter, async (req, res) => {
  try {
    const { phone, fcmToken, deviceType, deviceId, meta } = req.body || {};

    if (!phone || !fcmToken) {
      return res.status(400).json({ status: 'error', message: 'Missing phone or fcmToken' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ status: 'error', message: 'Invalid phone format' });
    }

    if (typeof fcmToken !== 'string' || fcmToken.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Invalid fcmToken' });
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
    const userAgent = req.get('User-Agent') || null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (parseInt(process.env.PRE_SIGNUP_FCM_EXPIRES_MS) || 24 * 60 * 60 * 1000));

    // Upsert: if same fcmToken exists, update it. Otherwise if phone+deviceId exists, update that record.
    const query = {
      $or: [
        { fcmToken: fcmToken },
      ],
    };
    if (deviceId) query.$or.push({ phone: phone, deviceId });

    const update = {
      $set: {
        phone: phone,
        fcmToken: fcmToken,
        deviceType: deviceType || 'web',
        deviceId: deviceId || null,
        meta: meta || {},
        ip,
        userAgent,
        updatedAt: now,
        expiresAt,
      },
      $setOnInsert: { createdAt: now },
    };

    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const doc = await PreSignupFcmToken.findOneAndUpdate(query, update, options).lean();

    return res.status(201).json({ status: 'ok', id: doc._id });
  } catch (error) {
    console.error('Error in /api/public/fcm-token:', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;
