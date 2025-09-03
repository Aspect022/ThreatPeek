/**
 * Add test anomaly to log file for n8n integration testing
 */

const fs = require('fs');
const path = require('path');

console.log('=== Adding Test Anomaly to Log File ===\n');

const logFilePath = path.join(__dirname, 'logs', 'notifications.log');

// Create a test anomaly entry
const testAnomaly = {
    timestamp: new Date().toISOString(),
    type: 'anomaly',
    severity: 'critical',
    message: 'Test anomaly for n8n integration verification',
    details: {
        source: 'manual-test',
        description: 'This is a manually added test anomaly to verify n8n integration',
        testId: 'n8n-integration-test-' + Date.now()
    }
};

console.log('Test anomaly entry:');
console.log(JSON.stringify(testAnomaly, null, 2));

// Append to log file
fs.appendFileSync(logFilePath, JSON.stringify(testAnomaly) + '\n');

console.log('\n✅ Test anomaly added to log file');
console.log(`📝 Log file: ${logFilePath}`);
console.log('\nIf the log monitor is running, it should detect this anomaly and forward it to n8n.');
console.log('Check your n8n workflow to see if it receives the webhook.');