require('./setup');
const request = require('supertest');
const app = require('../server');
const Vendor = require('../models/vendor');
const VendorLocation = require('../models/vendorLocation');
const { signToken } = require('../utils/jwt');

describe('Vendor location API', () => {
  let vendor;
  let token;

  beforeEach(async () => {
    vendor = new Vendor({ vendorName: 'Loc Vendor', mobile: '7777777777', mobileVerified: true });
    await vendor.save();
    token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });
  });

  test('POST /api/vendor/location stores a location', async () => {
    const res = await request(app)
      .post('/api/vendor/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ lat: 12.97, lng: 77.59, accuracy: 5 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const docs = await VendorLocation.find({ vendorId: vendor._id });
    expect(docs.length).toBe(1);
    expect(docs[0].loc.coordinates[0]).toBeCloseTo(77.59);
  });
});
