const request = require('supertest');
const express = require('express');
const Vendor = require('../models/vendor');
const WorkType = require('../models/workType');
const workTypesRoutes = require('../routes/workTypes');
const { signToken } = require('../utils/jwt');
const { DEFAULT_WORK_TYPES } = require('../controllers/workTypesController');

// Setup test app
const app = express();
app.use(express.json());
app.use('/api/work-types', workTypesRoutes);
app.use('/api', workTypesRoutes);

// Import test setup
require('./setup');

describe('Work Types Endpoints', () => {
  
  describe('GET /api/work-types', () => {
    
    it('should return default work types when database is empty', async () => {
      const res = await request(app)
        .get('/api/work-types');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      
      // Check structure of first item
      const firstItem = res.body.data[0];
      expect(firstItem).toHaveProperty('slug');
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('description');
    });

    it('should return work types from database when available', async () => {
      // Seed database with work types
      await WorkType.insertMany([
        { slug: 'test-work-1', title: 'Test Work 1', description: 'Test 1', isActive: true },
        { slug: 'test-work-2', title: 'Test Work 2', description: 'Test 2', isActive: true },
      ]);

      const res = await request(app)
        .get('/api/work-types');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].slug).toBe('test-work-1');
      expect(res.body.data[1].slug).toBe('test-work-2');
    });

    it('should only return active work types', async () => {
      await WorkType.insertMany([
        { slug: 'active-work', title: 'Active', description: 'Active work', isActive: true },
        { slug: 'inactive-work', title: 'Inactive', description: 'Inactive work', isActive: false },
      ]);

      const res = await request(app)
        .get('/api/work-types');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe('active-work');
    });

    it('should return sorted work types by title', async () => {
      await WorkType.insertMany([
        { slug: 'zebra', title: 'Zebra Work', description: 'Z', isActive: true },
        { slug: 'alpha', title: 'Alpha Work', description: 'A', isActive: true },
        { slug: 'beta', title: 'Beta Work', description: 'B', isActive: true },
      ]);

      const res = await request(app)
        .get('/api/work-types');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data[0].title).toBe('Alpha Work');
      expect(res.body.data[1].title).toBe('Beta Work');
      expect(res.body.data[2].title).toBe('Zebra Work');
    });
  });

  describe('POST /api/vendors/me/work-types', () => {
    
    let vendor;
    let token;

    beforeEach(async () => {
      vendor = await Vendor.create({
        vendorName: 'Test Vendor',
        mobile: '9876543210',
        mobileVerified: true,
        workTypes: [],
      });
      token = signToken({ vendorId: vendor._id, mobile: vendor.mobile });
    });

    it('should return 401 without authorization token', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .send({ workTypes: ['plumbing'] });
      
      expect(res.statusCode).toBe(401);
    });

    it('should return 404 for pre-registration user', async () => {
      const preRegToken = signToken({ mobile: '1111111111' });
      
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${preRegToken}`)
        .send({ workTypes: ['plumbing'] });
      
      expect(res.statusCode).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('not created yet');
    });

    it('should require workTypes field', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('required');
    });

    it('should reject non-array workTypes', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: 'plumbing' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('must be an array');
    });

    it('should update vendor work types successfully', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['plumbing', 'electrical'] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.workTypes).toEqual(['plumbing', 'electrical']);
    });

    it('should accept empty array for work types', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: [] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.workTypes).toEqual([]);
    });

    it('should validate work type slugs against defaults', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['invalid-slug', 'another-invalid'] });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Invalid work type slugs');
      expect(res.body.details).toBeDefined();
    });

    it('should validate work type slugs against database', async () => {
      // Seed database with specific work types
      await WorkType.insertMany([
        { slug: 'custom-work-1', title: 'Custom 1', description: 'Test', isActive: true },
        { slug: 'custom-work-2', title: 'Custom 2', description: 'Test', isActive: true },
      ]);

      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['custom-work-1', 'custom-work-2'] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.workTypes).toEqual(['custom-work-1', 'custom-work-2']);
    });

    it('should reject invalid slugs when database has work types', async () => {
      await WorkType.insertMany([
        { slug: 'valid-slug', title: 'Valid', description: 'Test', isActive: true },
      ]);

      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['valid-slug', 'invalid-slug'] });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('Invalid work type slugs');
    });

    it('should allow updating work types multiple times', async () => {
      // First update
      let res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['plumbing'] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.workTypes).toEqual(['plumbing']);

      // Second update
      res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['electrical', 'carpentry'] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.workTypes).toEqual(['electrical', 'carpentry']);
    });

    it('should accept all default work type slugs', async () => {
      const allSlugs = DEFAULT_WORK_TYPES.map(wt => wt.slug);
      
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: allSlugs });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.workTypes).toEqual(allSlugs);
    });

    it('should return updated vendor with all fields', async () => {
      const res = await request(app)
        .post('/api/vendors/me/work-types')
        .set('Authorization', `Bearer ${token}`)
        .send({ workTypes: ['plumbing'] });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data).toHaveProperty('vendorName');
      expect(res.body.data).toHaveProperty('mobile');
      expect(res.body.data).toHaveProperty('workTypes');
      expect(res.body.data).toHaveProperty('createdAt');
      expect(res.body.data).toHaveProperty('updatedAt');
    });
  });
});
