const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash an OTP code using bcrypt
 * @param {string} code - OTP code to hash
 * @returns {Promise<string>} Hashed OTP
 */
async function hashOTP(code) {
  const saltRounds = 10;
  return await bcrypt.hash(code, saltRounds);
}

/**
 * Verify an OTP code against a hash
 * @param {string} code - Plain OTP code
 * @param {string} hash - Hashed OTP
 * @returns {Promise<boolean>} True if match
 */
async function verifyOTP(code, hash) {
  return await bcrypt.compare(code, hash);
}

/**
 * Create OTP object for storage
 * @param {Object} params
 * @param {string} params.code - Plain OTP code
 * @param {string} params.purpose - 'arrival' or 'completion'
 * @param {number} params.ttlSeconds - Time to live in seconds (default: 300)
 * @returns {Promise<Object>} OTP object with hashed code
 */
async function createOTP({ code, purpose, ttlSeconds = 300 }) {
  if (!code) {
    throw new Error('OTP code is required');
  }
  if (!['arrival', 'completion'].includes(purpose)) {
    throw new Error('Invalid purpose: must be "arrival" or "completion"');
  }

  const codeHash = await hashOTP(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  return {
    otpId: crypto.randomUUID(),
    codeHash,
    purpose,
    createdAt: now,
    expiresAt,
    attempts: 0,
    verified: false,
  };
}

/**
 * Check if OTP is expired
 * @param {Object} otp - OTP object
 * @returns {boolean} True if expired
 */
function isOTPExpired(otp) {
  if (!otp || !otp.expiresAt) return true;
  return new Date() > new Date(otp.expiresAt);
}

/**
 * Check if OTP has too many attempts
 * @param {Object} otp - OTP object
 * @param {number} maxAttempts - Maximum allowed attempts (default: 5)
 * @returns {boolean} True if too many attempts
 */
function hasTooManyAttempts(otp, maxAttempts = 5) {
  if (!otp) return false;
  return otp.attempts >= maxAttempts;
}

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  createOTP,
  isOTPExpired,
  hasTooManyAttempts,
};
