const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../utils/otpStore');
const { signToken } = require('../utils/jwt');
const Vendor = require('../models/vendor');
const PreSignupFcmToken = require('../models/preSignupFcmToken');
const notificationService = require('../services/notificationService');

/**
 * POST /api/auth/send-otp
 * Send OTP to mobile number (dev-only: in-memory storage)
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validate mobile
    if (!mobile || typeof mobile !== 'string' || mobile.trim() === '') {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    // Send OTP (stores in memory and logs to console)
    const result = sendOtp(mobile.trim());

    if (result.success) {
      // Do not include or expose OTP in responses. OTPs are not logged
      // and not returned by the API to avoid leaking codes.

      // Send push to any pre-signup FCM tokens registered for this mobile (signup/signin flow)
      try {
        const tokens = await PreSignupFcmToken.find({ phone: mobile.trim() }).distinct('fcmToken');
        if (tokens && tokens.length) {
          const notif = { title: 'OTP Sent', body: `An OTP was requested for ${mobile.trim()}` };
          const data = { type: 'auth_otp_request', phone: mobile.trim() };
          if (process.env.NODE_ENV !== 'production' && result.code) {
            // In dev/test flows the otpStore may return the code for debugging
            data.devCode = result.code;
          }
          await notificationService.sendPushToTokens(tokens, notif, data);
        }
      } catch (e) {
        console.warn('Failed to send auth OTP push to pre-signup tokens:', e && e.message);
      }

      return res.status(200).json({ message: 'OTP sent' });
    }

    return res.status(500).json({ message: 'Failed to send OTP' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and issue JWT token
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, code } = req.body;

    // Validate input
    if (!mobile || !code) {
      return res.status(400).json({ message: 'Mobile and code are required' });
    }

    // Verify OTP
    const result = verifyOtp(mobile.trim(), code.trim());

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    // OTP verified - check if vendor exists
    let vendor = null;
    try {
      vendor = await Vendor.findOne({ mobile: mobile.trim() });
    } catch (dbError) {
      console.error('Database error finding vendor:', dbError);
      // Continue without vendor if DB fails
    }

    if (vendor) {
      // Vendor exists - mark mobile as verified and return vendor data
      try {
        vendor.mobileVerified = true;
        await vendor.save();
      } catch (saveError) {
        console.error('Error saving vendor:', saveError);
        // Continue anyway
      }

      const token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });

      return res.status(200).json({
        message: 'verified',
        token,
        vendorId: vendor._id,
        vendor: vendor.toPublicJSON(),
      });
    } else {
      // Vendor doesn't exist - return token with mobile only
      const token = signToken({ mobile: mobile.trim(), vendorId: null });

      return res.status(200).json({
        message: 'verified',
        token,
        vendorId: null,
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
