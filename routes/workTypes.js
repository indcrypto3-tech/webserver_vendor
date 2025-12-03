const express = require('express');
const router = express.Router();

// Work-types endpoint removed: return 404 for all requests
router.get('/', (req, res) => res.status(404).json({ ok: false, error: 'work_types_removed' }));

module.exports = router;
