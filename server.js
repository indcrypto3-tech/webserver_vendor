const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Import routes
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const workTypesRoutes = require('./routes/workTypes');
const { seedWorkTypes } = require('./controllers/workTypesController');

// Initialize Express app
const app = express();

// Create uploads directory if it doesn't exist (skip on serverless environments)
const uploadsPath = path.join(__dirname, config.uploadDir);
try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log(`Created uploads directory: ${uploadsPath}`);
  }
} catch (error) {
  // On serverless platforms (like Vercel), filesystem is read-only
  console.warn('Cannot create uploads directory (serverless environment):', error.message);
  console.warn('File uploads will not persist. Consider using cloud storage (S3/Cloudinary).');
}

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Static file serving for uploads
// Files will be accessible at http://localhost:PORT/uploads/filename
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/work-types', workTypesRoutes);
app.use('/api', workTypesRoutes); // For /api/vendors/me/work-types

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Vendor Backend API',
    version: '1.0.0',
    endpoints: {
      auth: {
        sendOtp: 'POST /api/auth/send-otp',
        verifyOtp: 'POST /api/auth/verify-otp',
      },
      vendors: {
        create: 'POST /api/vendors',
        getMe: 'GET /api/vendors/me',
        updateMe: 'PATCH /api/vendors/me',
        updateWorkTypes: 'POST /api/vendors/me/work-types',
      },
      workTypes: {
        getAll: 'GET /api/work-types',
      },
      health: 'GET /health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Database connection
mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
    console.log(`Database: ${config.mongoUri}`);
    
    // Seed work types if database is empty
    seedWorkTypes();
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Mongoose connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsPath}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});

module.exports = app;
