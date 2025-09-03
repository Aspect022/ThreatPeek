/**
 * Notification Utility
 * Handles sending notifications for critical events
 */

const fs = require('fs-extra');
const path = require('path');

// Ensure the logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
fs.ensureDirSync(logsDir);

// Notification log file
const notificationLog = path.join(logsDir, 'notifications.log');

/**
 * Log notification to file
 * @param {string} type - Type of notification (anomaly|scan)
 * @param {string} severity - Severity level (low|medium|high|critical)
 * @param {string} message - Notification message
 * @param {Object} details - Additional details
 */
async function logNotification(type, severity, message, details = {}) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      details
    };
    
    // Append to log file
    await fs.appendFile(notificationLog, JSON.stringify(logEntry) + '\n');
    
    // Also log to console
    console.log(`[NOTIFICATION] ${type.toUpperCase()} - ${severity.toUpperCase()}: ${message}`, details);
  } catch (error) {
    console.error('[NOTIFICATION] Error logging notification:', error);
  }
}

/**
 * Send critical anomaly notification
 * @param {Object} anomalyData - The anomaly data
 */
async function sendCriticalAnomalyNotification(anomalyData) {
  const { anomaly, severity, source, details } = anomalyData;
  
  // Log the anomaly notification
  await logNotification(
    'anomaly',
    severity,
    `Critical anomaly detected: ${anomaly}`,
    { source, details }
  );
  
  // TODO: Add integration with actual notification services
  // Examples:
  // - Send email via Nodemailer
  // - Send Slack message via webhook
  // - Create Jira ticket via API
  // - Send SMS via Twilio
}

/**
 * Send scan completion notification with critical findings
 * @param {Object} scanData - The scan completion data
 */
async function sendScanCompletionNotification(scanData) {
  const { scanId, status, results } = scanData;
  
  // Check if there are critical findings
  let criticalFindingsCount = 0;
  let highFindingsCount = 0;
  
  if (results && results.categories) {
    results.categories.forEach(category => {
      if (category.summary) {
        criticalFindingsCount += category.summary.criticalCount || 0;
        highFindingsCount += category.summary.highCount || 0;
      }
    });
  }
  
  if (criticalFindingsCount > 0 || highFindingsCount > 0) {
    await logNotification(
      'anomaly',
      criticalFindingsCount > 0 ? 'critical' : 'high',
      `Scan ${scanId} completed with ${criticalFindingsCount} critical and ${highFindingsCount} high severity findings`,
      { 
        scanId, 
        status, 
        criticalFindingsCount,
        highFindingsCount,
        totalFindings: results?.summary?.totalFindings || 0
      }
    );
  }
  
  await logNotification(
    'scan',
    criticalFindingsCount > 0 ? 'critical' : (highFindingsCount > 0 ? 'high' : 'info'),
    `Scan ${scanId} completed ${status}`,
    { 
      scanId, 
      status, 
      findingsCount: results?.summary?.totalFindings || 0,
      criticalFindingsCount,
      highFindingsCount
    }
  );
  
  // TODO: Add integration with actual notification services
}

module.exports = {
  logNotification,
  sendCriticalAnomalyNotification,
  sendScanCompletionNotification
};