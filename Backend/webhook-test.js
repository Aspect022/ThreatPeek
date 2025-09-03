const axios = require('axios');

// Test the webhook endpoints
async function testWebhooks() {
  const baseURL = 'http://localhost:3001/api/webhook';
  
  // Test anomaly detected webhook
  try {
    console.log('Testing anomaly detection webhook...');
    const anomalyResponse = await axios.post(`${baseURL}/anomaly-detected`, {
      timestamp: new Date().toISOString(),
      anomaly: 'Test anomaly',
      severity: 'high',
      source: 'test-script',
      details: {
        description: 'This is a test anomaly notification',
        testData: true
      }
    });
    console.log('Anomaly webhook response:', anomalyResponse.data);
  } catch (error) {
    console.error('Error testing anomaly webhook:', error.response?.data || error.message);
  }
  
  // Test scan completed webhook
  try {
    console.log('\nTesting scan completion webhook...');
    const scanResponse = await axios.post(`${baseURL}/scan-completed`, {
      scanId: 'test-scan-123',
      status: 'completed',
      results: {
        summary: {
          totalFindings: 5,
          criticalFindings: 1,
          highFindings: 2
        },
        findings: [
          {
            id: 1,
            type: 'security_issue',
            severity: 'critical',
            description: 'Test critical finding'
          }
        ]
      },
      timestamp: new Date().toISOString()
    });
    console.log('Scan completion webhook response:', scanResponse.data);
  } catch (error) {
    console.error('Error testing scan completion webhook:', error.response?.data || error.message);
  }
  
  // Test generic webhook
  try {
    console.log('\nTesting generic webhook...');
    const genericResponse = await axios.post(`${baseURL}/`, {
      eventType: 'test-event',
      data: {
        message: 'This is a test generic webhook',
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'X-Event-Type': 'test-event'
      }
    });
    console.log('Generic webhook response:', genericResponse.data);
  } catch (error) {
    console.error('Error testing generic webhook:', error.response?.data || error.message);
  }
  
  // Test webhook history endpoint
  try {
    console.log('\nTesting webhook history endpoint...');
    const historyResponse = await axios.get('http://localhost:3001/api/webhook-history');
    console.log('Webhook history response:', historyResponse.data);
  } catch (error) {
    console.error('Error testing webhook history:', error.response?.data || error.message);
  }
}

testWebhooks();