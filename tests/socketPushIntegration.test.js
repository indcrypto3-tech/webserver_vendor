// Set environment variables before importing modules
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.ENABLE_MOCK_ORDERS = 'true';
process.env.MOCK_ORDERS_SECRET = 'test-secret';
process.env.ENABLE_SOCKET_IO = 'true';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const io = require('socket.io-client');
// Mock Firebase Admin SDK early so server and services pick up the mock
// Create a shared mock messaging object so both the service and the test
// inspect the same `sendMulticast` mock function.
const mockMessaging = {
  sendMulticast: jest.fn(async () => ({
    successCount: 1,
    failureCount: 0,
    responses: [{ success: true }],
  })),
};

jest.mock('../config/firebase', () => ({
  initializeFirebase: jest.fn(() => ({ name: 'mock-app' })),
  getMessaging: jest.fn(() => mockMessaging),
  isFirebaseConfigured: jest.fn(() => true),
}));

const { app, server } = require('../server');
const Vendor = require('../models/vendor');
const VendorPresence = require('../models/vendorPresence');
const Order = require('../models/order');
const MockOrderCall = require('../models/mockOrderCall');
const { signToken } = require('../utils/jwt');

let mongoServer;
let socketClient;
let testVendor;
let testVendorToken;
let onlineVendor;
let onlineVendorToken;


beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to in-memory database
  await mongoose.connect(mongoUri);

  // Create test vendor
  testVendor = await Vendor.create({
    vendorName: 'Test Vendor',
    mobile: '9876543210',
    mobileVerified: true,
    fcmTokens: [
      {
        token: 'test-fcm-token-123',
        platform: 'android',
        deviceId: 'test-device-001',
      },
    ],
  });

  testVendorToken = signToken({ vendorId: testVendor._id, mobile: testVendor.mobile });

  // Create online vendor with presence
  onlineVendor = await Vendor.create({
    vendorName: 'Online Vendor',
    mobile: '9876543211',
    mobileVerified: true,
    fcmTokens: [
      {
        token: 'online-vendor-fcm-token',
        platform: 'android',
      },
    ],
  });

  onlineVendorToken = signToken({ vendorId: onlineVendor._id, mobile: onlineVendor.mobile });

  // Create vendor presence (online)
  await VendorPresence.create({
    vendorId: onlineVendor._id,
    online: true,
    loc: {
      type: 'Point',
      coordinates: [77.5946, 12.9716], // Bangalore coordinates
    },
    lastSeen: new Date(),
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(async () => {
  // Close socket client
  if (socketClient) {
    socketClient.close();
  }

  // Close server
  await new Promise(resolve => {
    server.close(resolve);
  });

  // Disconnect from database
  await mongoose.disconnect();

  // Stop in-memory MongoDB
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear orders and mock order calls before each test
  await Order.deleteMany({});
  await MockOrderCall.deleteMany({});
});

afterEach(async () => {
  // Ensure socket client is closed between tests to avoid cross-test events
  if (socketClient) {
    try { socketClient.close(); } catch (e) {}
    socketClient = null;
  }
});

describe('Socket.IO Integration', () => {
  test('should connect to Socket.IO server', (done) => {
    const address = server.address();
    const port = address.port;
    
    socketClient = io(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    socketClient.on('connect', () => {
      expect(socketClient.connected).toBe(true);
      done();
    });

    socketClient.on('connect_error', (error) => {
      done(error);
    });
  });

  test('should authenticate vendor via socket', (done) => {
    const address = server.address();
    const port = address.port;
    
    socketClient = io(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    socketClient.on('connect', () => {
      socketClient.emit('auth:vendor', { vendorId: onlineVendor._id.toString() });
    });

    socketClient.on('auth:success', (data) => {
      expect(data.vendorId).toBe(onlineVendor._id.toString());
      expect(data.socketId).toBeTruthy();
      done();
    });

    socketClient.on('auth:error', (error) => {
      done(new Error(error.message));
    });
  });

  test('should receive order:new event when order is assigned', (done) => {
    const address = server.address();
    const port = address.port;
    
    socketClient = io(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    socketClient.on('connect', () => {
      // Authenticate as online vendor
      socketClient.emit('auth:vendor', { vendorId: onlineVendor._id.toString() });
    });

    socketClient.on('auth:success', async () => {
      // Create mock order via API
      try {
        // Ensure only our test online vendor presence exists to avoid receiving events for other orders
        await VendorPresence.deleteMany({ vendorId: { $ne: onlineVendor._id } });

        const response = await request(app)
          .post('/api/dev/orders/mock')
          .set('x-dev-key', 'test-secret')
          .send({
            pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
            drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
            items: [{ title: 'Test Item', qty: 1, price: 100 }],
            fare: 100,
            paymentMethod: 'cod',
            autoAssignVendor: true,
          });

        expect(response.status).toBe(201);
      } catch (error) {
        done(error);
      }
    });

    socketClient.on('order:new', (data) => {
      expect(data.orderId).toBeTruthy();
      expect(data.status).toBe('assigned');
      expect(data.fare).toBe(100);
      expect(data.pickup).toBeDefined();
      expect(data.drop).toBeDefined();
      done();
    });

    setTimeout(() => {
      done(new Error('Timeout waiting for order:new event'));
    }, 5000);
  });
});

describe('Push Notification Integration', () => {
  test('should send push notification when order is assigned', async () => {
    const { getMessaging } = require('../config/firebase');
    // Ensure only the online vendor presence exists so notifications target the expected vendor
    await VendorPresence.deleteMany({ vendorId: { $ne: onlineVendor._id } });
    
    const response = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
        items: [{ title: 'Test Service', qty: 1, price: 500 }],
        fare: 500,
        paymentMethod: 'cod',
        autoAssignVendor: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);

    // Verify Firebase sendMulticast was called
    const messaging = getMessaging();
    expect(messaging.sendMulticast).toHaveBeenCalled();
  });

  test('should handle push notification when no FCM tokens registered', async () => {
    // Create vendor without FCM tokens
    const noTokenVendor = await Vendor.create({
      vendorName: 'No Token Vendor',
      mobile: '9876543212',
      mobileVerified: true,
      fcmTokens: [],
    });

    // Ensure presence for the no-token vendor exists and remove other presences
    await VendorPresence.deleteMany({ vendorId: { $ne: noTokenVendor._id } });
    await VendorPresence.create({
      vendorId: noTokenVendor._id,
      online: true,
      loc: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
      },
    });

    const response = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
        items: [{ title: 'Test Service', qty: 1, price: 200 }],
        fare: 200,
        paymentMethod: 'cod',
        autoAssignVendor: true,
      });

    // Order should still be created even if push fails
    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
  });
});

describe('Order Accept/Reject Flow', () => {
  let testOrder;

  beforeEach(async () => {
    // Create test order assigned to testVendor
    testOrder = await Order.create({
      vendorId: testVendor._id,
      status: 'assigned',
      pickup: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
        address: 'Pickup Location',
      },
      drop: {
        type: 'Point',
        coordinates: [77.6000, 12.9800],
        address: 'Drop Location',
      },
      items: [{ title: 'Test Item', qty: 1, price: 150 }],
      fare: 150,
      paymentMethod: 'cod',
      assignedAt: new Date(),
    });
  });

  test('should accept order successfully', async () => {
    const response = await request(app)
      .post(`/api/orders/${testOrder._id}/accept`)
      .set('Authorization', `Bearer ${testVendorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.status).toBe('accepted');

    // Verify order was updated in database
    const updatedOrder = await Order.findById(testOrder._id);
    expect(updatedOrder.status).toBe('accepted');
    expect(updatedOrder.acceptedAt).toBeTruthy();
  });

  test('should reject order successfully', async () => {
    const response = await request(app)
      .post(`/api/orders/${testOrder._id}/reject`)
      .set('Authorization', `Bearer ${testVendorToken}`)
      .send({ reason: 'Too far away' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.status).toBe('cancelled');

    // Verify order was updated in database
    const updatedOrder = await Order.findById(testOrder._id);
    expect(updatedOrder.status).toBe('cancelled');
    expect(updatedOrder.cancelledAt).toBeTruthy();
    expect(updatedOrder.metadata.rejectionReason).toBe('Too far away');
  });

  test('should not accept order not assigned to vendor', async () => {
    const response = await request(app)
      .post(`/api/orders/${testOrder._id}/accept`)
      .set('Authorization', `Bearer ${onlineVendorToken}`);

    expect(response.status).toBe(403);
    expect(response.body.ok).toBe(false);
  });

  test('should not accept order that is not in assigned status', async () => {
    // Update order to accepted
    testOrder.status = 'accepted';
    await testOrder.save();

    const response = await request(app)
      .post(`/api/orders/${testOrder._id}/accept`)
      .set('Authorization', `Bearer ${testVendorToken}`);

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  test('should get order details', async () => {
    const response = await request(app)
      .get(`/api/orders/${testOrder._id}`)
      .set('Authorization', `Bearer ${testVendorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data._id).toBe(testOrder._id.toString());
    expect(response.body.data.fare).toBe(150);
  });
});

describe('FCM Token Management', () => {
  test('should register FCM token', async () => {
    const response = await request(app)
      .post('/api/vendors/me/fcm-token')
      .set('Authorization', `Bearer ${testVendorToken}`)
      .send({
        token: 'new-fcm-token-456',
        platform: 'ios',
        deviceId: 'ios-device-001',
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.tokenCount).toBeGreaterThan(0);

    // Verify token was added
    const vendor = await Vendor.findById(testVendor._id);
    const hasToken = vendor.fcmTokens.some(t => t.token === 'new-fcm-token-456');
    expect(hasToken).toBe(true);
  });

  test('should update existing FCM token', async () => {
    const response = await request(app)
      .post('/api/vendors/me/fcm-token')
      .set('Authorization', `Bearer ${testVendorToken}`)
      .send({
        token: 'test-fcm-token-123', // Existing token
        platform: 'ios', // Update platform
        deviceId: 'updated-device',
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    // Verify token was updated
    const vendor = await Vendor.findById(testVendor._id);
    const token = vendor.fcmTokens.find(t => t.token === 'test-fcm-token-123');
    expect(token.platform).toBe('ios');
    expect(token.deviceId).toBe('updated-device');
  });

  test('should remove FCM token', async () => {
    const response = await request(app)
      .delete('/api/vendors/me/fcm-token')
      .set('Authorization', `Bearer ${testVendorToken}`)
      .send({
        token: 'test-fcm-token-123',
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    // Verify token was removed
    const vendor = await Vendor.findById(testVendor._id);
    const hasToken = vendor.fcmTokens.some(t => t.token === 'test-fcm-token-123');
    expect(hasToken).toBe(false);
  });

  test('should require authentication for FCM token endpoints', async () => {
    const response = await request(app)
      .post('/api/vendors/me/fcm-token')
      .send({ token: 'test-token' });

    expect(response.status).toBe(401);
  });
});

describe('Auto-Assignment with Presence', () => {
  test('should assign order to online vendor nearby', async () => {
    const response = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
        items: [{ title: 'Test Service', qty: 1, price: 300 }],
        fare: 300,
        paymentMethod: 'online',
        autoAssignVendor: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.order.vendorId).toBeTruthy();
    expect(response.body.data.order.status).toBe('assigned');
  });

  test('should create order with null vendorId when no online vendors', async () => {
    // Remove all presence records
    await VendorPresence.deleteMany({});

    const response = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
        items: [{ title: 'Test Service', qty: 1, price: 400 }],
        fare: 400,
        paymentMethod: 'cod',
        autoAssignVendor: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.order.vendorId).toBeNull();
    expect(response.body.data.order.status).toBe('pending');
  });

  test('should create audit entry for mock order call', async () => {
    const clientRequestId = `test-${Date.now()}`;

    const response = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        clientRequestId,
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
        items: [{ title: 'Test Service', qty: 1, price: 250 }],
        fare: 250,
        paymentMethod: 'wallet',
        autoAssignVendor: true,
      });

    expect(response.status).toBe(201);

    // Verify audit entry was created
    const auditEntry = await MockOrderCall.findOne({ clientRequestId });
    expect(auditEntry).toBeTruthy();
    expect(auditEntry.orderId).toBeTruthy();
    expect(auditEntry.responseStatus).toBe(201);
  });

  test('should handle idempotency for duplicate clientRequestId', async () => {
    const clientRequestId = `idempotent-${Date.now()}`;

    // First request
    const response1 = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        clientRequestId,
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Test Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Test Drop' },
        items: [{ title: 'Test Service', qty: 1, price: 180 }],
        fare: 180,
        paymentMethod: 'cod',
        autoAssignVendor: true,
      });

    expect(response1.status).toBe(201);
    const orderId1 = response1.body.data.order._id;

    // Second request with same clientRequestId
    const response2 = await request(app)
      .post('/api/dev/orders/mock')
      .set('x-dev-key', 'test-secret')
      .send({
        clientRequestId,
        pickup: { lat: 12.9716, lng: 77.5946, address: 'Different Pickup' },
        drop: { lat: 12.9800, lng: 77.6000, address: 'Different Drop' },
        items: [{ title: 'Different Item', qty: 2, price: 300 }],
        fare: 600,
        paymentMethod: 'online',
        autoAssignVendor: true,
      });

    expect(response2.status).toBe(200);
    expect(response2.body.data.order._id).toBe(orderId1);
    expect(response2.body.data.idempotent).toBe(true);
  });
});
