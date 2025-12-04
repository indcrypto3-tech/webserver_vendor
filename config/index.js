require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/vendor-db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  
  // JWT token expiry
  jwtExpiry: '30d',
  
  // OTP settings (dev-only in-memory)
  otpExpiry: 5 * 60 * 1000, // 5 minutes in milliseconds
  otpLength: 4,
  
  // File upload constraints
  maxFileSize: 25 * 1024 * 1024, // 25MB
  allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  
  // Vendor presence TTL (Time To Live)
  presenceTTLSeconds: parseInt(process.env.PRESENCE_TTL_SECONDS) || 90, // Default 90 seconds
  
  // Note: Development-only mock-order feature removed. Remove related env vars.

  // (work-types feature removed) feature flag retired
  // Socket.IO configuration
  enableSocketIO: process.env.ENABLE_SOCKET_IO === 'true',
  socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',

  // Internal API key for backend-to-backend proxy (keep secret)
  internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-key',
  
  // Customer webserver authentication for external order creation
  customerServerSecret: process.env.CUSTOMER_SERVER_SECRET || 'dev-customer-secret',
  
  // Firebase Cloud Messaging configuration
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebasePrivateKeyPath: process.env.FIREBASE_PRIVATE_KEY_PATH || '',
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
};
