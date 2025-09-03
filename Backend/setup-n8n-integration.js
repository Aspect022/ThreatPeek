/**
 * Complete test and setup guide for ThreatPeek n8n integration
 */

const fs = require('fs');
const path = require('path');

console.log('=== ThreatPeek n8n Integration Setup and Test ===\n');

// 1. Check environment configuration
console.log('1. Environment Configuration Check');
console.log('----------------------------------');

const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
console.log(`N8N_WEBHOOK_URL: ${n8nWebhookUrl}`);

if (!n8nWebhookUrl || n8nWebhookUrl.includes('your-webhook-id')) {
    console.log('❌ ISSUE: N8N_WEBHOOK_URL is not properly configured');
    console.log('   You need to replace "your-webhook-id" with your actual n8n webhook ID');
    console.log('   Example: http://localhost:5678/webhook/a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8');
} else {
    console.log('✅ N8N_WEBHOOK_URL is configured');
}

// 2. Check if n8n is running
console.log('\n2. n8n Service Check');
console.log('--------------------');

const axios = require('axios');

async function testN8nConnectivity() {
    if (!n8nWebhookUrl || n8nWebhookUrl.includes('your-webhook-id')) {
        console.log('   Skipping n8n connectivity test - URL not configured');
        return;
    }
    
    try {
        // Test if n8n is reachable
        const response = await axios.get('http://localhost:5678', { timeout: 3000 });
        console.log('✅ n8n is running on http://localhost:5678');
    } catch (error) {
        console.log('⚠️  WARNING: Cannot reach n8n on http://localhost:5678');
        console.log('   Make sure n8n is running on your local machine');
    }
}

// 3. Check log file and existing anomalies
console.log('\n3. Log File and Anomaly Check');
console.log('-----------------------------');

const logFilePath = path.join(__dirname, 'logs', 'notifications.log');
console.log(`Log file path: ${logFilePath}`);

if (!fs.existsSync(logFilePath)) {
    console.log('ℹ️  Log file does not exist yet');
} else {
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim() !== '');
    console.log(`Log file contains ${lines.length} entries`);
    
    let anomalyCount = 0;
    lines.forEach(line => {
        try {
            const entry = JSON.parse(line);
            if (entry.type === 'anomaly') {
                anomalyCount++;
            }
        } catch (e) {
            // Ignore invalid JSON lines
        }
    });
    
    console.log(`Found ${anomalyCount} anomaly entries in log file`);
    
    if (anomalyCount > 0) {
        console.log('✅ Anomalies are being logged correctly');
    }
}

// 4. Instructions for setting up n8n webhook
console.log('\n4. n8n Setup Instructions');
console.log('-------------------------');
console.log('To set up the n8n webhook integration:');
console.log('');
console.log('1. In n8n:');
console.log('   - Create a new workflow');
console.log('   - Add a "Webhook" node');
console.log('   - Set HTTP Method to "POST"');
console.log('   - Note the webhook URL (it will look like http://localhost:5678/webhook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)');
console.log('');
console.log('2. Update your .env file:');
console.log('   - Set N8N_WEBHOOK_URL to the webhook URL from n8n');
console.log('   - Example: N8N_WEBHOOK_URL=http://localhost:5678/webhook/a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8');
console.log('');
console.log('3. Restart the ThreatPeek backend server');
console.log('');
console.log('4. Test the integration:');
console.log('   - Run a security scan that produces findings');
console.log('   - Or manually add an anomaly to the log file');
console.log('   - Check your n8n workflow to see if it receives the webhook');

// 5. Test the integration
console.log('\n5. Integration Test');
console.log('-------------------');

async function runTests() {
    await testN8nConnectivity();
    
    console.log('\n=== Setup and Test Complete ===');
    console.log('\nNext steps:');
    console.log('1. Follow the n8n setup instructions above');
    console.log('2. Configure your N8N_WEBHOOK_URL in the .env file');
    console.log('3. Restart the ThreatPeek backend server');
    console.log('4. Run a security scan or add a test anomaly to verify integration');
}

runTests();
