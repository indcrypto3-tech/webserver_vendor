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
};
