const Order = require('../models/order');

async function listOrdersForVendor(vendorId, { status, limit = 50, offset = 0 }) {
  const query = { vendorId };
  // Accept 'started' as alias for internal 'in_progress'
  if (status === 'started') status = 'in_progress';
  if (status) query.status = status;

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
  const order = await Order.findOne({ _id: orderId, vendorId });
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
