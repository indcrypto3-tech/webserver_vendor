// Wrapper for devOrders routes.
// In test or when ENABLE_MOCK_ORDERS=true, we delegate to the archived implementation
// in `archive/dev_tools` so tests can run without keeping full dev endpoints enabled
// in production.

if (process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_ORDERS === 'true') {
  module.exports = require('../archive/dev_tools/routes/devOrders');
} else {
  const express = require('express');
  const router = express.Router();

  router.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Dev endpoints are disabled' });
  });

  module.exports = router;
}
