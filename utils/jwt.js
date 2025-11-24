const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Sign a JWT token with the given payload
 * @param {object} payload - Data to encode in the token (e.g., { vendorId, mobile })
 * @returns {string} - Signed JWT token
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
  });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
};
