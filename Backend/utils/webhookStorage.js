/**
 * Webhook Storage Utility
 * Handles persistence of webhook notifications
 */

const fs = require('fs-extra');
const path = require('path');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '..', 'data');
const webhookDir = path.join(dataDir, 'webhooks');

// Create directories if they don't exist
fs.ensureDirSync(dataDir);
fs.ensureDirSync(webhookDir);

/**
 * Save anomaly detection notification to file
 * @param {Object} notification - The anomaly notification data
 * @returns {Promise<string>} - Path to the saved file
 */
async function saveAnomalyNotification(notification) {
  try {
    const timestamp = notification.timestamp || new Date().toISOString();
    const filename = `anomaly_${new Date(timestamp).getTime()}_${Date.now()}.json`;
    const filepath = path.join(webhookDir, filename);
    
    const dataToSave = {
      ...notification,
      timestamp,
      receivedAt: new Date().toISOString(),
      type: 'anomaly'
    };
    
    await fs.writeJson(filepath, dataToSave, { spaces: 2 });
    return filepath;
  } catch (error) {
    console.error('[WEBHOOK STORAGE] Error saving anomaly notification:', error);
    throw error;
  }
}

/**
 * Save scan completion notification to file
 * @param {Object} notification - The scan completion notification data
 * @returns {Promise<string>} - Path to the saved file
 */
async function saveScanCompletionNotification(notification) {
  try {
    const timestamp = notification.timestamp || new Date().toISOString();
    const filename = `scan_${notification.scanId || 'unknown'}_${new Date(timestamp).getTime()}.json`;
    const filepath = path.join(webhookDir, filename);
    
    const dataToSave = {
      ...notification,
      timestamp,
      receivedAt: new Date().toISOString(),
      type: 'scan_completion'
    };
    
    await fs.writeJson(filepath, dataToSave, { spaces: 2 });
    return filepath;
  } catch (error) {
    console.error('[WEBHOOK STORAGE] Error saving scan completion notification:', error);
    throw error;
  }
}

/**
 * Save generic webhook notification to file
 * @param {Object} notification - The webhook notification data
 * @param {string} eventType - The event type from header
 * @returns {Promise<string>} - Path to the saved file
 */
async function saveGenericNotification(notification, eventType) {
  try {
    const timestamp = new Date().toISOString();
    const filename = `generic_${eventType || 'unknown'}_${Date.now()}.json`;
    const filepath = path.join(webhookDir, filename);
    
    const dataToSave = {
      ...notification,
      eventType,
      timestamp,
      receivedAt: new Date().toISOString(),
      type: 'generic'
    };
    
    await fs.writeJson(filepath, dataToSave, { spaces: 2 });
    return filepath;
  } catch (error) {
    console.error('[WEBHOOK STORAGE] Error saving generic notification:', error);
    throw error;
  }
}

/**
 * Get all stored notifications
 * @returns {Promise<Array>} - Array of all stored notifications
 */
async function getAllNotifications() {
  try {
    const files = await fs.readdir(webhookDir);
    const notifications = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filepath = path.join(webhookDir, file);
          const data = await fs.readJson(filepath);
          notifications.push(data);
        } catch (error) {
          console.error(`[WEBHOOK STORAGE] Error reading file ${file}:`, error);
        }
      }
    }
    
    // Sort by timestamp (newest first)
    return notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error('[WEBHOOK STORAGE] Error retrieving notifications:', error);
    return [];
  }
}

/**
 * Get notifications by type
 * @param {string} type - The type of notifications to retrieve (anomaly|scan_completion|generic)
 * @returns {Promise<Array>} - Array of notifications of specified type
 */
async function getNotificationsByType(type) {
  try {
    const allNotifications = await getAllNotifications();
    return allNotifications.filter(notification => notification.type === type);
  } catch (error) {
    console.error(`[WEBHOOK STORAGE] Error retrieving ${type} notifications:`, error);
    return [];
  }
}

module.exports = {
  saveAnomalyNotification,
  saveScanCompletionNotification,
  saveGenericNotification,
  getAllNotifications,
  getNotificationsByType
};