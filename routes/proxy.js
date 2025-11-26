const express = require('express');
const router = express.Router();
const proxyController = require('../controllers/proxyController');

// POST /api/proxy/earnings/summary
// Body: { vendorId, start?, end?, tz? }
router.post('/earnings/summary', proxyController.postEarningsSummary);

// POST /api/proxy/earnings/history
// Body: { vendorId, from?, to?, limit?, offset?, page?, perPage?, tz? }
router.post('/earnings/history', proxyController.postEarningsHistory);

module.exports = router;
