/**
 * Tests for External Vendor Update Endpoint
 * 
 * To run these tests:
 * npm test -- --testNamePattern="External Vendor Update"
 * 
 * Or run all tests:
 * npm test
 * 
 * Make sure to set EXTERNAL_VENDOR_SECRET in your test environment
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const Vendor = require('../models/vendor');

describe('External Vendor Update API', () => {
  let mongoServer;
  const VALID_SECRET = 'test-external-vendor-secret-123';
  const INVALID_SECRET = 'wrong-secret';

  // Set test environment variable
  process.env.EXTERNAL_VENDOR_SECRET = VALID_SECRET;
  process.env.NODE_ENV = 'test';

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Cleanup database connection
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear vendors before each test
    await Vendor.deleteMany({});
  });

  describe('Authentication', () => {
    test('should return 401 when x-vendor-secret header is missing', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .send({ vendorId: 'test-vendor-1' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'missing vendor secret'
      });
    });

    test('should return 401 when x-vendor-secret header is invalid', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', INVALID_SECRET)
        .send({ vendorId: 'test-vendor-1' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'invalid vendor secret'
      });
    });

    test('should accept valid x-vendor-secret header', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send({ vendorId: 'test-vendor-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should return 400 when vendorId is missing', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send({ name: 'Test Vendor' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation error');
      expect(response.body.details).toContain('vendorId is required');
    });

    test('should return 400 when vendorId is empty string', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send({ vendorId: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation error');
      expect(response.body.details).toContain('vendorId cannot be empty');
    });

    test('should return 400 when status is invalid', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send({ 
          vendorId: 'test-vendor-1',
          status: 'invalid-status'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation error');
    });

    test('should accept valid status values', async () => {
      const validStatuses = ['accepted', 'rejected', 'enroute', 'completed', 'cancelled'];
      
      for (const status of validStatuses) {
        const response = await request(app)
          .post('/api/external/vendor-update')
          .set('x-vendor-secret', VALID_SECRET)
          .send({ 
            vendorId: `test-vendor-${status}`,
            status
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Field Mapping', () => {
    test('should map vendorId variations correctly', async () => {
      const variations = [
        { id: 'vendor-1' },
        { vendor_id: 'vendor-2' },
        { vendor_id_str: 'vendor-3' },
        { vendorId: 'vendor-4' }
      ];

      for (const variation of variations) {
        const response = await request(app)
          .post('/api/external/vendor-update')
          .set('x-vendor-secret', VALID_SECRET)
          .send(variation);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.vendorId).toBe(Object.values(variation)[0]);
      }
    });

    test('should map vendor name variations correctly', async () => {
      const testData = [
        { vendorId: 'v1', name: 'Test Name 1' },
        { vendorId: 'v2', vendor_name: 'Test Name 2' },
        { vendorId: 'v3', vendorName: 'Test Name 3' }
      ];

      for (const data of testData) {
        const response = await request(app)
          .post('/api/external/vendor-update')
          .set('x-vendor-secret', VALID_SECRET)
          .send(data);

        expect(response.status).toBe(200);
        
        // Verify vendor was created with correct name
        const vendor = await Vendor.findOne({ vendorId: data.vendorId });
        expect(vendor.vendorName).toBe(Object.values(data)[1]);
      }
    });

    test('should map phone variations correctly', async () => {
      const testData = [
        { vendorId: 'v1', phone: '+1234567890' },
        { vendorId: 'v2', mobile: '+0987654321' },
        { vendorId: 'v3', vendorPhone: '+1122334455' }
      ];

      for (const data of testData) {
        const response = await request(app)
          .post('/api/external/vendor-update')
          .set('x-vendor-secret', VALID_SECRET)
          .send(data);

        expect(response.status).toBe(200);
        
        // Verify vendor was created with correct phone
        const vendor = await Vendor.findOne({ vendorId: data.vendorId });
        expect(vendor.mobile).toBe(Object.values(data)[1]);
      }
    });

    test('should map complex payload with all field variations', async () => {
      const complexPayload = {
        id: 'complex-vendor-123',
        name: 'Complex Vendor Service',
        mobile: '+15551234567',
        addr: '123 Complex Street, Test City',
        service: 'delivery',
        assigned_order: 'order-abc-123',
        vendorStatus: 'accepted'
      };

      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(complexPayload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.vendorId).toBe('complex-vendor-123');
      expect(response.body.upserted).toBe(true);
      
      // Verify all fields were mapped correctly
      const vendor = await Vendor.findOne({ vendorId: 'complex-vendor-123' });
      expect(vendor.vendorName).toBe('Complex Vendor Service');
      expect(vendor.mobile).toBe('+15551234567');
      expect(vendor.businessAddress).toBe('123 Complex Street, Test City');
      expect(vendor.selectedServices).toContain('delivery');
    });
  });

  describe('Database Operations', () => {
    test('should create new vendor when vendorId does not exist', async () => {
      const vendorData = {
        vendorId: 'new-vendor-123',
        vendorName: 'New Vendor Service',
        vendorPhone: '+15551112222',
        vendorAddress: '456 New Street',
        serviceType: 'repair'
      };

      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(vendorData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        vendorId: 'new-vendor-123',
        upserted: true,
        orderUpdated: false
      });

      // Verify vendor was created in database
      const vendor = await Vendor.findOne({ vendorId: 'new-vendor-123' });
      expect(vendor).toBeTruthy();
      expect(vendor.vendorName).toBe('New Vendor Service');
      expect(vendor.mobile).toBe('+15551112222');
      expect(vendor.businessAddress).toBe('456 New Street');
      expect(vendor.selectedServices).toContain('repair');
    });

    test('should update existing vendor when vendorId exists', async () => {
      // Create initial vendor
      await Vendor.create({
        vendorId: 'existing-vendor-456',
        vendorName: 'Original Name',
        mobile: '+15550000000',
        businessAddress: 'Original Address'
      });

      // Update vendor
      const updateData = {
        vendorId: 'existing-vendor-456',
        vendorName: 'Updated Name',
        vendorPhone: '+15551111111',
        vendorAddress: 'Updated Address'
      };

      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        vendorId: 'existing-vendor-456',
        upserted: false,
        orderUpdated: false
      });

      // Verify vendor was updated
      const vendor = await Vendor.findOne({ vendorId: 'existing-vendor-456' });
      expect(vendor.vendorName).toBe('Updated Name');
      expect(vendor.mobile).toBe('+15551111111');
      expect(vendor.businessAddress).toBe('Updated Address');
    });

    test('should handle idempotent requests correctly', async () => {
      const vendorData = {
        vendorId: 'idempotent-vendor-789',
        vendorName: 'Idempotent Vendor',
        vendorPhone: '+15552222222'
      };

      // First request - should create
      const response1 = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(vendorData);

      expect(response1.status).toBe(200);
      expect(response1.body.upserted).toBe(true);

      // Second identical request - should update
      const response2 = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(vendorData);

      expect(response2.status).toBe(200);
      expect(response2.body.upserted).toBe(false);
      expect(response2.body.vendorId).toBe('idempotent-vendor-789');

      // Verify only one vendor exists
      const vendorCount = await Vendor.countDocuments({ vendorId: 'idempotent-vendor-789' });
      expect(vendorCount).toBe(1);
    });
  });

  describe('Order Updates', () => {
    test('should return orderUpdated: false when assignedOrderId provided but Order model not found', async () => {
      const vendorData = {
        vendorId: 'vendor-with-order',
        assignedOrderId: 'nonexistent-order-123',
        status: 'accepted'
      };

      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(vendorData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orderUpdated).toBe(false);
    });

    test('should handle request without assignedOrderId', async () => {
      const vendorData = {
        vendorId: 'vendor-no-order',
        vendorName: 'Vendor Without Order',
        status: 'completed'
      };

      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send(vendorData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orderUpdated).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should return 500 on database connection error', async () => {
      // Close the database connection to simulate an error
      await mongoose.connection.close();

      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send({ vendorId: 'test-vendor' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'internal server error'
      });

      // Reconnect for other tests
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });

  describe('Response Format', () => {
    test('should return proper success response format', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', VALID_SECRET)
        .send({ 
          vendorId: 'format-test-vendor',
          vendorName: 'Format Test'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('vendorId');
      expect(response.body).toHaveProperty('upserted');
      expect(response.body).toHaveProperty('orderUpdated');
      expect(typeof response.body.success).toBe('boolean');
      expect(typeof response.body.vendorId).toBe('string');
      expect(typeof response.body.upserted).toBe('boolean');
      expect(typeof response.body.orderUpdated).toBe('boolean');
    });
  });
});