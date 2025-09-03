/**
 * Simple test script to add an anomaly entry to the notifications log
 */

const fs = require('fs');
const path = require('path');

// Path to the notifications log file
const logFilePath = path.join(__dirname, 'logs', 'notifications.log');

// Create a test anomaly entry
const testAnomaly = {
    timestamp: new Date().toISOString(),
    type: 'anomaly',
    severity: 'critical',
    message: 'Test anomaly for debugging n8n integration',
    details: {
        source: 'debug-test',
        description: 'This is a test anomaly to verify n8n integration is working'
    }
};

// Append to log file
fs.appendFileSync(logFilePath, JSON.stringify(testAnomaly) + '\n');
console.log('Test anomaly entry added to log file');
console.log('Check the server logs to see if it is detected and forwarded to n8n');