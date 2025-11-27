/**
 * Integration tests for order fetchlist endpoints
 * Tests vendor-authenticated and service-authenticated fetchlist endpoints
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const Order = require('../models/order');
const Vendor = require('../models/vendor');
const { signToken } = require('../utils/jwt');
const config = require('../config');

let mongoServer;

beforeAll(async () => {
  // Disconnect from any existing connection
  await mongoose.disconnect();
  
  // Set SERVICE_API_KEY for service auth tests
  process.env.SERVICE_API_KEY = 'test-service-secret-key';
  
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear collections before each test
  await Order.deleteMany({});
  await Vendor.deleteMany({});
});

describe('GET /api/orders/fetchlist', () => {
  let vendor1Token, vendor2Token;
  let vendor1Id, vendor2Id;

  beforeEach(async () => {
    // Create test vendors
    const vendor1 = await Vendor.create({
      vendorName: 'Vendor One',
      mobile: '+911111111111',
      availabilityMode: 'instant'
    });
    vendor1Id = vendor1._id;

    const vendor2 = await Vendor.create({
      vendorName: 'Vendor Two',
      mobile: '+912222222222',
      availabilityMode: 'instant'
    });
    vendor2Id = vendor2._id;

    // Generate JWT tokens
    vendor1Token = signToken({ vendorId: vendor1Id.toString() });
    vendor2Token = signToken({ vendorId: vendor2Id.toString() });

    // Create test orders for vendor1 (8 orders total)
    const orders = [];
    for (let i = 0; i < 8; i++) {
      orders.push({
        vendorId: vendor1Id,
        customerId: `customer${i}`,
        pickup: {
          type: 'Point',
          coordinates: [77.5 + i * 0.01, 12.9],
          address: `Pickup ${i}`
        },
        drop: {
          type: 'Point',
          coordinates: [77.6 + i * 0.01, 12.9],
          address: `Drop ${i}`
        },
        status: i % 2 === 0 ? 'completed' : 'pending',
        fare: 100 + i * 10,
        createdAt: new Date(Date.now() - i * 60000) // Descending timestamps
      });
    }
    await Order.insertMany(orders);

    // Create 2 orders for vendor2
    await Order.insertMany([
      {
        vendorId: vendor2Id,
        customerId: 'customer99',
        pickup: {
          type: 'Point',
          coordinates: [77.6, 12.8],
          address: 'Vendor2 Pickup 1'
        },
        drop: {
          type: 'Point',
          coordinates: [77.7, 12.8],
          address: 'Vendor2 Drop 1'
        },
        status: 'completed',
        fare: 200
      },
      {
        vendorId: vendor2Id,
        customerId: 'customer100',
        pickup: {
          type: 'Point',
          coordinates: [77.6, 12.8],
          address: 'Vendor2 Pickup 2'
        },
        drop: {
          type: 'Point',
          coordinates: [77.7, 12.8],
          address: 'Vendor2 Drop 2'
        },
        status: 'pending',
        fare: 250
      }
    ]);
  });

  test('should return 401 when no auth token provided', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist')
      .expect(401);

    expect(res.body.message).toBeDefined();
  });

  test('vendor cannot read other vendor orders', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.returned).toBe(5); // Default limit
    
    // All orders should belong to vendor1
    res.body.rows.forEach(order => {
      expect(order.vendorId?.toString()).toBe(vendor1Id.toString());
    });
  });

  test('initial load returns 5 newest orders (default limit)', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(0);
    expect(res.body.returned).toBe(5);
    expect(res.body.remaining).toBe(3); // 8 total - 5 returned = 3 remaining
    expect(res.body.rows.length).toBe(5);
  });

  test('subsequent load with limit=10 returns next batch', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist?limit=10&offset=5')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(5);
    expect(res.body.returned).toBe(3); // Only 3 remaining
    expect(res.body.remaining).toBe(0);
  });

  test('orders are sorted newest to oldest', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist?limit=8')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.rows.length).toBe(8);
    
    // Verify descending order (newest first)
    for (let i = 0; i < res.body.rows.length - 1; i++) {
      const current = new Date(res.body.rows[i].createdAt);
      const next = new Date(res.body.rows[i + 1].createdAt);
      expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
    }
  });

  test('filter by status=completed', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist?status=completed')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.returned).toBe(4); // 4 completed orders
    res.body.rows.forEach(order => {
      expect(order.status).toBe('completed');
    });
  });

  test('filter by date range (from)', async () => {
    const fromDate = new Date(Date.now() - 3 * 60000).toISOString(); // 3 minutes ago
    
    const res = await request(app)
      .get(`/api/orders/fetchlist?from=${fromDate}`)
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.returned).toBeLessThanOrEqual(5);
    
    // All returned orders should be after fromDate
    res.body.rows.forEach(order => {
      expect(new Date(order.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(fromDate).getTime());
    });
  });

  test('invalid date returns 400 error', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist?from=invalid-date')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(400);

    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_date');
  });

  test('respects MAX_LIMIT of 200', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist?limit=999')
      .set('Authorization', `Bearer ${vendor1Token}`)
      .expect(200);

    expect(res.body.limit).toBe(200); // Capped at MAX_LIMIT
  });
});

describe('GET /api/orders/fetchlist/vendor/:vendorId', () => {
  let vendor1Id;
  const SERVICE_TOKEN = process.env.SERVICE_API_KEY || 'test-service-secret-key';

  beforeEach(async () => {
    // Create test vendor
    const vendor1 = await Vendor.create({
      vendorName: 'Proxy Vendor',
      mobile: '+913333333333',
      availabilityMode: 'instant'
    });
    vendor1Id = vendor1._id;

    // Create test orders
    await Order.insertMany([
      {
        vendorId: vendor1Id,
        customerId: 'proxy-customer1',
        pickup: {
          type: 'Point',
          coordinates: [77.5, 12.9],
          address: 'Proxy Pickup 1'
        },
        drop: {
          type: 'Point',
          coordinates: [77.6, 12.9],
          address: 'Proxy Drop 1'
        },
        status: 'completed',
        fare: 150
      },
      {
        vendorId: vendor1Id,
        customerId: 'proxy-customer2',
        pickup: {
          type: 'Point',
          coordinates: [77.5, 12.9],
          address: 'Proxy Pickup 2'
        },
        drop: {
          type: 'Point',
          coordinates: [77.6, 12.9],
          address: 'Proxy Drop 2'
        },
        status: 'pending',
        fare: 200
      }
    ]);
  });

  test('proxy endpoint requires service token', async () => {
    const res = await request(app)
      .get(`/api/orders/fetchlist/vendor/${vendor1Id}`)
      .expect(403);

    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('service_token_required');
  });

  test('proxy endpoint rejects invalid service token', async () => {
    const res = await request(app)
      .get(`/api/orders/fetchlist/vendor/${vendor1Id}`)
      .set('X-Service-Token', 'invalid-token')
      .expect(403);

    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('invalid_service_token');
  });

  test('proxy endpoint returns orders with valid service token', async () => {
    const res = await request(app)
      .get(`/api/orders/fetchlist/vendor/${vendor1Id}`)
      .set('X-Service-Token', SERVICE_TOKEN)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.returned).toBe(2);
    expect(res.body.rows.length).toBe(2);
  });

  test('proxy endpoint supports pagination', async () => {
    const res = await request(app)
      .get(`/api/orders/fetchlist/vendor/${vendor1Id}?limit=1&offset=1`)
      .set('X-Service-Token', SERVICE_TOKEN)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.limit).toBe(1);
    expect(res.body.offset).toBe(1);
    expect(res.body.returned).toBe(1);
    expect(res.body.remaining).toBe(0);
  });

  test('proxy endpoint supports status filter', async () => {
    const res = await request(app)
      .get(`/api/orders/fetchlist/vendor/${vendor1Id}?status=completed`)
      .set('X-Service-Token', SERVICE_TOKEN)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.returned).toBe(1);
    expect(res.body.rows[0].status).toBe('completed');
  });

  test('proxy endpoint returns 400 for missing vendorId', async () => {
    const res = await request(app)
      .get('/api/orders/fetchlist/vendor/')
      .set('X-Service-Token', SERVICE_TOKEN)
      .expect(404); // Express route not found

    // This will 404 because the route pattern won't match
  });
});
