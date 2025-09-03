/**
 * Test script to manually trigger log monitoring
 */

const logMonitor = require('./utils/logMonitor');

console.log('=== Manual Log Monitoring Test ===');

// Show current log monitor status
console.log('Current log monitor status:', logMonitor.getStatus());

// Start monitoring if not already started
if (!logMonitor.getStatus().isMonitoring) {
    console.log('Starting log monitor...');
    logMonitor.startMonitoring();
}

// Wait a few seconds to let it process
setTimeout(() => {
    console.log('Final log monitor status:', logMonitor.getStatus());
    console.log('=== End of Test ===');
}, 5000);