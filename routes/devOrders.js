// Dev/mock orders endpoint removed.
// This route intentionally returns 404 for all requests. If you need to
// re-enable dev/mock order behavior, prefer using archived copies in
// `archive/dev_tools` or run dedicated test helpers, not production routes.

const express = require('express');
const router = express.Router();

router.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Dev endpoints are disabled' });
});

module.exports = router;
