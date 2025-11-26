const request = require('supertest');
const express = require('express');
const Order = require('../models/order');
const Vendor = require('../models/vendor');
const orderRoutes = require('../routes/orders');
const { signToken } = require('../utils/jwt');
const { generateOTP, hashOTP } = require('../utils/otpHelper');

// Setup test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/orders', orderRoutes);

// Import test setup
require('./setup');

describe('Module 3: Payment & OTP Endpoints', () => {
  let vendor;
  let vendorToken;
  let testOrder;

  beforeEach(async () => {
    // Create test vendor
    vendor = await Vendor.create({
      vendorName: 'Test Vendor',
      mobile: '9876543210',
      mobileVerified: true,
      gender: 'male',
      businessName: 'Test Business',
      businessAddress: '123 Test St',
      businessType: 'Testing',
      selectedServices: ['Service1'],
      fcmTokens: [{ token: 'test-fcm-token-123', deviceId: 'test-device', platform: 'android' }],
    });

    vendorToken = signToken({ vendorId: vendor._id, mobile: vendor.mobile });

    // Create test order
    testOrder = await Order.create({
      customerId: 'customer123',
      vendorId: vendor._id,
      pickup: {
        type: 'Point',
        coordinates: [77.1025, 28.7041],
        address: 'Pickup Location',
      },
      drop: {
        type: 'Point',
        coordinates: [77.2167, 28.6139],
        address: 'Drop Location',
      },
      items: [{ title: 'Item 1', qty: 1, price: 100 }],
      fare: 100,
      paymentMethod: 'cod',
      status: 'accepted',
    });
  });

  describe('POST /api/orders/:orderId/payment-request', () => {
    it('should create payment request successfully', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: 150,
          currency: 'INR',
          notes: 'Additional charges',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.paymentRequestId).toBeDefined();
      expect(typeof res.body.paymentRequestId).toBe('string');

      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentRequests).toHaveLength(1);
      expect(updatedOrder.paymentRequests[0].amount).toBe(150);
      expect(updatedOrder.paymentRequests[0].currency).toBe('INR');
      expect(updatedOrder.paymentRequests[0].notes).toBe('Additional charges');
      expect(updatedOrder.paymentRequests[0].status).toBe('requested');
      expect(updatedOrder.status).toBe('payment_requested');
    });

    it('should auto-confirm payment when autoConfirm=true', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: 200,
          currency: 'INR',
          notes: 'Auto confirm test',
          autoConfirm: true,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.autoConfirmed).toBe(true);
      expect(res.body.paymentRequest).toBeDefined();
      expect(res.body.paymentRequest.status).toBe('confirmed');
      expect(res.body.paymentRequest.confirmedAt).toBeDefined();

      // Verify order status
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('payment_confirmed');
      expect(updatedOrder.paymentRequests[0].status).toBe('confirmed');
      expect(updatedOrder.paymentRequests[0].confirmedAt).toBeDefined();
    });

    it('should default to INR currency when not provided', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: 100,
        });

      expect(res.statusCode).toBe(200);
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentRequests[0].currency).toBe('INR');
    });

    it('should reject invalid amount (zero)', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: 0,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_amount');
    });

    it('should reject invalid amount (negative)', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: -50,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_amount');
    });

    it('should reject invalid amount (not a number)', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: 'invalid',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_amount');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/orders/${fakeOrderId}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          amount: 100,
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('order_not_found');
    });

    it('should allow multiple payment requests on same order', async () => {
      // First request
      await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ amount: 100 });

      // Second request
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ amount: 50 });

      expect(res.statusCode).toBe(200);

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.paymentRequests).toHaveLength(2);
    });
  });

  describe('POST /api/orders/:orderId/request-otp', () => {
    it('should create OTP for arrival purpose', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          purpose: 'arrival',
          ttlSeconds: 300,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.otpId).toBeDefined();
      expect(res.body.sent).toBeDefined();

      // In test mode, devCode should be returned
      if (process.env.NODE_ENV !== 'production') {
        expect(res.body.devCode).toBeDefined();
        expect(res.body.devCode).toMatch(/^\d{6}$/);
      }

      // Verify OTP stored in order
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.otp.otpId).toBe(res.body.otpId);
      expect(updatedOrder.otp.purpose).toBe('arrival');
      expect(updatedOrder.otp.codeHash).toBeDefined();
      expect(updatedOrder.otp.attempts).toBe(0);
      expect(updatedOrder.otp.verified).toBe(false);
    });

    it('should create OTP for completion purpose', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          purpose: 'completion',
        });

      expect(res.statusCode).toBe(200);
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.otp.purpose).toBe('completion');
    });

    it('should use default TTL of 300 seconds when not provided', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(200);

      const updatedOrder = await Order.findById(testOrder._id);
      const createdAt = new Date(updatedOrder.otp.createdAt);
      const expiresAt = new Date(updatedOrder.otp.expiresAt);
      const ttl = (expiresAt - createdAt) / 1000;

      expect(ttl).toBeCloseTo(300, 0);
    });

    it('should reject if OTP already exists and not expired', async () => {
      // First OTP request
      await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'arrival' });

      // Second request should fail
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'arrival' });

      expect(res.statusCode).toBe(429);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('otp_already_sent');
      expect(res.body.expiresAt).toBeDefined();
    });

    it('should allow new OTP after previous one expired', async () => {
      // Create expired OTP manually
      const expiredOtpCode = generateOTP();
      const expiredOtpHash = await hashOTP(expiredOtpCode);
      await Order.findByIdAndUpdate(testOrder._id, {
        $set: {
          otp: {
            otpId: 'old-otp-id',
            codeHash: expiredOtpHash,
            purpose: 'arrival',
            createdAt: new Date(Date.now() - 400000),
            expiresAt: new Date(Date.now() - 10000), // Expired
            attempts: 0,
            verified: false,
          },
        },
      });

      // Request new OTP
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'arrival' });

      expect(res.statusCode).toBe(200);
      expect(res.body.otpId).not.toBe('old-otp-id');
    });

    it('should reject invalid purpose', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          purpose: 'invalid_purpose',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_purpose');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/orders/${fakeOrderId}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'arrival' });

      expect(res.statusCode).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('order_not_found');
    });
  });

  describe('POST /api/orders/:orderId/verify-otp', () => {
    let otpCode;

    beforeEach(async () => {
      // Request OTP first
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'arrival' });

      otpCode = res.body.devCode;
    });

    it('should verify correct OTP and update status to arrival_confirmed', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: otpCode,
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.verified).toBe(true);
      expect(res.body.status).toBe('arrival_confirmed');

      // Verify order status updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('arrival_confirmed');
      expect(updatedOrder.otp.verified).toBe(true);
    });

    it('should verify completion OTP and update status to completed', async () => {
      // Request completion OTP
      const res1 = await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'completion' });

      const completionOtp = res1.body.devCode;

      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: completionOtp,
          purpose: 'completion',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('completed');

      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('completed');
      expect(updatedOrder.completedAt).toBeDefined();
    });

    it('should reject incorrect OTP', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: '999999',
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_otp');

      // Verify attempts incremented
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.otp.attempts).toBe(1);
    });

    it('should reject when OTP expired', async () => {
      // Manually expire the OTP
      await Order.findByIdAndUpdate(testOrder._id, {
        $set: {
          'otp.expiresAt': new Date(Date.now() - 1000),
        },
      });

      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: otpCode,
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(410);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('otp_expired');
    });

    it('should reject after too many attempts', async () => {
      // Set attempts to max
      await Order.findByIdAndUpdate(testOrder._id, {
        $set: {
          'otp.attempts': 5,
        },
      });

      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: otpCode,
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(429);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('too_many_attempts');
    });

    it('should reject when purpose mismatch', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: otpCode,
          purpose: 'completion', // OTP was for 'arrival'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('purpose_mismatch');
    });

    it('should reject when no OTP exists', async () => {
      // Create order without OTP
      const newOrder = await Order.create({
        customerId: 'customer456',
        vendorId: vendor._id,
        pickup: {
          type: 'Point',
          coordinates: [77.1025, 28.7041],
          address: 'Pickup',
        },
        drop: {
          type: 'Point',
          coordinates: [77.2167, 28.6139],
          address: 'Drop',
        },
        items: [{ title: 'Item', qty: 1, price: 100 }],
        fare: 100,
        paymentMethod: 'cod',
        status: 'accepted',
      });

      const res = await request(app)
        .post(`/api/orders/${newOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: '123456',
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('no_otp');
    });

    it('should reject invalid OTP format', async () => {
      const res = await request(app)
        .post(`/api/orders/${testOrder._id}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: null,
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_otp');
    });

    it('should return 404 for non-existent order', async () => {
      const fakeOrderId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/orders/${fakeOrderId}/verify-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          otp: '123456',
          purpose: 'arrival',
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('order_not_found');
    });
  });

  describe('Regression: Existing Endpoints', () => {
    it('GET /api/orders/:orderId should return payment requests and OTP', async () => {
      // Add payment request and OTP
      await request(app)
        .post(`/api/orders/${testOrder._id}/payment-request`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ amount: 100 });

      await request(app)
        .post(`/api/orders/${testOrder._id}/request-otp`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ purpose: 'arrival' });

      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.paymentRequests).toBeDefined();
      expect(res.body.data.paymentRequests).toHaveLength(1);
      expect(res.body.data.otp).toBeDefined();
      expect(res.body.data.otp.otpId).toBeDefined();
      // codeHash should not be exposed
      expect(res.body.data.otp.codeHash).toBeUndefined();
    });

    it('GET /api/orders should still work with new status values', async () => {
      // Update order to new status
      await Order.findByIdAndUpdate(testOrder._id, {
        $set: { status: 'payment_requested' },
      });

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });
});
