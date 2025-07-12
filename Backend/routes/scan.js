const express = require("express");
const router = express.Router();
const { scanWebsite, getScanResults } = require("../controllers/improvedScanController");

router.post("/scan", scanWebsite);
router.get("/scan/:scanId", getScanResults);

module.exports = router;
