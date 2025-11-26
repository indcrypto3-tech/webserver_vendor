require('./setup');
const request = require('supertest');
const app = require('../server');
const Vendor = require('../models/vendor');
const Order = require('../models/order');
const { signToken } = require('../utils/jwt');

describe('Orders API', () => {
  let vendor;
  let token;

  beforeEach(async () => {
    vendor = new Vendor({ vendorName: 'Test Vendor', mobile: '9999999999', mobileVerified: true });
    await vendor.save();
    token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });
  });

  test('GET /api/orders returns vendor orders with pagination', async () => {
    // create orders for vendor
    for (let i = 0; i < 3; i++) {
      await Order.create({
        customerId: `cust${i}`,
        pickup: { type: 'Point', coordinates: [77.59, 12.97], address: 'P' + i },
        drop: { type: 'Point', coordinates: [77.60, 12.98], address: 'D' + i },
        items: [{ title: 'Service', qty: 1, price: 100 }],
        fare: 100,
        paymentMethod: 'cod',
        status: 'accepted',
        vendorId: vendor._id,
      });
    }

    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBe(3);
  });

  test('POST /api/orders/:id/accept idempotent success', async () => {
    const order = await Order.create({
      customerId: 'c1',
      pickup: { type: 'Point', coordinates: [77.59, 12.97], address: 'P' },
      drop: { type: 'Point', coordinates: [77.60, 12.98], address: 'D' },
      items: [{ title: 'Service', qty: 1, price: 100 }],
      fare: 100,
      paymentMethod: 'cod',
      status: 'pending',
    });

    const res = await request(app).post(`/api/orders/${order._id}/accept`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('accepted');

    // repeat accept should be idempotent
    const res2 = await request(app).post(`/api/orders/${order._id}/accept`).set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);
    expect(res2.body.ok).toBe(true);
  });

  test('POST /api/orders/:id/accept conflict when already accepted by other vendor', async () => {
    const other = new Vendor({ vendorName: 'Other', mobile: '8888888888', mobileVerified: true });
    await other.save();

    const order = await Order.create({
      customerId: 'c2',
      pickup: { type: 'Point', coordinates: [77.59, 12.97], address: 'P' },
      drop: { type: 'Point', coordinates: [77.60, 12.98], address: 'D' },
      items: [{ title: 'Service', qty: 1, price: 100 }],
      fare: 100,
      paymentMethod: 'cod',
      status: 'accepted',
      vendorId: other._id,
    });

    const res = await request(app).post(`/api/orders/${order._id}/accept`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  test('POST /api/orders/:id/reject works', async () => {
    const order = await Order.create({
      customerId: 'c3',
      pickup: { type: 'Point', coordinates: [77.59, 12.97], address: 'P' },
      drop: { type: 'Point', coordinates: [77.60, 12.98], address: 'D' },
      items: [{ title: 'Service', qty: 1, price: 100 }],
      fare: 100,
      paymentMethod: 'cod',
      status: 'pending',
    });

    const res = await request(app).post(`/api/orders/${order._id}/reject`).set('Authorization', `Bearer ${token}`).send({ reason: 'Busy' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
  });

  test('POST /api/orders/:id/start and complete transitions', async () => {
    const order = await Order.create({
      customerId: 'c4',
      pickup: { type: 'Point', coordinates: [77.59, 12.97], address: 'P' },
      drop: { type: 'Point', coordinates: [77.60, 12.98], address: 'D' },
      items: [{ title: 'Service', qty: 1, price: 100 }],
      fare: 100,
      paymentMethod: 'cod',
      status: 'pending',
    });

    // Accept first
    const accept = await request(app).post(`/api/orders/${order._id}/accept`).set('Authorization', `Bearer ${token}`);
    expect(accept.status).toBe(200);

    const start = await request(app).post(`/api/orders/${order._id}/start`).set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(200);
    expect(start.body.data.status).toBe('started');

    const complete = await request(app).post(`/api/orders/${order._id}/complete`).set('Authorization', `Bearer ${token}`);
    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe('completed');
  });
});
