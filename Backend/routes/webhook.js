/**
 * Webhook Routes - For receiving notifications from external services
 * Supports anomaly detection notifications and workflow triggers
 */

const express = require('express');
const router = express.Router();

// Import our new utilities
const { 
  saveAnomalyNotification, 
  saveScanCompletionNotification, 
  saveGenericNotification 
} = require('../utils/webhookStorage');

const { 
  sendCriticalAnomalyNotification, 
  sendScanCompletionNotification 
} = require('../utils/notifications');

// POST /api/webhook/anomaly-detected - Receive anomaly detection notifications
router.post('/anomaly-detected', async (req, res) => {
  try {
    const { timestamp, anomaly, severity, source, details } = req.body;
    
    // Create the notification object
    const notification = {
      timestamp: timestamp || new Date().toISOString(),
      anomaly,
      severity,
      source,
      details
    };
    
    // Log the received anomaly
    console.log('[WEBHOOK] Anomaly detected:', notification);
    
    // Save to persistent storage
    await saveAnomalyNotification(notification);
    
    // Send notifications for critical anomalies
    if (severity === 'critical' || severity === 'high') {
      await sendCriticalAnomalyNotification(notification);
    }
    
    // Respond with success
    res.status(200).json({
      status: 'success',
      message: 'Anomaly detection notification received and processed',
      receivedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Error processing anomaly notification:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process anomaly notification'
    });
  }
});

// POST /api/webhook/scan-completed - Receive scan completion notifications
router.post('/scan-completed', async (req, res) => {
  try {
    const { scanId, status, results, timestamp } = req.body;
    
    // Create the notification object
    const notification = {
      scanId,
      status,
      results,
      timestamp: timestamp || new Date().toISOString()
    };
    
    // Log the received scan completion
    console.log('[WEBHOOK] Scan completed:', {
      scanId,
      status,
      findingsCount: results?.summary?.totalFindings || 0,
      timestamp: notification.timestamp
    });
    
    // Save to persistent storage
    await saveScanCompletionNotification(notification);
    
    // Send notifications for scan completion (will check for critical findings)
    await sendScanCompletionNotification(notification);
    
    res.status(200).json({
      status: 'success',
      message: 'Scan completion notification received and processed',
      receivedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Error processing scan completion notification:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process scan completion notification'
    });
  }
});

// Generic webhook endpoint for other notifications
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    const eventType = req.headers['x-event-type'] || 'unknown';
    
    console.log(`[WEBHOOK] Received ${eventType} event:`, payload);
    
    // Save to persistent storage
    await saveGenericNotification(payload, eventType);
    
    // Handle different event types based on the x-event-type header
    // Add specific logic for different event types here as needed
    
    res.status(200).json({
      status: 'success',
      message: `Event ${eventType} received and processed`,
      receivedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[WEBHOOK] Error processing generic webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process webhook notification'
    });
  }
});

module.exports = router;