const config = require('../config');

/**
 * In-memory OTP store for development and test environments.
 *
 * For production, replace with a distributed store (Redis) and a real SMS/FCM
 * provider. The tests run with `NODE_ENV=test` and expect a deterministic
 * `devCode` to be returned.
 */
const otpStore = new Map();

function generateOTP() {
  if (process.env.NODE_ENV !== 'production') {
    // deterministic OTP for tests/dev
    return '1234';
  }

  const length = config.otpLength || 4;
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

function sendOtp(mobile) {
  const code = generateOTP();
  const expiresAt = Date.now() + (config.otpExpiry || 300000);

  otpStore.set(mobile, { code, expiresAt });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV-ONLY] OTP for ${mobile}: ${code} (expires in ${(config.otpExpiry||300000)/1000}s)`);
  }

  return { success: true, code };
}

function verifyOtp(mobile, code) {
  const otpData = otpStore.get(mobile);
  if (!otpData) return { success: false, message: 'OTP not found or expired' };

  if (Date.now() > otpData.expiresAt) {
    otpStore.delete(mobile);
    return { success: false, message: 'OTP expired' };
  }

  if (otpData.code !== code) return { success: false, message: 'Invalid OTP code' };

  otpStore.delete(mobile);
  return { success: true, message: 'OTP verified successfully' };
}

function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [mobile, data] of otpStore.entries()) {
    if (now > data.expiresAt) otpStore.delete(mobile);
  }
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredOtps, 10 * 60 * 1000);
}

module.exports = {
  sendOtp,
  verifyOtp,
};
