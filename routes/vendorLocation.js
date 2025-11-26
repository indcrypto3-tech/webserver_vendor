const express = require('express');
const router = express.Router();
const requestId = require('../middleware/requestId');
const { authenticate } = require('../middleware/auth');
const VendorLocation = require('../models/vendorLocation');
const { buildBase, info, error } = require('../utils/logger');

router.use(requestId);

router.post('/location', authenticate, async (req, res) => {
  const rid = req.requestId;
  const vendorId = req.user && req.user._id;
  const { lat, lng, accuracy, timestamp, orderId } = req.body || {};

  info(buildBase({ requestId: rid, route: '/api/vendor/location', method: 'POST', vendorId }), 'Vendor location update');

  // Basic validation
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ requestId: rid, message: 'lat and lng must be numbers' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ requestId: rid, message: 'lat or lng out of range' });
  }

  try {
    const doc = new VendorLocation({
      vendorId,
      loc: { type: 'Point', coordinates: [lng, lat] },
      accuracy: typeof accuracy === 'number' ? accuracy : null,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      orderId: orderId || null,
    });

    await doc.save();

    return res.status(200).json({ ok: true, data: { ack: true } });
  } catch (err) {
    error(buildBase({ requestId: rid, route: '/api/vendor/location', method: 'POST', vendorId }), 'Vendor location error', err.stack);
    return res.status(500).json({ requestId: rid, message: 'Internal server error' });
  }
});

module.exports = router;
