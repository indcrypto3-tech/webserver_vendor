// Dev/mock orders removed. This route returns 404 for all requests.

const express = require('express');
const router = express.Router();

router.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Dev endpoints are disabled' });
});

module.exports = router;
