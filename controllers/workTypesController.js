const WorkType = require('../models/workType');
const Vendor = require('../models/vendor');

/**
 * Static list of work types as fallback
 * Used when database is empty or unavailable
 */
const DEFAULT_WORK_TYPES = [
  {
    slug: 'plumbing',
    title: 'Plumbing',
    description: 'Pipe repair, installation, and maintenance services',
    icon: '🔧',
    isActive: true,
  },
  {
    slug: 'electrical',
    title: 'Electrical',
    description: 'Electrical wiring, repairs, and installations',
    icon: '⚡',
    isActive: true,
  },
  {
    slug: 'carpentry',
    title: 'Carpentry',
    description: 'Wood work, furniture repair, and custom carpentry',
    icon: '🔨',
    isActive: true,
  },
  {
    slug: 'painting',
    title: 'Painting',
    description: 'Interior and exterior painting services',
    icon: '🎨',
    isActive: true,
  },
  {
    slug: 'cleaning',
    title: 'Cleaning',
    description: 'Home and office cleaning services',
    icon: '🧹',
    isActive: true,
  },
  {
    slug: 'gardening',
    title: 'Gardening',
    description: 'Lawn care, landscaping, and garden maintenance',
    icon: '🌱',
    isActive: true,
  },
  {
    slug: 'hvac',
    title: 'HVAC',
    description: 'Heating, ventilation, and air conditioning services',
    icon: '❄️',
    isActive: true,
  },
  {
    slug: 'appliance-repair',
    title: 'Appliance Repair',
    description: 'Repair and maintenance of home appliances',
    icon: '🔌',
    isActive: true,
  },
  {
    slug: 'pest-control',
    title: 'Pest Control',
    description: 'Pest inspection, prevention, and elimination',
    icon: '🐛',
    isActive: true,
  },
  {
    slug: 'handyman',
    title: 'Handyman',
    description: 'General household repairs and maintenance',
    icon: '🛠️',
    isActive: true,
  },
];

/**
 * GET /api/work-types
 * Get list of available work types
 */
async function getWorkTypes(req, res) {
  try {
    // Try to fetch from database first
    let workTypes = await WorkType.find({ isActive: true }).sort({ title: 1 });

    // If database is empty, use default list
    if (!workTypes || workTypes.length === 0) {
      console.log('No work types in database, using default list');
      workTypes = DEFAULT_WORK_TYPES;
    }

    return res.status(200).json({
      ok: true,
      data: workTypes,
    });
  } catch (error) {
    console.error('Get work types error:', error);
    
    // On database error, return default list as fallback
    console.log('Database error, falling back to default work types');
    return res.status(200).json({
      ok: true,
      data: DEFAULT_WORK_TYPES,
    });
  }
}

/**
 * POST /api/vendors/me/work-types
 * Update vendor's selected work types
 */
async function updateVendorWorkTypes(req, res) {
  try {
    // Check if user is in pre-registration state
    if (req.user.isPreRegistration) {
      return res.status(404).json({
        ok: false,
        error: 'Vendor profile not created yet. Use POST /api/vendors to create.',
      });
    }

    const { workTypes } = req.body;

    // Validate workTypes field
    if (workTypes === undefined) {
      return res.status(400).json({
        ok: false,
        error: 'workTypes field is required',
      });
    }

    if (!Array.isArray(workTypes)) {
      return res.status(400).json({
        ok: false,
        error: 'workTypes must be an array',
      });
    }

    // Get valid work type slugs from database or defaults
    let validWorkTypes = [];
    try {
      const dbWorkTypes = await WorkType.find({ isActive: true });
      if (dbWorkTypes && dbWorkTypes.length > 0) {
        validWorkTypes = dbWorkTypes.map(wt => wt.slug);
      } else {
        validWorkTypes = DEFAULT_WORK_TYPES.map(wt => wt.slug);
      }
    } catch (dbError) {
      // On database error, use default slugs
      validWorkTypes = DEFAULT_WORK_TYPES.map(wt => wt.slug);
    }

    // Validate each work type slug
    const invalidSlugs = workTypes.filter(slug => !validWorkTypes.includes(slug));
    
    if (invalidSlugs.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid work type slugs',
        details: [`Invalid slugs: ${invalidSlugs.join(', ')}. Valid options: ${validWorkTypes.join(', ')}`],
      });
    }

    // Update vendor's work types
    const vendor = req.user;
    vendor.workTypes = workTypes;

    await vendor.save();

    return res.status(200).json({
      ok: true,
      data: vendor.toPublicJSON(),
    });
  } catch (error) {
    console.error('Update vendor work types error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: Object.values(error.errors).map(e => e.message),
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'Server error occurred while updating work types',
    });
  }
}

/**
 * Initialize database with default work types
 * Call this during server startup if needed
 */
async function seedWorkTypes() {
  try {
    const count = await WorkType.countDocuments();
    
    if (count === 0) {
      console.log('Seeding default work types...');
      await WorkType.insertMany(DEFAULT_WORK_TYPES);
      console.log(`Seeded ${DEFAULT_WORK_TYPES.length} work types`);
    }
  } catch (error) {
    console.error('Error seeding work types:', error);
  }
}

module.exports = {
  getWorkTypes,
  updateVendorWorkTypes,
  seedWorkTypes,
  DEFAULT_WORK_TYPES,
};
