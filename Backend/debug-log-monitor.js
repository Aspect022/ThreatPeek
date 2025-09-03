/**
 * Debug script for log monitoring system
 * This script tests if the log monitor is working correctly
 */

const logMonitor = require('./utils/logMonitor');
const fs = require('fs');
const path = require('path');

// Path to the notifications log file
const logFilePath = path.join(__dirname, 'logs', 'notifications.log');

console.log('=== Log Monitor Debug Script ===');

// Show current log monitor status
console.log('Current log monitor status:', logMonitor.getStatus());

// Show current log file content
console.log('\nCurrent log file content:');
try {
    const content = fs.readFileSync(logFilePath, 'utf8');
    console.log(content);
} catch (error) {
    console.log('Error reading log file:', error.message);
}

// Start monitoring
console.log('\nStarting log monitor...');
logMonitor.startMonitoring();

// Show status after starting
console.log('Log monitor status after starting:', logMonitor.getStatus());

// Wait a few seconds and check again
setTimeout(() => {
    console.log('\nLog monitor status after timeout:', logMonitor.getStatus());
    
    // Add a new test entry
    console.log('\nAdding a new test anomaly entry...');
    const testEntry = {
        timestamp: new Date().toISOString(),
        type: 'anomaly',
        severity: 'critical',
        message: 'Debug test anomaly',
        details: {
            source: 'debug-script',
            description: 'This is a test entry for debugging the log monitor'
        }
    };
    
    fs.appendFileSync(logFilePath, JSON.stringify(testEntry) + '\n');
    console.log('Test entry added to log file');
    
    // Wait a bit more to see if it's detected
    setTimeout(() => {
        console.log('\nFinal log monitor status:', logMonitor.getStatus());
        console.log('=== End of Debug Script ===');
    }, 3000);
}, 3000);
