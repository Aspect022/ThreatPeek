/**
 * Enhanced Scan Routes - Multi-scan type coordination endpoints
 * Supports orchestrated scanning with progress tracking and error recovery
 */

const express = require('express');
const router = express.Router();
const enhancedScanController = require('../controllers/simpleEnhancedScanController');

// POST /api/enhanced-scan - Start enhanced scan with multiple scan types
router.post('/', enhancedScanController.startEnhancedScan);

// GET /api/enhanced-scan/types - Get available scan types and configurations
router.get('/types', enhancedScanController.getScanTypes);

// GET /api/enhanced-scan/:scanId/status - Get scan status and progress
router.get('/:scanId/status', enhancedScanController.getScanStatus);

// GET /api/enhanced-scan/:scanId/results - Get complete scan results
router.get('/:scanId/results', enhancedScanController.getScanResults);

// DELETE /api/enhanced-scan/:scanId - Cancel active scan
router.delete('/:scanId', enhancedScanController.cancelScan);

// POST /api/enhanced-scan/:scanId/feedback - Record user feedback for false positive learning
router.post('/:scanId/feedback', enhancedScanController.recordFeedback);

// GET /api/enhanced-scan/stats/confidence - Get confidence scoring statistics
router.get('/stats/confidence', enhancedScanController.getConfidenceStats);

// Backward compatibility - POST /api/enhanced-scan/website
router.post('/website', enhancedScanController.scanWebsite);

module.exports = router;