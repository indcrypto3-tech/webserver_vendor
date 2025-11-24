const request = require('supertest');
const express = require('express');
const Vendor = require('../models/vendor');
const vendorRoutes = require('../routes/vendors');
const { signToken } = require('../utils/jwt');

// Setup test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/vendors', vendorRoutes);

// Import test setup
require('./setup');

describe('Vendor Profile Endpoints', () => {
  
  describe('GET /api/vendors/me', () => {
    
    it('should return 401 without authorization token', async () => {
      const res = await request(app)
        .get('/api/vendors/me');
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('message');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/vendors/me')
        .set('Authorization', 'Bearer invalid_token');
      
      expect(res.statusCode).toBe(401);
    });

    it('should return 404 for pre-registration user (no vendor profile)', async () => {
      // Create token with only mobile (no vendorId)
      const token = signToken({ mobile: '9876543210' });
      
      const res = await request(app)
        .get('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('not created yet');
    });

    it('should return vendor profile with ok:true format for authenticated user', async () => {
      // Create a vendor
      const vendor = await Vendor.create({
        vendorName: 'Test Vendor',
        mobile: '9876543210',
        mobileVerified: true,
        gender: 'male',
        businessName: 'Test Business',
        businessAddress: '123 Test St',
        businessType: 'Testing',
        selectedServices: ['Service1', 'Service2'],
        identityImages: {
          profile: '/uploads/profile.jpg',
          id: '/uploads/id.jpg',
          cert: '/uploads/cert.jpg'
        }
      });

      // Generate token
      const token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });

      const res = await request(app)
        .get('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.vendorName).toBe('Test Vendor');
      expect(res.body.data.mobile).toBe('9876543210');
      expect(res.body.data.businessName).toBe('Test Business');
      expect(res.body.data.selectedServices).toEqual(['Service1', 'Service2']);
    });

    it('should return complete vendor data including all fields', async () => {
      const vendor = await Vendor.create({
        vendorName: 'Complete Vendor',
        mobile: '9999999999',
        mobileVerified: true,
        gender: 'female',
        businessName: 'Complete Business',
        businessAddress: '456 Complete Ave',
        selectedServices: ['Consulting', 'Training'],
        identityImages: {
          profile: '/uploads/profile2.jpg',
          id: '/uploads/id2.jpg',
          cert: '/uploads/cert2.jpg'
        }
      });

      const token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });

      const res = await request(app)
        .get('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('vendorName');
      expect(res.body.data).toHaveProperty('mobile');
      expect(res.body.data).toHaveProperty('gender');
      expect(res.body.data).toHaveProperty('businessName');
      expect(res.body.data).toHaveProperty('businessAddress');
      expect(res.body.data).toHaveProperty('availabilityMode');
      expect(res.body.data).toHaveProperty('selectedServices');
      expect(res.body.data).toHaveProperty('identityImages');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
    });
  });

  describe('PATCH /api/vendors/me', () => {
    
    let vendor;
    let token;

    beforeEach(async () => {
      vendor = await Vendor.create({
        vendorName: 'Original Name',
        mobile: '9876543210',
        mobileVerified: true,
        gender: 'male',
        businessName: 'Original Business',
        businessAddress: 'Original Address',
        businessType: 'Original Type',
        selectedServices: ['Service1'],
        identityImages: {
          profile: '',
          id: '',
          cert: ''
        }
      });
      token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });
    });

    it('should return 401 without authorization token', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .send({ vendorName: 'Updated Name' });
      
      expect(res.statusCode).toBe(401);
    });

    it('should return 404 for pre-registration user', async () => {
      const preRegToken = signToken({ mobile: '1111111111' });
      
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${preRegToken}`)
        .send({ vendorName: 'Updated' });
      
      expect(res.statusCode).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('not created yet');
    });

    it('should update vendorName successfully', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorName: 'Updated Name' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.vendorName).toBe('Updated Name');
    });

    it('should update multiple fields at once', async () => {
      const updates = {
        vendorName: 'New Name',
        businessName: 'New Business',
        businessAddress: 'New Address',
        availabilityMode: 'both',
        gender: 'female'
      };

      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updates);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.vendorName).toBe('New Name');
      expect(res.body.data.businessName).toBe('New Business');
      expect(res.body.data.businessAddress).toBe('New Address');
      expect(res.body.data.availabilityMode).toBe('both');
      expect(res.body.data.gender).toBe('female');
    });

    it('should update selectedServices with array', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ selectedServices: ['Service A', 'Service B', 'Service C'] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.selectedServices).toEqual(['Service A', 'Service B', 'Service C']);
    });

    it('should update selectedServices with JSON string', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ selectedServices: '["Service X", "Service Y"]' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.selectedServices).toEqual(['Service X', 'Service Y']);
    });

    it('should update selectedServices with CSV string', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ selectedServices: 'Service1, Service2, Service3' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.selectedServices).toEqual(['Service1', 'Service2', 'Service3']);
    });

    it('should normalize gender to lowercase', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ gender: 'FEMALE' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.gender).toBe('female');
    });

    it('should handle partial updates correctly', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: 'Only Business Updated' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.businessName).toBe('Only Business Updated');
      expect(res.body.data.vendorName).toBe('Original Name'); // Should remain unchanged
      expect(res.body.data.businessAddress).toBe('Original Address'); // Should remain unchanged
    });

    it('should reject empty vendorName', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorName: '   ' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should reject vendorName exceeding 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorName: longName });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toBeDefined();
      expect(res.body.details.some(err => err.includes('100 characters'))).toBe(true);
    });

    it('should reject invalid gender value', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ gender: 'invalid' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.details).toBeDefined();
    });

    it('should reject non-string businessName', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: 12345 });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should return error when no fields are provided', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('No valid fields');
    });

    it('should sanitize HTML from input fields', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          vendorName: '<script>alert("xss")</script>Safe Name',
          businessName: '<b>Business</b> Name'
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.vendorName).not.toContain('<script>');
      expect(res.body.data.vendorName).not.toContain('<b>');
      expect(res.body.data.vendorName).toBe('Safe Name');
      expect(res.body.data.businessName).toBe('Business Name');
    });

    it('should only update allowed fields', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          vendorName: 'Updated',
          mobile: '0000000000', // Not allowed to change
          mobileVerified: false, // Not allowed to change
          _id: 'fakeid' // Not allowed to change
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.vendorName).toBe('Updated');
      expect(res.body.data.mobile).toBe('9876543210'); // Should remain original
      expect(res.body.data.mobileVerified).toBe(true); // Should remain true
    });

    it('should update updatedAt timestamp', async () => {
      const originalUpdatedAt = vendor.updatedAt;
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorName: 'Updated Name' });
      
      expect(res.statusCode).toBe(200);
      const newUpdatedAt = new Date(res.body.data.updatedAt);
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should validate availabilityMode enum values', async () => {
      // Test invalid value
      let res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ availabilityMode: 'invalid-mode' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Validation failed');
      expect(res.body.details).toContain('availabilityMode must be one of: instant, schedule, both, or empty string');

      // Test valid values
      res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ availabilityMode: 'instant' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.availabilityMode).toBe('instant');

      res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ availabilityMode: 'schedule' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.availabilityMode).toBe('schedule');

      res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ availabilityMode: 'both' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.availabilityMode).toBe('both');
    });

    it('should return updated vendor with all fields', async () => {
      const res = await request(app)
        .patch('/api/vendors/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ businessName: 'Updated Business' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('vendorName');
      expect(res.body.data).toHaveProperty('mobile');
      expect(res.body.data).toHaveProperty('businessName');
      expect(res.body.data).toHaveProperty('identityImages');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
    });
  });

  describe('POST /api/vendors', () => {
    it('should create vendor with availabilityMode=instant', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .field('mobile', '9876543210')
        .field('vendorName', 'Test Vendor')
        .field('gender', 'male')
        .field('businessName', 'Test Business')
        .field('businessAddress', 'Test Address')
        .field('availabilityMode', 'instant');
      
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('availabilityMode', 'instant');
      expect(res.body.data).toHaveProperty('mobile', '9876543210');
    });

    it('should create vendor with availabilityMode=schedule', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .field('mobile', '9876543211')
        .field('vendorName', 'Test Vendor 2')
        .field('gender', 'female')
        .field('businessName', 'Test Business 2')
        .field('businessAddress', 'Test Address 2')
        .field('availabilityMode', 'schedule');
      
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('availabilityMode', 'schedule');
    });

    it('should create vendor with availabilityMode=both', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .field('mobile', '9876543212')
        .field('vendorName', 'Test Vendor 3')
        .field('gender', 'male')
        .field('businessName', 'Test Business 3')
        .field('businessAddress', 'Test Address 3')
        .field('availabilityMode', 'both');
      
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('availabilityMode', 'both');
    });

    it('should create vendor without availabilityMode (default empty string)', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .field('mobile', '9876543213')
        .field('vendorName', 'Test Vendor 4')
        .field('gender', 'female')
        .field('businessName', 'Test Business 4')
        .field('businessAddress', 'Test Address 4');
      
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('availabilityMode', '');
    });

    it('should reject invalid availabilityMode with 400 error', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .field('mobile', '9876543214')
        .field('vendorName', 'Test Vendor 5')
        .field('gender', 'male')
        .field('businessName', 'Test Business 5')
        .field('businessAddress', 'Test Address 5')
        .field('availabilityMode', 'invalid-mode');
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toContain('availabilityMode must be one of: instant, schedule, both, or empty string');
    });

    it('should create vendor with empty string availabilityMode', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .field('mobile', '9876543215')
        .field('vendorName', 'Test Vendor 6')
        .field('gender', 'female')
        .field('businessName', 'Test Business 6')
        .field('businessAddress', 'Test Address 6')
        .field('availabilityMode', '');
      
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveProperty('availabilityMode', '');
    });
  });
});
