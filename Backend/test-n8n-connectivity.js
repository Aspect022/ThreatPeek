/**
 * Test n8n connectivity
 */

const axios = require('axios');

async function testN8nConnectivity() {
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/anomaly-detected';
    
    console.log('Testing n8n connectivity...');
    console.log(`Target URL: ${n8nWebhookUrl}`);
    
    try {
        // Test with a simple GET request first
        console.log('Trying GET request...');
        const getResponse = await axios.get(n8nWebhookUrl, { timeout: 5000 });
        console.log(`GET Response: ${getResponse.status} - ${getResponse.statusText}`);
    } catch (error) {
        console.log(`GET Request failed: ${error.message}`);
        if (error.response) {
            console.log(`Response status: ${error.response.status}`);
        }
    }
    
    try {
        // Test with a POST request
        console.log('Trying POST request...');
        const testPayload = {
            test: 'connectivity',
            timestamp: new Date().toISOString()
        };
        
        const postResponse = await axios.post(n8nWebhookUrl, testPayload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log(`POST Response: ${postResponse.status} - ${postResponse.statusText}`);
    } catch (error) {
        console.log(`POST Request failed: ${error.message}`);
        if (error.response) {
            console.log(`Response status: ${error.response.status}`);
            console.log(`Response data: ${JSON.stringify(error.response.data)}`);
        }
    }
    
    console.log('Test completed.');
}

testN8nConnectivity();