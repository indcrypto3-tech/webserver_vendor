const request = require('supertest');
const app = require('../server');
const Order = require('../models/order');
const Vendor = require('../models/vendor');
const { testCustomerWebhookConnection } = require('../services/customerWebhookService');

describe('Customer Webhook Integration', () => {
  let testOrder;
  let testVendor;
  const originalWebhookUrl = process.env.CUSTOMER_WEBHOOK_URL;
  
  beforeAll(async () => {
    // Set up test webhook URL for testing
    process.env.CUSTOMER_WEBHOOK_URL = 'https://httpbin.org/post';
  });
  
  afterAll(async () => {
    // Restore original webhook URL
    if (originalWebhookUrl) {
      process.env.CUSTOMER_WEBHOOK_URL = originalWebhookUrl;
    } else {
      delete process.env.CUSTOMER_WEBHOOK_URL;
    }
  });

  beforeEach(async () => {
    // Create test vendor
    testVendor = await Vendor.create({
      vendorId: `test-vendor-${Date.now()}`,
      vendorName: 'Test Webhook Vendor',
      mobile: `+91987654${Math.floor(Math.random() * 10000)}`,
      businessAddress: 'Test Address for Webhooks',
      selectedServices: ['delivery']
    });

    // Create test order
    testOrder = await Order.create({
      customerId: 'webhook-test-customer',
      pickup: {
        type: 'Point',
        coordinates: [77.1025, 28.7041],
        address: '123 Test Street'
      },
      drop: {
        type: 'Point',
        coordinates: [77.1125, 28.7141],
        address: '456 Test Avenue'
      },
      items: [{
        title: 'Webhook Test Service',
        qty: 1,
        price: 100
      }],
      fare: 100,
      paymentMethod: 'cod',
      metadata: {
        orderType: 'service',
        workType: 'test_service',
        customerName: 'Webhook Test Customer',
        customerPhone: '+919876543210'
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testOrder) {
      await Order.findByIdAndDelete(testOrder._id);
    }
    if (testVendor) {
      await Vendor.findByIdAndDelete(testVendor._id);
    }
  });

  describe('POST /api/external/webhook-test', () => {
    it('should test default webhook URL successfully', async () => {
      const response = await request(app)
        .post('/api/external/webhook-test')
        .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successful');
    });

    it('should test custom webhook URL successfully', async () => {
      const response = await request(app)
        .post('/api/external/webhook-test')
        .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
        .send({
          webhookUrl: 'https://httpbin.org/post'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.response).toBeDefined();
    });

    it('should fail with invalid webhook URL', async () => {
      const response = await request(app)
        .post('/api/external/webhook-test')
        .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
        .send({
          webhookUrl: 'invalid-url'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation error');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/external/webhook-test')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('missing vendor secret');
    });
  });

  describe('External Vendor Update with Webhook', () => {
    it('should send webhook when order status changes', async () => {
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
        .send({
          vendorId: testVendor.vendorId,
          assignedOrderId: testOrder._id.toString(),
          status: 'accepted'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orderUpdated).toBe(true);
      expect(response.body.webhookSent).toBeDefined();

      // Verify order was updated
      const updatedOrder = await Order.findById(testOrder._id);
      expect(updatedOrder.status).toBe('assigned'); // 'accepted' maps to 'assigned'
      expect(updatedOrder.vendorId.toString()).toBe(testVendor._id.toString());
    });

    it('should not send webhook when status does not change', async () => {
      // First update to set initial status
      await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
        .send({
          vendorId: testVendor.vendorId,
          assignedOrderId: testOrder._id.toString(),
          status: 'accepted'
        });

      // Second update with same status
      const response = await request(app)
        .post('/api/external/vendor-update')
        .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
        .send({
          vendorId: testVendor.vendorId,
          assignedOrderId: testOrder._id.toString(),
          status: 'accepted' // Same status
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.orderUpdated).toBe(true);
      // Webhook should not be sent for same status
      expect(response.body.webhookSent).toBe(false);
    });
  });

  describe('Webhook Service Integration', () => {
    it('should test webhook connection successfully', async () => {
      const result = await testCustomerWebhookConnection('https://httpbin.org/post');
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response.status).toBe(200);
    });

    it('should handle webhook connection failure', async () => {
      const result = await testCustomerWebhookConnection('https://invalid-webhook-url.com/webhook');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing webhook URL configuration', async () => {
      const originalUrl = process.env.CUSTOMER_WEBHOOK_URL;
      delete process.env.CUSTOMER_WEBHOOK_URL;
      
      const result = await testCustomerWebhookConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No webhook URL configured');
      
      // Restore webhook URL
      if (originalUrl) {
        process.env.CUSTOMER_WEBHOOK_URL = originalUrl;
      }
    });
  });

  describe('Status Mapping', () => {
    const statusMappings = [
      { external: 'accepted', internal: 'assigned' },
      { external: 'enroute', internal: 'in_progress' },
      { external: 'completed', internal: 'completed' },
      { external: 'cancelled', internal: 'cancelled' },
      { external: 'rejected', internal: 'pending' }
    ];

    statusMappings.forEach(({ external, internal }) => {
      it(`should map external status '${external}' to internal status '${internal}'`, async () => {
        const response = await request(app)
          .post('/api/external/vendor-update')
          .set('x-vendor-secret', process.env.EXTERNAL_VENDOR_SECRET || 'dev-external-vendor-secret')
          .send({
            vendorId: testVendor.vendorId,
            assignedOrderId: testOrder._id.toString(),
            status: external
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify order status was mapped correctly
        const updatedOrder = await Order.findById(testOrder._id);
        expect(updatedOrder.status).toBe(internal);
      });
    });
  });
});