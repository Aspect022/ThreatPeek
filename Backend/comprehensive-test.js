/**
 * Comprehensive test for log monitoring and n8n integration
 */

const fs = require('fs');
const path = require('path');
const logMonitor = require('./utils/logMonitor');
const { forwardToN8n } = require('./utils/n8nForwarder');

console.log('=== ThreatPeek Log Monitoring and n8n Integration Test ===\n');

// 1. Check if n8n webhook URL is configured
console.log('1. Checking n8n webhook URL configuration...');
const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
console.log(`   N8N_WEBHOOK_URL: ${n8nWebhookUrl}`);
if (!n8nWebhookUrl) {
    console.log('   ❌ ERROR: N8N_WEBHOOK_URL is not configured!');
    process.exit(1);
}
console.log('   ✅ N8N_WEBHOOK_URL is configured\n');

// 2. Check if log file exists and has content
console.log('2. Checking notifications.log file...');
const logFilePath = path.join(__dirname, 'logs', 'notifications.log');
console.log(`   Log file path: ${logFilePath}`);

if (!fs.existsSync(logFilePath)) {
    console.log('   ℹ️  Log file does not exist, will create it');
    fs.writeFileSync(logFilePath, '', 'utf8');
} else {
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    console.log(`   Log file size: ${logContent.length} characters`);
    console.log(`   Log file lines: ${logContent.split('\n').filter(line => line.trim()).length}`);
    if (logContent.length > 0) {
        console.log('   ✅ Log file exists and has content');
    }
}

// 3. Test direct n8n forwarding
console.log('\n3. Testing direct n8n forwarding...');
const testPayload = {
    timestamp: new Date().toISOString(),
    anomaly: 'integration_test',
    severity: 'info',
    source: 'test-script',
    details: {
        testType: 'direct_forwarding',
        description: 'Testing direct n8n forwarding'
    }
};

forwardToN8n('test-event', testPayload, {
    'x-event-type': 'integration-test',
    'x-source': 'test-script'
}).then(result => {
    console.log(`   Direct forwarding result: ${result ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    // 4. Test log monitoring
    console.log('\n4. Testing log monitoring...');
    
    // Add a test entry to the log
    const testAnomaly = {
        timestamp: new Date().toISOString(),
        type: 'anomaly',
        severity: 'critical',
        message: 'Integration test anomaly',
        details: {
            source: 'integration-test',
            description: 'This is a test anomaly for integration testing'
        }
    };
    
    console.log('   Adding test anomaly to log file...');
    fs.appendFileSync(logFilePath, JSON.stringify(testAnomaly) + '\n');
    console.log('   ✅ Test anomaly added to log file');
    
    // Start log monitoring
    console.log('   Starting log monitor...');
    logMonitor.startMonitoring();
    
    console.log('   Log monitor status:', logMonitor.getStatus());
    
    // Wait a few seconds to see if it processes the entry
    setTimeout(() => {
        console.log('\n5. Final status check...');
        console.log('   Log monitor status:', logMonitor.getStatus());
        console.log('\n=== Test completed ===');
    }, 5000);
    
}).catch(error => {
    console.log(`   ❌ ERROR in direct forwarding: ${error.message}`);
});
