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
    pickup: {
      lat: 12.9716,
      lng: 77.5946,
      address: '123 Pickup Street, Bangalore'
    },
    drop: {
      lat: 12.9352,
      lng: 77.6245,
      address: '456 Drop Avenue, Bangalore'
    },
    items: [
      { title: 'Pizza Margherita', qty: 2, price: 250 },
      { title: 'Coca Cola', qty: 1, price: 50 }
    ],
    fare: 300,
    paymentMethod: 'cod',
    customerNotes: 'Please call before delivery'
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
        expect(createdOrder.items).toHaveLength(2);
      });

      it('should return 400 for invalid order data', async () => {
        const invalidData = { ...validOrderData };
        delete invalidData.pickup; // Remove required field

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body.ok).toBe(false);
        expect(response.body.error).toBe('Order validation failed');
        expect(response.body.details).toContain('pickup location is required');
      });

      it('should handle scheduled orders', async () => {
        const scheduledData = {
          ...validOrderData,
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(scheduledData);

        expect(response.status).toBe(201);
        
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder.scheduledAt).toBeTruthy();
      });

      it('should accept different payment methods', async () => {
        const paymentMethods = ['cod', 'online', 'wallet'];
        
        for (const method of paymentMethods) {
          const orderData = { ...validOrderData, paymentMethod: method };
          
          const response = await request(app)
            .post('/api/external/orders')
            .set('x-customer-secret', 'test-customer-secret')
            .send(orderData);

          expect(response.status).toBe(201);
          
          const createdOrder = await Order.findById(response.body.data.orderId);
          expect(createdOrder.paymentMethod).toBe(method);
        }
      });

      it('should handle metadata correctly', async () => {
        const dataWithMetadata = {
          ...validOrderData,
          metadata: { 
            source: 'customer-app',
            campaign: 'discount-20',
            referral: 'FRIEND123'
          }
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(dataWithMetadata);

        expect(response.status).toBe(201);
        
        const createdOrder = await Order.findById(response.body.data.orderId);
        expect(createdOrder.metadata.source).toBe('customer-app');
        expect(createdOrder.metadata.campaign).toBe('discount-20');
        expect(createdOrder.metadata.referral).toBe('FRIEND123');
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
        const invalidCoords = {
          ...validOrderData,
          pickup: { ...validOrderData.pickup, lat: 999 } // Invalid latitude
        };

        const response = await request(app)
          .post('/api/external/orders')
          .set('x-customer-secret', 'test-customer-secret')
          .send(invalidCoords);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Order validation failed');
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
            expect.stringContaining('pickup location is required'),
            expect.stringContaining('drop location is required')
          ])
        );
      });
    });
  });
});