const multer = require('multer');
const path = require('path');
const config = require('../config');

/**
 * Multer storage configuration for local file uploads
 * 
 * TODO: To switch to S3/GCS, replace this with a storage adapter:
 * - Create utils/storageAdapter.js with uploadFile(file, folder) method
 * - Implement S3 upload using AWS SDK or similar
 * - Return the public URL instead of local path
 * - Update this middleware to use the adapter
 */

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (config.allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Only ${config.allowedImageTypes.join(', ')} are allowed.`
      ),
      false
    );
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSize, // 25MB
  },
});

/**
 * Middleware for uploading identity images (profile, id, cert)
 * Accepts up to 3 files with specific field names
 */
const uploadIdentityImages = upload.fields([
  { name: 'profile', maxCount: 1 },
  { name: 'id', maxCount: 1 },
  { name: 'cert', maxCount: 1 },
]);

/**
 * Error handling wrapper for multer
 */
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: `File too large. Maximum size is ${config.maxFileSize / (1024 * 1024)}MB`,
      });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
}

module.exports = {
  uploadIdentityImages,
  handleUploadErrors,
};
