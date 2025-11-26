const Order = require('../models/order');

/**
 * Earnings Service
 * Handles aggregation and computation of vendor earnings from confirmed payment requests
 */

/**
 * Get earnings summary for a vendor
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} filters - Optional date filters { start, end, tz }
 * @returns {Object} Summary with totalToday, totalMonth, totalAllTime, pending
 */
async function getEarningsSummary(vendorId, filters = {}) {
  const { start, end, tz } = filters;

  // Build date range for filtering
  let dateFilter = {};
  if (start || end) {
    dateFilter = {};
    if (start) dateFilter.$gte = new Date(start);
    if (end) dateFilter.$lte = new Date(end);
  }

  // Get current date boundaries (timezone-aware if provided)
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aggregate confirmed payments
  const pipeline = [
    { $match: { vendorId } },
    { $unwind: '$paymentRequests' },
  ];

  // Get all confirmed payments
  const confirmedPipeline = [
    ...pipeline,
    { $match: { 'paymentRequests.status': 'confirmed' } },
    {
      $group: {
        _id: null,
        totalToday: {
          $sum: {
            $cond: [
              { $gte: ['$paymentRequests.confirmedAt', todayStart] },
              '$paymentRequests.amount',
              0
            ]
          }
        },
        totalMonth: {
          $sum: {
            $cond: [
              { $gte: ['$paymentRequests.confirmedAt', monthStart] },
              '$paymentRequests.amount',
              0
            ]
          }
        },
        totalAllTime: { $sum: '$paymentRequests.amount' }
      }
    }
  ];

  // Apply date filter if provided
  if (Object.keys(dateFilter).length > 0) {
    confirmedPipeline.splice(2, 0, {
      $match: { 'paymentRequests.confirmedAt': dateFilter }
    });
  }

  // Get pending payments (non-confirmed)
  const pendingPipeline = [
    ...pipeline,
    { $match: { 'paymentRequests.status': { $ne: 'confirmed' } } },
    {
      $group: {
        _id: null,
        pending: { $sum: '$paymentRequests.amount' }
      }
    }
  ];

  const [confirmedResults, pendingResults] = await Promise.all([
    Order.aggregate(confirmedPipeline),
    Order.aggregate(pendingPipeline)
  ]);

  const confirmed = confirmedResults[0] || { totalToday: 0, totalMonth: 0, totalAllTime: 0 };
  const pending = pendingResults[0] || { pending: 0 };

  return {
    currency: 'INR',
    totalToday: Math.round(confirmed.totalToday * 100) / 100,
    totalMonth: Math.round(confirmed.totalMonth * 100) / 100,
    totalAllTime: Math.round(confirmed.totalAllTime * 100) / 100,
    pending: Math.round(pending.pending * 100) / 100
  };
}

/**
 * Get paginated earnings history for a vendor
 * @param {String} vendorId - Vendor ObjectId
 * @param {Object} options - Query options { from, to, limit, offset, tz }
 * @returns {Object} Paginated history with rows and metadata
 */
async function getEarningsHistory(vendorId, options = {}) {
  const { from, to, limit = 50, offset = 0 } = options;

  // Enforce max limit
  const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const safeOffset = parseInt(offset, 10) || 0;

  // Build date filter
  let dateFilter = {};
  if (from || to) {
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);
  }

  // Build aggregation pipeline
  const matchStage = { $match: { vendorId } };
  const unwindStage = { $unwind: '$paymentRequests' };
  const confirmedStage = { $match: { 'paymentRequests.status': 'confirmed' } };

  const pipeline = [matchStage, unwindStage, confirmedStage];

  // Add date filter if provided
  if (Object.keys(dateFilter).length > 0) {
    pipeline.push({
      $match: { 'paymentRequests.confirmedAt': dateFilter }
    });
  }

  // Count total
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await Order.aggregate(countPipeline);
  const totalItems = countResult[0]?.total || 0;

  // Get paginated rows
  const rowsPipeline = [
    ...pipeline,
    { $sort: { 'paymentRequests.confirmedAt': -1 } },
    { $skip: safeOffset },
    { $limit: safeLimit },
    {
      $project: {
        id: '$paymentRequests.id',
        orderId: { $toString: '$_id' },
        amount: '$paymentRequests.amount',
        currency: '$paymentRequests.currency',
        confirmedAt: '$paymentRequests.confirmedAt',
        paymentMethod: '$paymentMethod',
        status: '$status',
        notes: '$paymentRequests.notes'
      }
    }
  ];

  const rows = await Order.aggregate(rowsPipeline);

  // Round amounts
  const formattedRows = rows.map(row => ({
    ...row,
    amount: Math.round(row.amount * 100) / 100
  }));

  const totalPages = Math.ceil(totalItems / safeLimit);
  const page = Math.floor(safeOffset / safeLimit) + 1;

  return {
    page,
    perPage: safeLimit,
    totalItems,
    totalPages,
    rows: formattedRows
  };
}

module.exports = {
  getEarningsSummary,
  getEarningsHistory
};
