// Ensure test environment variables and in-memory MongoDB are initialized
process.env.NODE_ENV = 'test';
process.env.CUSTOMER_SERVER_SECRET = 'test-customer-secret';
require('./setup');

const request = require('supertest');
const app = require('../server');
const Order = require('../models/order');
const Vendor = require('../models/vendor');
const VendorPresence = require('../models/vendorPresence');

describe('External Orders API', () => {
  const validOrderData = {
    customerId: 'customer123',
    customerName: 'John Doe',
    customerPhone: '+1234567890',
    customerAddress: '123 Service Street, Bangalore',
    workType: 'electrician',
    description: 'Fix electrical outlet in kitchen',
    location: {
      latitude: 12.9716,
      longitude: 77.5946
    },
    estimatedPrice: 300,
    urgency: 'normal'
  };

  describe('POST /api/external/orders', () => {
    describe('Authentication', () => {
      it('should return 401 when x-customer-secret header is missing', async () => {
        const response = await request(app)
          .post('/api/external/orders')
          .send(validOrderData);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          ok: false,
          error: 'Authentication required: Missing x-customer-secret header'
        });
      });

      it('should return 401 when x-customer-secret header is invalid', async () => {
        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'invalid-secret')
          .send(validOrderData);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          ok: false,
          error: 'Authentication failed: Invalid x-customer-secret'
        });
      });

      it('should accept valid x-customer-secret header', async () => {
        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(validOrderData);

        // Should not be a 401 error
        expect(response.status).not.toBe(401);
      });
    });

    describe('Order Creation', () => {
      beforeEach(async () => {
        // Create some test vendors for broadcast
        const vendor1 = await Vendor.create({
          mobile: '+919876543210',
          vendorName: 'Test Vendor 1',
          gender: 'male'
        });
        
        const vendor2 = await Vendor.create({
          mobile: '+919876543211',
          vendorName: 'Test Vendor 2', 
          gender: 'female'
        });

        // Set vendors as online
        await VendorPresence.create({
          vendorId: vendor1._id,
          online: true,
          loc: { type: 'Point', coordinates: [77.5946, 12.9716] }
        });

        await VendorPresence.create({
          vendorId: vendor2._id,
          online: true,
          loc: { type: 'Point', coordinates: [77.6245, 12.9352] }
        });
      });

      it('should create order successfully with valid data', async () => {
        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(validOrderData);

        expect(response.status).toBe(201);
        expect(response.body.ok).toBe(true);
        expect(response.body.message).toBe('Order created successfully');
        expect(response.body.data).toMatchObject({
          orderId: expect.any(String),
          status: 'pending',
          broadcast: expect.objectContaining({
            success: expect.any(Boolean),
            notifiedVendors: expect.any(Number),
            failedNotifications: expect.any(Number)
          })
        });

        // Verify order was created in database
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder).toBeTruthy();
        expect(createdOrder.customerId).toBe('customer123');
        expect(createdOrder.status).toBe('pending');
        expect(createdOrder.fare).toBe(300);
        expect(createdOrder.items).toHaveLength(1); // Service orders have single item
        expect(createdOrder.items[0].title).toContain('electrician'); // Contains work type
        expect(createdOrder.metadata.workType).toBe('electrician');
        expect(createdOrder.metadata.customerName).toBe('John Doe');
      });

      it('should return 400 for invalid order data', async () => {
        const invalidData = { ...validOrderData };
        delete invalidData.customerName; // Remove required field

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.ok).toBe(false);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toContain('customerName is required');
      });

      it('should handle service orders with estimated price', async () => {
        const serviceData = {
          ...validOrderData,
          estimatedPrice: 500
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(serviceData);

        expect(response.status).toBe(201);
        
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder.fare).toBe(500);
      });

      it('should create service orders with default payment method', async () => {
        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(validOrderData);

        expect(response.status).toBe(201);
        
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder.paymentMethod).toBe('cod'); // Default for service orders
        expect(createdOrder.metadata.orderType).toBe('service');
      });

      it('should handle urgency and work type correctly', async () => {
        const dataWithUrgency = {
          ...validOrderData,
          urgency: 'urgent',
          workType: 'plumber'
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(dataWithUrgency);

        expect(response.status).toBe(201);
        
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder.metadata.urgency).toBe('urgent');
        expect(createdOrder.metadata.workType).toBe('plumber');
        expect(createdOrder.metadata.orderType).toBe('service');
      });
    });

    describe('Vendor Broadcasting', () => {
      it('should broadcast to online vendors when order is created', async () => {
        // Create online vendor
        const vendor = await Vendor.create({
          mobile: '+919876543212',
          vendorName: 'Online Vendor',
          gender: 'male'
        });

        await VendorPresence.create({
          vendorId: vendor._id,
          online: true,
          loc: { type: 'Point', coordinates: [77.5946, 12.9716] }
        });

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(validOrderData);

        expect(response.status).toBe(201);
        expect(response.body.data.broadcast.success).toBe(true);
        // Note: notifiedVendors may be 0 in test environment due to FCM mocking
      });

      it('should handle case when no vendors are online', async () => {
        // No online vendors present
        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(validOrderData);

        expect(response.status).toBe(201);
        expect(response.body.data.broadcast.notifiedVendors).toBe(0);
        
        // Order should still be created
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder.status).toBe('pending');
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid coordinates gracefully', async () => {
        const invalidCoordinates = {
          ...validOrderData,
          location: { ...validOrderData.location, latitude: 999 } // Invalid latitude
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(invalidCoordinates);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });

      it('should handle missing required fields', async () => {
        const missingFields = {
          customerId: 'test123'
          // Missing all other required fields
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(missingFields);

        expect(response.status).toBe(400);
        expect(response.body.details).toEqual(
          expect.arrayContaining([
            expect.stringContaining('customerName is required'),
            expect.stringContaining('workType is required'),
            expect.stringContaining('location is required')
          ])
        );
      });
    });
  });
});