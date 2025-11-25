const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const VendorPresence = require('../models/vendorPresence');
const Vendor = require('../models/vendor');
const presenceRoutes = require('../routes/presence');
const { signToken } = require('../utils/jwt');

// Setup test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SKIP_RATE_LIMIT = 'true'; // Skip rate limiting in most tests
process.env.PRESENCE_TTL_SECONDS = '90'; // 90 seconds TTL

app.use('/api/vendors', presenceRoutes);

// Import test setup
require('./setup');

describe('Vendor Presence API', () => {
  let vendor1, vendor2, token1, token2;

  beforeEach(async () => {
    // Create test vendors
    vendor1 = await Vendor.create({
      vendorName: 'Vendor One',
      mobile: '9876543210',
      mobileVerified: true,
    });

    vendor2 = await Vendor.create({
      vendorName: 'Vendor Two',
      mobile: '9876543211',
      mobileVerified: true,
    });

    // Generate tokens
    token1 = signToken({ vendorId: vendor1._id, mobile: vendor1.mobile });
    token2 = signToken({ vendorId: vendor2._id, mobile: vendor2.mobile });

    // Clear presence collection
    await VendorPresence.deleteMany({});
  });

  describe('POST /api/vendors/me/presence - Authentication', () => {
    it('should return 401 without authorization token', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .send({ online: true });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', 'Bearer invalid_token')
        .send({ online: true });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/vendors/me/presence - Validation', () => {
    it('should reject request without online field', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Validation failed');
      expect(res.body.details).toContain('online must be a boolean value');
    });

    it('should reject invalid online value', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: 'yes' });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('online must be a boolean value');
    });

    it('should reject invalid latitude', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 100, lng: 77.59 });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lat must be a number between -90 and 90');
    });

    it('should reject invalid longitude', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 200 });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lng must be a number between -180 and 180');
    });

    it('should reject negative accuracy', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59, accuracy: -10 });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('accuracy must be a non-negative number');
    });

    it('should reject lat without lng', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97 });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lat and lng must be provided together');
    });

    it('should reject lng without lat', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lng: 77.59 });

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lat and lng must be provided together');
    });
  });

  describe('POST /api/vendors/me/presence - Online with Location', () => {
    it('should create presence record when vendor goes online with location', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          online: true,
          lat: 12.9715987,
          lng: 77.594566,
          accuracy: 10,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.vendorId).toBe(vendor1._id.toString());
      expect(res.body.data.online).toBe(true);
      expect(res.body.data.location).toBeDefined();
      expect(res.body.data.location.lat).toBe(12.9715987);
      expect(res.body.data.location.lng).toBe(77.594566);
      expect(res.body.data.location.accuracy).toBe(10);
      expect(res.body.data.expiresAt).toBeDefined();
      expect(res.body.data.ttlSeconds).toBe(90);

      // Verify in database
      const presence = await VendorPresence.findOne({ vendorId: vendor1._id });
      expect(presence).toBeDefined();
      expect(presence.online).toBe(true);
      expect(presence.loc.coordinates).toEqual([77.594566, 12.9715987]);
      expect(presence.accuracy).toBe(10);
    });

    it('should update existing presence record with new location', async () => {
      // First update
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59, accuracy: 10 });

      // Second update with different location
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 13.00, lng: 77.60, accuracy: 15 });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.location.lat).toBe(13.00);
      expect(res.body.data.location.lng).toBe(77.60);
      expect(res.body.data.location.accuracy).toBe(15);

      // Verify only one presence record exists
      const presences = await VendorPresence.find({ vendorId: vendor1._id });
      expect(presences.length).toBe(1);
    });

    it('should update expiresAt timestamp on repeated heartbeats', async () => {
      // First heartbeat
      const res1 = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59 });

      const firstExpiresAt = new Date(res1.body.data.expiresAt);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second heartbeat
      const res2 = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59 });

      const secondExpiresAt = new Date(res2.body.data.expiresAt);

      expect(secondExpiresAt.getTime()).toBeGreaterThan(firstExpiresAt.getTime());
    });
  });

  describe('POST /api/vendors/me/presence - Online without Location', () => {
    it('should create presence record without location when coords not provided', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.online).toBe(true);
      expect(res.body.data.location).toBeNull();

      // Verify in database
      const presence = await VendorPresence.findOne({ vendorId: vendor1._id });
      expect(presence).toBeDefined();
      expect(presence.online).toBe(true);
      expect(presence.loc.coordinates).toBeUndefined();
    });

    it('should preserve last location if new heartbeat has no coords', async () => {
      // First: set online with location
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59, accuracy: 10 });

      // Second: heartbeat without location
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);

      // Database should still have the location (not overwritten)
      const presence = await VendorPresence.findOne({ vendorId: vendor1._id });
      expect(presence.loc.coordinates).toEqual([77.59, 12.97]);
      expect(presence.accuracy).toBe(10);
    });
  });

  describe('POST /api/vendors/me/presence - Offline', () => {
    it('should delete presence record when vendor goes offline', async () => {
      // First go online
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59 });

      // Verify presence exists
      let presence = await VendorPresence.findOne({ vendorId: vendor1._id });
      expect(presence).toBeDefined();

      // Go offline
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.online).toBe(false);
      expect(res.body.data.message).toContain('offline');

      // Verify presence deleted
      presence = await VendorPresence.findOne({ vendorId: vendor1._id });
      expect(presence).toBeNull();
    });

    it('should handle offline request when vendor was not online', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: false });

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.online).toBe(false);
    });
  });

  describe('GET /api/vendors/me/presence', () => {
    it('should return offline status when no presence record exists', async () => {
      const res = await request(app)
        .get('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.online).toBe(false);
      expect(res.body.data.location).toBeNull();
    });

    it('should return current presence status when vendor is online', async () => {
      // Set vendor online
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59, accuracy: 10 });

      // Get presence
      const res = await request(app)
        .get('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.online).toBe(true);
      expect(res.body.data.location.lat).toBe(12.97);
      expect(res.body.data.location.lng).toBe(77.59);
      expect(res.body.data.location.accuracy).toBe(10);
      expect(res.body.data.expiresAt).toBeDefined();
    });
  });

  describe('GET /api/vendors/presence/online', () => {
    it('should return all online vendors', async () => {
      // Set vendor1 online
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59 });

      // Set vendor2 online
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token2}`)
        .send({ online: true, lat: 13.00, lng: 77.60 });

      // Get all online vendors
      const res = await request(app)
        .get('/api/vendors/presence/online')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    it('should return empty array when no vendors are online', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/online')
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.count).toBe(0);
    });
  });

  describe('GET /api/vendors/presence/nearby - Geospatial Queries', () => {
    beforeEach(async () => {
      // Set vendor1 online at location A (Bangalore)
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.9715987, lng: 77.594566 });

      // Set vendor2 online at location B (far from A)
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token2}`)
        .send({ online: true, lat: 13.1, lng: 77.9 });
    });

    it('should find vendors near a specific location', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/nearby')
        .query({ lat: 12.97, lng: 77.59, maxDistance: 5000 })
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.searchRadius).toBe(5000);
    });

    it('should use default maxDistance when not provided', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/nearby')
        .query({ lat: 12.97, lng: 77.59 })
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.searchRadius).toBe(5000); // default
    });

    it('should reject request without lat', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/nearby')
        .query({ lng: 77.59 })
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lat and lng query parameters are required');
    });

    it('should reject request without lng', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/nearby')
        .query({ lat: 12.97 })
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lat and lng query parameters are required');
    });

    it('should validate latitude range', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/nearby')
        .query({ lat: 100, lng: 77.59 })
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lat must be a number between -90 and 90');
    });

    it('should validate longitude range', async () => {
      const res = await request(app)
        .get('/api/vendors/presence/nearby')
        .query({ lat: 12.97, lng: 200 })
        .set('Authorization', `Bearer ${token1}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toContain('lng must be a number between -180 and 180');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Enable rate limiting for this test suite
      process.env.SKIP_RATE_LIMIT = 'false';
    });

    afterEach(() => {
      // Disable rate limiting after tests
      process.env.SKIP_RATE_LIMIT = 'true';
    });

    it('should enforce rate limit on presence updates', async () => {
      // Create a new app instance with rate limiting enabled
      const rateLimitApp = express();
      rateLimitApp.use(express.json());
      rateLimitApp.use('/api/vendors', presenceRoutes);

      // Make multiple rapid requests (more than 1 per second)
      const requests = [];
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(rateLimitApp)
            .post('/api/vendors/me/presence')
            .set('Authorization', `Bearer ${token1}`)
            .send({ online: true })
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter((res) => res.statusCode === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited response should have proper error message
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.ok).toBe(false);
        expect(rateLimitedResponses[0].body.error).toContain('Too many');
      }
    }, 10000); // Increase timeout for rate limit tests
  });

  describe('TTL Behavior', () => {
    it('should set expiresAt to current time + TTL', async () => {
      const beforeRequest = Date.now();

      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59 });

      const afterRequest = Date.now();

      expect(res.statusCode).toBe(200);
      const expiresAt = new Date(res.body.data.expiresAt).getTime();
      const expectedExpiry = beforeRequest + 90000; // 90 seconds

      // Allow 5 second margin for test execution time
      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 5000);
      expect(expiresAt).toBeLessThanOrEqual(afterRequest + 90000 + 5000);
    });

    it('should include TTL seconds in response', async () => {
      const res = await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.ttlSeconds).toBe(90);
    });
  });

  describe('Multiple Vendors Independence', () => {
    it('should maintain independent presence records for different vendors', async () => {
      // Vendor 1 goes online
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: true, lat: 12.97, lng: 77.59 });

      // Vendor 2 goes online
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token2}`)
        .send({ online: true, lat: 13.00, lng: 77.60 });

      // Verify both presence records exist
      const presence1 = await VendorPresence.findOne({ vendorId: vendor1._id });
      const presence2 = await VendorPresence.findOne({ vendorId: vendor2._id });

      expect(presence1).toBeDefined();
      expect(presence2).toBeDefined();
      expect(presence1.vendorId.toString()).not.toBe(presence2.vendorId.toString());

      // Vendor 1 goes offline
      await request(app)
        .post('/api/vendors/me/presence')
        .set('Authorization', `Bearer ${token1}`)
        .send({ online: false });

      // Verify only vendor 1's presence is deleted
      const afterPresence1 = await VendorPresence.findOne({ vendorId: vendor1._id });
      const afterPresence2 = await VendorPresence.findOne({ vendorId: vendor2._id });

      expect(afterPresence1).toBeNull();
      expect(afterPresence2).toBeDefined();
    });
  });
});
