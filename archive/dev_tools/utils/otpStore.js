const config = require('../config');

/**
 * In-memory OTP store for development only.
 * 
 * TODO: For production with multiple instances, replace this with Redis or a similar
 * distributed cache to ensure OTPs are accessible across all server instances.
 * 
 * Structure: Map<mobile, { code, expiresAt }>
 */
const otpStore = new Map();

/**
 * Generate a random 4-digit OTP code
 * In development, uses fixed OTP for easier testing
 */
function generateOTP() {
  // Use fixed OTP in development for easier testing
  if (process.env.NODE_ENV !== 'production') {
    return '1234';
  }
  
  // Generate random OTP in production
  const length = config.otpLength;
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

/**
 * Send OTP (dev-only: stores in memory and logs to console)
 * @param {string} mobile - Mobile number
 * @returns {object} - { success: boolean, code: string (dev-only) }
 */
function sendOtp(mobile) {
  const code = generateOTP();
  const expiresAt = Date.now() + config.otpExpiry;

  otpStore.set(mobile, { code, expiresAt });

  // Log OTP to console for development
  console.log(`[DEV-ONLY] OTP for ${mobile}: ${code} (expires in ${config.otpExpiry / 1000}s)`);

  return { success: true, code }; // Return code for dev/testing
}

/**
 * Verify OTP code for a mobile number
 * @param {string} mobile - Mobile number
 * @param {string} code - OTP code to verify
 * @returns {object} - { success: boolean, message: string }
 */
function verifyOtp(mobile, code) {
  const otpData = otpStore.get(mobile);

  if (!otpData) {
    return { success: false, message: 'OTP not found or expired' };
  }

  if (Date.now() > otpData.expiresAt) {
    otpStore.delete(mobile);
    return { success: false, message: 'OTP expired' };
  }

  if (otpData.code !== code) {
    return { success: false, message: 'Invalid OTP code' };
  }

  // OTP verified successfully - remove it from store (one-time use)
  otpStore.delete(mobile);
  return { success: true, message: 'OTP verified successfully' };
}

/**
 * Clear expired OTPs periodically (optional cleanup)
 */
function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [mobile, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(mobile);
    }
  }
}

// Run cleanup every 10 minutes (skip the interval during tests to avoid
// keeping the Node.js event loop alive and blocking Jest from exiting)
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredOtps, 10 * 60 * 1000);
}

module.exports = {
  sendOtp,
  verifyOtp,
};
