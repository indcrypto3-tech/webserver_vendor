const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const Vendor = require('../models/vendor');
const Order = require('../models/order');
const { signToken } = require('../utils/jwt');

let mongoServer;
let vendor1, vendor2;
let token1, token2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections
  await Vendor.deleteMany({});
  await Order.deleteMany({});

  // Create test vendors
  vendor1 = await Vendor.create({
    vendorName: 'Test Vendor 1',
    mobile: '1234567890',
    mobileVerified: true,
    gender: 'male',
    businessName: 'Test Business 1',
    businessAddress: 'Test Address 1',
    selectedServices: ['Plumbing']
  });

  vendor2 = await Vendor.create({
    vendorName: 'Test Vendor 2',
    mobile: '9876543210',
    mobileVerified: true,
    gender: 'female',
    businessName: 'Test Business 2',
    businessAddress: 'Test Address 2',
    selectedServices: ['Electrical']
  });

  // Generate tokens
  token1 = signToken({ vendorId: vendor1._id.toString() });
  token2 = signToken({ vendorId: vendor2._id.toString() });
});

describe('Earnings Module', () => {
  describe('GET /api/earnings/summary', () => {
    test('should return zeros when no confirmed payment requests exist', async () => {
      const res = await request(app)
        .get('/api/earnings/summary')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.summary).toEqual({
        currency: 'INR',
        totalToday: 0,
        totalMonth: 0,
        totalAllTime: 0,
        pending: 0
      });
    });

    test('should compute totalToday, totalMonth, totalAllTime correctly', async () => {
      const now = new Date();
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      // Create orders with confirmed payments
      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust1',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 1', qty: 1, price: 100 }],
        fare: 100,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay1',
            amount: 100,
            currency: 'INR',
            status: 'confirmed',
            createdAt: today,
            confirmedAt: today
          }
        ]
      });

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust2',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 2', qty: 1, price: 150 }],
        fare: 150,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay2',
            amount: 150,
            currency: 'INR',
            status: 'confirmed',
            createdAt: yesterday,
            confirmedAt: yesterday
          }
        ]
      });

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust3',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 3', qty: 1, price: 200 }],
        fare: 200,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay3',
            amount: 200,
            currency: 'INR',
            status: 'confirmed',
            createdAt: lastMonth,
            confirmedAt: lastMonth
          }
        ]
      });

      const res = await request(app)
        .get('/api/earnings/summary')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.summary.totalToday).toBe(100);
      expect(res.body.summary.totalMonth).toBe(250); // today + yesterday
      expect(res.body.summary.totalAllTime).toBe(450); // all three
      expect(res.body.summary.pending).toBe(0);
    });

    test('should compute pending correctly', async () => {
      const now = new Date();

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust1',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service', qty: 1, price: 100 }],
        fare: 100,
        paymentMethod: 'cod',
        status: 'payment_requested',
        paymentRequests: [
          {
            id: 'pay1',
            amount: 100,
            currency: 'INR',
            status: 'requested',
            createdAt: now
          },
          {
            id: 'pay2',
            amount: 50,
            currency: 'INR',
            status: 'requested',
            createdAt: now
          }
        ]
      });

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust2',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service', qty: 1, price: 75 }],
        fare: 75,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay3',
            amount: 75,
            currency: 'INR',
            status: 'confirmed',
            createdAt: now,
            confirmedAt: now
          }
        ]
      });

      const res = await request(app)
        .get('/api/earnings/summary')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.summary.pending).toBe(150); // 100 + 50
      expect(res.body.summary.totalAllTime).toBe(75); // only confirmed
    });

    test('should enforce authorization - no token', async () => {
      await request(app)
        .get('/api/earnings/summary')
        .expect(401);
    });

    test('should not allow vendor to access other vendor data', async () => {
      const now = new Date();

      // Create order for vendor2
      await Order.create({
        vendorId: vendor2._id,
        customerId: 'cust1',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service', qty: 1, price: 500 }],
        fare: 500,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay1',
            amount: 500,
            currency: 'INR',
            status: 'confirmed',
            createdAt: now,
            confirmedAt: now
          }
        ]
      });

      // vendor1 tries to access - should get zeros
      const res = await request(app)
        .get('/api/earnings/summary')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.summary.totalAllTime).toBe(0);
    });

    test('should return 400 for invalid start date', async () => {
      await request(app)
        .get('/api/earnings/summary?start=invalid-date')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    test('should return 400 for invalid end date', async () => {
      await request(app)
        .get('/api/earnings/summary?end=invalid-date')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });
  });

  describe('GET /api/earnings/history', () => {
    test('should return empty rows when no confirmed payments', async () => {
      const res = await request(app)
        .get('/api/earnings/history')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.rows).toEqual([]);
      expect(res.body.totalItems).toBe(0);
      expect(res.body.totalPages).toBe(0);
    });

    test('should return rows sorted by confirmedAt DESC', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour earlier
      const latest = new Date(now.getTime() + 3600000); // 1 hour later

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust1',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 1', qty: 1, price: 100 }],
        fare: 100,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay1',
            amount: 100,
            currency: 'INR',
            status: 'confirmed',
            createdAt: earlier,
            confirmedAt: earlier
          }
        ]
      });

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust2',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 2', qty: 1, price: 200 }],
        fare: 200,
        paymentMethod: 'online',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay2',
            amount: 200,
            currency: 'INR',
            status: 'confirmed',
            createdAt: latest,
            confirmedAt: latest
          }
        ]
      });

      const res = await request(app)
        .get('/api/earnings/history')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.rows.length).toBe(2);
      expect(res.body.totalItems).toBe(2);
      
      // Should be sorted DESC
      expect(res.body.rows[0].id).toBe('pay2');
      expect(res.body.rows[0].amount).toBe(200);
      expect(res.body.rows[1].id).toBe('pay1');
      expect(res.body.rows[1].amount).toBe(100);
    });

    test('should filter by from/to dates correctly', async () => {
      const day1 = new Date('2025-11-01T10:00:00Z');
      const day2 = new Date('2025-11-15T10:00:00Z');
      const day3 = new Date('2025-11-30T10:00:00Z');

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust1',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 1', qty: 1, price: 100 }],
        fare: 100,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          { id: 'pay1', amount: 100, currency: 'INR', status: 'confirmed', createdAt: day1, confirmedAt: day1 }
        ]
      });

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust2',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 2', qty: 1, price: 150 }],
        fare: 150,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          { id: 'pay2', amount: 150, currency: 'INR', status: 'confirmed', createdAt: day2, confirmedAt: day2 }
        ]
      });

      await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust3',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service 3', qty: 1, price: 200 }],
        fare: 200,
        paymentMethod: 'cod',
        status: 'completed',
        paymentRequests: [
          { id: 'pay3', amount: 200, currency: 'INR', status: 'confirmed', createdAt: day3, confirmedAt: day3 }
        ]
      });

      // Filter from Nov 10 to Nov 20
      const res = await request(app)
        .get('/api/earnings/history?from=2025-11-10&to=2025-11-20')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.totalItems).toBe(1);
      expect(res.body.rows[0].id).toBe('pay2');
      expect(res.body.rows[0].amount).toBe(150);
    });

    test('should paginate correctly with limit and offset', async () => {
      const now = new Date();

      // Create 5 orders
      for (let i = 1; i <= 5; i++) {
        await Order.create({
          vendorId: vendor1._id,
          customerId: `cust${i}`,
          pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
          drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
          items: [{ title: `Service ${i}`, qty: 1, price: i * 100 }],
          fare: i * 100,
          paymentMethod: 'cod',
          status: 'completed',
          paymentRequests: [
            {
              id: `pay${i}`,
              amount: i * 100,
              currency: 'INR',
              status: 'confirmed',
              createdAt: new Date(now.getTime() + i * 1000),
              confirmedAt: new Date(now.getTime() + i * 1000)
            }
          ]
        });
      }

      // Get first page (2 items)
      const res1 = await request(app)
        .get('/api/earnings/history?limit=2&offset=0')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res1.body.ok).toBe(true);
      expect(res1.body.totalItems).toBe(5);
      expect(res1.body.perPage).toBe(2);
      expect(res1.body.page).toBe(1);
      expect(res1.body.totalPages).toBe(3);
      expect(res1.body.rows.length).toBe(2);

      // Get second page
      const res2 = await request(app)
        .get('/api/earnings/history?limit=2&offset=2')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res2.body.page).toBe(2);
      expect(res2.body.rows.length).toBe(2);

      // Get last page
      const res3 = await request(app)
        .get('/api/earnings/history?limit=2&offset=4')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res3.body.page).toBe(3);
      expect(res3.body.rows.length).toBe(1);
    });

    test('should support page/perPage params', async () => {
      const now = new Date();

      for (let i = 1; i <= 10; i++) {
        await Order.create({
          vendorId: vendor1._id,
          customerId: `cust${i}`,
          pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
          drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
          items: [{ title: `Service ${i}`, qty: 1, price: 100 }],
          fare: 100,
          paymentMethod: 'cod',
          status: 'completed',
          paymentRequests: [
            {
              id: `pay${i}`,
              amount: 100,
              currency: 'INR',
              status: 'confirmed',
              createdAt: now,
              confirmedAt: now
            }
          ]
        });
      }

      const res = await request(app)
        .get('/api/earnings/history?page=2&perPage=3')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.page).toBe(2);
      expect(res.body.perPage).toBe(3);
      expect(res.body.rows.length).toBe(3);
    });

    test('should enforce max limit of 200', async () => {
      const res = await request(app)
        .get('/api/earnings/history?limit=500')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.perPage).toBe(200);
    });

    test('should enforce authorization - no token', async () => {
      await request(app)
        .get('/api/earnings/history')
        .expect(401);
    });

    test('should return 400 for invalid from date', async () => {
      await request(app)
        .get('/api/earnings/history?from=invalid')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    test('should return 400 for invalid to date', async () => {
      await request(app)
        .get('/api/earnings/history?to=invalid')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    test('should return 400 for invalid limit', async () => {
      await request(app)
        .get('/api/earnings/history?limit=-5')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    test('should return 400 for invalid offset', async () => {
      await request(app)
        .get('/api/earnings/history?offset=-1')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);
    });

    test('should include orderId, paymentMethod, status in rows', async () => {
      const now = new Date();

      const order = await Order.create({
        vendorId: vendor1._id,
        customerId: 'cust1',
        pickup: { type: 'Point', coordinates: [-122.084, 37.4219983], address: 'Pickup' },
        drop: { type: 'Point', coordinates: [-122.0822, 37.4249], address: 'Drop' },
        items: [{ title: 'Service', qty: 1, price: 250 }],
        fare: 250,
        paymentMethod: 'online',
        status: 'completed',
        paymentRequests: [
          {
            id: 'pay1',
            amount: 250,
            currency: 'INR',
            notes: 'Test notes',
            status: 'confirmed',
            createdAt: now,
            confirmedAt: now
          }
        ]
      });

      const res = await request(app)
        .get('/api/earnings/history')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.rows.length).toBe(1);
      
      const row = res.body.rows[0];
      expect(row.id).toBe('pay1');
      expect(row.orderId).toBe(order._id.toString());
      expect(row.amount).toBe(250);
      expect(row.currency).toBe('INR');
      expect(row.paymentMethod).toBe('online');
      expect(row.status).toBe('completed');
      expect(row.notes).toBe('Test notes');
      expect(row.confirmedAt).toBeDefined();
    });
  });
});
