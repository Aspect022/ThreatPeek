/**
 * Webhook History Routes - For retrieving stored webhook notifications
 */

const express = require('express');
const router = express.Router();

// Import our storage utility
const { 
  getAllNotifications, 
  getNotificationsByType 
} = require('../utils/webhookStorage');

// GET /api/webhook-history - Retrieve all stored webhook notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await getAllNotifications();
    res.status(200).json({
      status: 'success',
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('[WEBHOOK HISTORY] Error retrieving notifications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve webhook notifications'
    });
  }
});

// GET /api/webhook-history/type/:type - Retrieve notifications by type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['anomaly', 'scan_completion', 'generic'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    const notifications = await getNotificationsByType(type);
    res.status(200).json({
      status: 'success',
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('[WEBHOOK HISTORY] Error retrieving notifications by type:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve webhook notifications by type'
    });
  }
});

module.exports = router;