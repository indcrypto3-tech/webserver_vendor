// Dev/mock orders endpoint: disabled in production. During tests we proxy
// to the archived dev implementation so integration tests that depend on
// mock orders can still run.

const express = require('express');
const router = express.Router();

if (process.env.NODE_ENV === 'test') {
  module.exports = require('../archive/dev_tools/routes/devOrders');
} else {
  router.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Dev endpoints are disabled' });
  });

  module.exports = router;
}
