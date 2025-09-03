const axios = require('axios');

// Test the webhook history endpoints specifically
async function testWebhookHistory() {
  const baseURL = 'http://localhost:3001/api/webhook-history';
  
  // Test getting all notifications
  try {
    console.log('Testing webhook history (all notifications)...');
    const response = await axios.get(baseURL);
    console.log('Webhook history response:', response.data);
  } catch (error) {
    console.error('Error testing webhook history:', error.response?.data || error.message);
  }
  
  // Test getting notifications by type
  const types = ['anomaly', 'scan_completion', 'generic'];
  for (const type of types) {
    try {
      console.log(`\nTesting webhook history for type: ${type}...`);
      const response = await axios.get(`${baseURL}/type/${type}`);
      console.log(`Webhook history (${type}) response:`, response.data);
    } catch (error) {
      console.error(`Error testing webhook history for type ${type}:`, error.response?.data || error.message);
    }
  }
  
  // Test with invalid type
  try {
    console.log('\nTesting webhook history with invalid type...');
    const response = await axios.get(`${baseURL}/type/invalid`);
    console.log('Webhook history (invalid type) response:', response.data);
  } catch (error) {
    console.error('Error testing webhook history with invalid type:', error.response?.data || error.message);
  }
}

testWebhookHistory();
