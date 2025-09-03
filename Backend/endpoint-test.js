const axios = require('axios');

// Test various endpoints to see which ones are available
async function testEndpoints() {
  const baseURL = 'http://localhost:3001/api';
  
  const endpoints = [
    '/', // Health check
    '/webhook/anomaly-detected', // Webhook anomaly
    '/webhook/scan-completed', // Webhook scan completion
    '/webhook/', // Generic webhook
    '/webhook-history', // Webhook history
    '/webhook-history/type/anomaly', // Webhook history by type
    '/scan/test', // Test scan endpoint
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing endpoint: ${endpoint}...`);
      // For webhooks, we'll do a POST request, for others GET
      const method = endpoint.includes('/webhook/') ? 'post' : 'get';
      const response = await axios[method](`${baseURL}${endpoint}`, method === 'post' ? {} : undefined);
      console.log(`✓ ${endpoint}: ${response.status} - ${response.data.status || 'OK'}`);
    } catch (error) {
      if (error.response) {
        console.log(`✗ ${endpoint}: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        console.log(`✗ ${endpoint}: Network error - ${error.message}`);
      }
    }
  }
}

testEndpoints();