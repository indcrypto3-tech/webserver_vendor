const Order = require('../models/order');

async function listOrdersForVendor(vendorId, { status, limit = 50, offset = 0 }) {
  // Allow vendors to see:
  // 1. Orders specifically assigned to them (vendorId matches)
  // 2. Pending orders that are available for acceptance (vendorId is null and status is 'pending')
  const baseQuery = {
    $or: [
      { vendorId }, // Orders assigned to this vendor
      { vendorId: null, status: 'pending' } // Pending orders available for acceptance
    ]
  };
  
  // Accept 'started' as alias for internal 'in_progress'
  if (status === 'started') status = 'in_progress';
  
  let query = baseQuery;
  if (status) {
    if (status === 'pending') {
      // For pending status, only show unassigned pending orders
      query = { vendorId: null, status: 'pending' };
    } else {
      // For other statuses, only show orders assigned to this vendor
      query = { vendorId, status };
    }
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset, 10) || 0)
      .limit(Math.min(parseInt(limit, 10) || 50, 200))
      .lean(),
  ]);

  return { total, orders };
}

async function getOrderForVendor(vendorId, orderId) {
  // Allow vendors to see:
  // 1. Orders specifically assigned to them (vendorId matches)
  // 2. Pending orders that are available for acceptance (vendorId is null and status is 'pending')
  const order = await Order.findOne({ 
    _id: orderId, 
    $or: [
      { vendorId }, // Orders assigned to this vendor
      { vendorId: null, status: 'pending' } // Pending orders available for acceptance
    ]
  });
  return order;
}

// Generic atomic transition helper
async function transitionOrderAtomic(orderId, condition, update) {
  const result = await Order.findOneAndUpdate(
    { _id: orderId, ...condition },
    { $set: update },
    { new: true }
  );
  return result;
}

module.exports = {
  listOrdersForVendor,
  getOrderForVendor,
  transitionOrderAtomic,
};
