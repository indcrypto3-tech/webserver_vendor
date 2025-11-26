const { verifyToken } = require('../utils/jwt');
const Vendor = require('../models/vendor');
const { buildBase, error, info } = require('../utils/logger');

/**
 * Authentication middleware to protect routes
 * Validates JWT token from Authorization header and attaches vendor to req.user
 * 
 * Supports two token types:
 * 1. Token with vendorId - loads vendor from DB and attaches to req.user
 * 2. Token with only mobile - attaches mobile to req.user (for pre-registration state)
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Log missing or malformed header
      const meta = buildBase({ route: req.path, method: req.method });
      error({ ...meta }, 'Authorization header missing or malformed');
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      const meta = buildBase({ route: req.path, method: req.method });
      error({ ...meta }, 'Token verification failed');
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // If token contains vendorId, load vendor from database
    if (decoded.vendorId) {
      const vendor = await Vendor.findById(decoded.vendorId);
      if (!vendor) {
        const meta = buildBase({ route: req.path, method: req.method, vendorId: decoded.vendorId });
        error({ ...meta }, 'Vendor not found for token vendorId');
        return res.status(401).json({ message: 'Vendor not found' });
      }
      // Log successful authentication
      const meta = buildBase({ route: req.path, method: req.method, vendorId: vendor._id });
      info({ ...meta }, 'Authenticated vendor via token');
      req.user = vendor;
    } else if (decoded.mobile) {
      // Token only contains mobile (pre-registration state)
      // Log pre-registration token usage
      const meta = buildBase({ route: req.path, method: req.method, vendorId: null });
      info({ ...meta, mobile: decoded.mobile }, 'Authenticated pre-registration mobile token');
      req.user = { mobile: decoded.mobile, isPreRegistration: true };
    } else {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
}

module.exports = { authenticate };
