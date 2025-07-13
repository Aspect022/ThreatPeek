const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');

// POST /api/scan
router.post('/', scanController.scanWebsite);

// GET /api/scan/:scanId
router.get('/:scanId', scanController.getScanResults);

module.exports = router;
