// Ensure test environment variables and in-memory MongoDB are initialized
process.env.NODE_ENV = 'test';
process.env.SKIP_RATE_LIMIT = 'true';
require('./setup');

const request = require('supertest');
const app = require('../server');
const PreSignupFcmToken = require('../models/preSignupFcmToken');

describe('POST /api/public/fcm-token', () => {

  it('returns 400 when missing phone or fcmToken', async () => {
    const res = await request(app).post('/api/public/fcm-token').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('persists a token and returns 201 with id', async () => {
    const payload = {
      phone: '+919876543210',
      fcmToken: 'token-abc-123',
      deviceType: 'android',
      deviceId: 'android-abc',
      meta: { appVersion: '1.0.0' }
    };

    const res = await request(app).post('/api/public/fcm-token').send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.id).toBeTruthy();

    const doc = await PreSignupFcmToken.findById(res.body.id).lean();
    expect(doc).toBeTruthy();
    expect(doc.phone).toBe(payload.phone);
    expect(doc.fcmToken).toBe(payload.fcmToken);
    expect(doc.deviceId).toBe(payload.deviceId);
  });

  it('updates existing record when same fcmToken is sent again', async () => {
    const payload = {
      phone: '+919876543211',
      fcmToken: 'token-dup-1',
      deviceType: 'ios',
      deviceId: 'ios-1'
    };

    const res1 = await request(app).post('/api/public/fcm-token').send(payload);
    expect(res1.statusCode).toBe(201);

    // Send again with different phone - should update same record (by fcmToken)
    const res2 = await request(app).post('/api/public/fcm-token').send({ ...payload, phone: '+919000000000' });
    expect(res2.statusCode).toBe(201);
    expect(res2.body.id).toBe(res1.body.id);

    const doc = await PreSignupFcmToken.findById(res1.body.id).lean();
    expect(doc.phone).toBe('+919000000000');
  });

  it('allows multiple tokens for same phone (different deviceIds)', async () => {
    const phone = '+919111111111';
    const p1 = { phone, fcmToken: 't-a', deviceId: 'd-a' };
    const p2 = { phone, fcmToken: 't-b', deviceId: 'd-b' };

    const r1 = await request(app).post('/api/public/fcm-token').send(p1);
    const r2 = await request(app).post('/api/public/fcm-token').send(p2);

    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);

    const docs = await PreSignupFcmToken.find({ phone }).lean();
    expect(docs.length).toBeGreaterThanOrEqual(2);
  });
});
