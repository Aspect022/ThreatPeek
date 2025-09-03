/**
 * Utility to forward webhook events to n8n workflows
 */

const axios = require('axios');

/**
 * Forward a webhook event to n8n
 * @param {string} eventType - The type of event (e.g., 'anomaly-detected', 'scan-completed')
 * @param {Object} payload - The webhook payload data
 * @param {Object} headers - The original headers from the webhook request
 * @returns {Promise<boolean>} - Whether the forwarding was successful
 */
async function forwardToN8n(eventType, payload, headers = {}) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  
  console.log(`[N8N] Attempting to forward ${eventType} event to n8n`);
  console.log(`[N8N] n8nWebhookUrl from env: ${n8nWebhookUrl}`);
  
  // If no n8n webhook URL is configured, skip forwarding
  if (!n8nWebhookUrl) {
    console.log('[N8N] Skipping forwarding - N8N_WEBHOOK_URL not configured');
    return false;
  }
  
  try {
    // Prepare the data to send to n8n
    const n8nPayload = {
      eventType,
      payload,
      headers,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[N8N] Prepared payload:`, JSON.stringify(n8nPayload, null, 2));
    
    // Forward to n8n with a timeout
    console.log(`[N8N] Sending POST request to: ${n8nWebhookUrl}`);
    const response = await axios.post(n8nWebhookUrl, n8nPayload, {
      timeout: 5000, // 5 second timeout
      headers: {
        'Content-Type': 'application/json',
        // Forward original headers with a prefix to avoid conflicts
        ...Object.keys(headers).reduce((acc, key) => {
          acc[`x-original-${key.toLowerCase()}`] = headers[key];
          return acc;
        }, {})
      }
    });
    
    console.log(`[N8N] Successfully forwarded ${eventType} event to n8n`, {
      status: response.status,
      statusText: response.statusText
    });
    
    return true;
  } catch (error) {
    console.error(`[N8N] Failed to forward ${eventType} event to n8n:`, error.message);
    
    // Log additional error details in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[N8N] Error details:', {
        code: error.code,
        response: error.response?.data,
        url: n8nWebhookUrl
      });
    }
    
    return false;
  }
}

module.exports = { forwardToN8n };