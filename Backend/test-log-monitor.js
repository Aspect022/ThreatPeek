/**
 * Test script for log monitoring system
 * This script simulates writing anomaly entries to the notifications.log file
 */

const fs = require('fs');
const path = require('path');

// Path to the notifications log file
const logFilePath = path.join(__dirname, 'logs', 'notifications.log');

// Ensure the logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Function to write a test anomaly entry
function writeTestAnomaly() {
    const anomalyEntry = {
        timestamp: new Date().toISOString(),
        type: 'anomaly',
        severity: 'critical',
        message: 'Test anomaly detected in log monitoring system',
        details: {
            source: 'log-monitor-test',
            description: 'This is a test anomaly entry for validating the log monitoring system',
            testData: true
        }
    };

    // Append to log file
    fs.appendFileSync(logFilePath, JSON.stringify(anomalyEntry) + '\n');
    console.log('✅ Test anomaly entry written to log file');
}

// Function to write a test scan completion entry
function writeTestScanCompletion() {
    const scanEntry = {
        timestamp: new Date().toISOString(),
        type: 'scan',
        severity: 'info',
        message: 'Test scan completed successfully',
        details: {
            scanId: 'test-scan-' + Date.now(),
            status: 'completed',
            findingsCount: 3
        }
    };

    // Append to log file
    fs.appendFileSync(logFilePath, JSON.stringify(scanEntry) + '\n');
    console.log('✅ Test scan completion entry written to log file');
}

// Write test entries
console.log('Writing test entries to notifications.log...');

// Write a few test entries
writeTestAnomaly();
writeTestScanCompletion();

// Write another anomaly after a delay to test real-time monitoring
setTimeout(() => {
    console.log('\nWriting delayed anomaly entry...');
    writeTestAnomaly();
}, 3000);

console.log('\nLog monitoring system should detect these entries in real-time.');
console.log('Check your n8n webhook endpoint for forwarded notifications.');
