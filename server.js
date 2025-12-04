const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const config = require('./config');
// Socket.IO disabled for Vercel serverless deployment
// const { initializeSocket } = require('./services/socketService');

// Import routes
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const vendorLocationRoutes = require('./routes/vendorLocation');
const presenceRoutes = require('./routes/presence');
const orderRoutes = require('./routes/orders');
const ordersFetchListRoutes = require('./routes/ordersFetchList');
const earningsRoutes = require('./routes/earnings');
const proxyRoutes = require('./routes/proxy');
const publicFcmRoutes = require('./routes/publicFcm');
const externalOrdersRoutes = require('./routes/externalOrders');
// Work-types feature retired from the codebase

// Initialize Express app
const app = express();

// Create HTTP server (needed for Socket.IO)
const server = http.createServer(app);
// Initialize Socket.IO when explicitly enabled
if (process.env.ENABLE_SOCKET_IO === 'true') {
  try {
    const { initializeSocket } = require('./services/socketService');
    initializeSocket(server);
  } catch (e) {
    console.warn('Socket.IO initialization skipped:', e.message);
  }
}

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

// Trust proxy - Required for Vercel deployment
// This enables Express to trust the X-Forwarded-* headers from Vercel's proxy
app.set('trust proxy', 1);

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
app.use('/api/vendors', presenceRoutes); // Presence routes under /api/vendors
app.use('/api/orders', ordersFetchListRoutes); // Order fetchlist endpoints (must be BEFORE orderRoutes)
app.use('/api/orders', orderRoutes); // Order management routes
app.use('/api/earnings', earningsRoutes); // Earnings endpoints
app.use('/api/proxy', proxyRoutes); // Backend-to-backend proxy endpoints
// Vendor location endpoint mounted at /api/vendor/location
app.use('/api/vendor', vendorLocationRoutes);
// Public pre-signup endpoints (no authentication)
app.use('/api/public', publicFcmRoutes);
// External order creation from customer webservers (standalone module)
app.use('/api/external', externalOrdersRoutes);

// Dev/mock endpoints removed from production routes. Archived copies
// are available under `archive/dev_tools` if you need to run dev-only
// helpers locally or in isolated test environments.

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
    version: '1.0.2',
    endpoints: {
      auth: {
        sendOtp: 'POST /api/auth/send-otp',
        verifyOtp: 'POST /api/auth/verify-otp',
      },
      vendors: {
        create: 'POST /api/vendors',
        getMe: 'GET /api/vendors/me',
        updateMe: 'PATCH /api/vendors/me'
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
// Only auto-connect when NODE_ENV is explicitly 'production' or 'development'.
// This avoids attempting a network DB connection when tests `require('./server')`
// before the test harness sets up an in-memory MongoDB instance.
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
  mongoose
    .connect(config.mongoUri)
    .then(() => {
      console.log('Connected to MongoDB');
      console.log(`Database: ${config.mongoUri}`);

      // Initialize Firebase Admin SDK (require lazily so tests can mock the module)
      if (config.enableSocketIO) {
        try {
          const { initializeFirebase } = require('./config/firebase');
          initializeFirebase();
        } catch (e) {
          console.warn('Firebase initialization skipped or failed:', e.message);
        }
      }
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
} else {
  console.log('Test or unspecified environment — skipping automatic mongoose.connect.');
}

// Mongoose connection events
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  
  // Socket.IO disabled for serverless
  // No persistent connections to close
  
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

// Decide whether to start the HTTP server. Normally we skip listening in tests
// to avoid port conflicts and let tests control the server lifecycle. However,
// some integration tests (Socket.IO) rely on the server listening — those
// tests can enable `ENABLE_SOCKET_IO=true` or `ENABLE_TEST_SERVER=1`.
const shouldListen =
  process.env.VERCEL !== '1' &&
  process.env.NODE_ENV !== 'production-serverless' &&
  (process.env.NODE_ENV !== 'test' || process.env.ENABLE_SOCKET_IO === 'true' || process.env.ENABLE_TEST_SERVER === '1');

if (shouldListen) {
  const PORT = config.port;
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsPath}`);
    console.log(`🔗 API: http://localhost:${PORT}`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log('ℹ️  Socket.IO disabled (not supported on Vercel serverless)');
    console.log('📲 Using Firebase Cloud Messaging for push notifications');
    console.log('');
  });
} else {
  if (process.env.NODE_ENV === 'test') {
    console.log('Test environment detected — not starting HTTP listener (unless enabled)');
  }
}

// Export app for Vercel serverless (default export)
// Vercel doesn't use server.listen(), it handles that automatically
// Export `app` for Supertest and also expose `server` for integration tests.
// Keep backward compatibility by assigning properties on the exported function.
module.exports = app;
module.exports.app = app;
module.exports.server = server;
