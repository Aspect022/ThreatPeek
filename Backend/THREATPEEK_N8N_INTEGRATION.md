# ThreatPeek API Documentation and n8n Integration Guide

## Overview

ThreatPeek provides a comprehensive API for security scanning with real-time webhook notifications for integration with automation tools like n8n. This document details all available endpoints and explains how to set up real-time alerts and monitoring.

## Real-Time Alerting System

ThreatPeek implements a dual-layer real-time alerting system:

1. **Scan-Triggered Alerts**: Automatically sent when scans complete with critical findings
2. **Log-Monitored Alerts**: Continuously monitors log files for anomaly entries and triggers alerts in real-time

### Log Monitoring

The system continuously monitors the `logs/notifications.log` file for new entries. When an anomaly is detected in the logs, it automatically:
1. Parses the log entry
2. Extracts anomaly details
3. Forwards the alert to configured n8n workflows

## API Endpoints

### 1. Enhanced Scan Endpoints

#### Start Enhanced Scan
```
POST /api/enhanced-scan
```

**Description**: Initiates a multi-phase security scan with configurable options.

**Request Body**:
```json
{
  "url": "https://example.com",
  "scanTypes": ["url", "files", "headers", "owasp"],
  "options": {
    "timeout": 60000,
    "confidenceThreshold": 0.5
  }
}
```

**Response**:
```json
{
  "scanId": "uuid-string",
  "status": "started",
  "scanTypes": ["url", "files", "headers", "owasp"],
  "target": {
    "type": "url",
    "value": "https://example.com"
  },
  "message": "Enhanced scan started successfully"
}
```

#### Get Scan Status
```
GET /api/enhanced-scan/{scanId}/status
```

**Description**: Retrieves the current status and progress of a scan.

**Response**:
```json
{
  "scanId": "uuid-string",
  "status": "running",
  "target": {
    "type": "url",
    "value": "https://example.com"
  },
  "progress": {
    "current": 2,
    "total": 4,
    "percentage": 50,
    "phases": [
      {
        "type": "url",
        "status": "completed",
        "progress": 100,
        "duration": 1200,
        "hasErrors": false
      }
    ]
  },
  "startTime": "2023-01-01T00:00:00.000Z",
  "endTime": null,
  "duration": null,
  "summary": {
    "totalFindings": 5,
    "criticalCount": 1,
    "highCount": 2,
    "mediumCount": 2,
    "lowCount": 0
  }
}
```

#### Get Scan Results
```
GET /api/enhanced-scan/{scanId}/results
```

**Description**: Retrieves complete scan results with detailed findings.

**Response**:
```json
{
  "scanId": "uuid-string",
  "target": {
    "type": "url",
    "value": "https://example.com"
  },
  "status": "completed",
  "startTime": "2023-01-01T00:00:00.000Z",
  "endTime": "2023-01-01T00:01:30.000Z",
  "duration": 90000,
  "progress": {
    "current": 4,
    "total": 4,
    "percentage": 100,
    "phases": [...]
  },
  "results": {
    "categories": [
      {
        "category": "secrets",
        "scanType": "url",
        "findings": [...],
        "summary": {
          "totalFindings": 3,
          "criticalCount": 1,
          "highCount": 1,
          "mediumCount": 1,
          "lowCount": 0
        }
      }
    ],
    "summary": {
      "totalFindings": 8,
      "criticalCount": 1,
      "highCount": 3,
      "mediumCount": 4,
      "lowCount": 0
    }
  },
  "errors": []
}
```

### 2. Webhook Endpoints

#### Receive Anomaly Detection Notifications
```
POST /api/webhook/anomaly-detected
```

**Description**: Endpoint for receiving external anomaly detection notifications.

**Request Body**:
```json
{
  "timestamp": "2023-01-01T00:00:00.000Z",
  "anomaly": "suspicious_api_call",
  "severity": "high",
  "source": "external_monitoring",
  "details": {
    "description": "Unusual API call pattern detected",
    "ipAddress": "192.168.1.100",
    "userAgent": "Custom scanner"
  }
}
```

#### Receive Scan Completion Notifications
```
POST /api/webhook/scan-completed
```

**Description**: Endpoint for receiving external scan completion notifications.

**Request Body**:
```json
{
  "scanId": "scan-uuid",
  "status": "completed",
  "results": {
    "summary": {
      "totalFindings": 5,
      "criticalCount": 1,
      "highCount": 2
    }
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

#### Generic Webhook Endpoint
```
POST /api/webhook/
```

**Description**: Generic endpoint for receiving various types of webhook notifications. Uses `X-Event-Type` header to determine event type.

**Headers**:
```
X-Event-Type: custom-event-type
```

**Request Body**:
```json
{
  "custom": "data",
  "goes": "here"
}
```

### 3. Webhook History Endpoints

#### Get All Webhook Notifications
```
GET /api/webhook-history
```

**Description**: Retrieves all stored webhook notifications.

#### Get Webhook Notifications by Type
```
GET /api/webhook-history/type/{type}
```

**Description**: Retrieves webhook notifications filtered by type (anomaly, scan_completion, generic).

## n8n Integration

### Setting Up Webhook Endpoints in n8n

1. In n8n, create a new webhook node
2. Set the HTTP method to `POST`
3. Set the path to match one of the ThreatPeek webhook endpoints:
   - For anomaly detection: `webhook/anomaly-detected`
   - For scan completion: `webhook/scan-completed`
   - For generic events: `webhook/`

### Configuring ThreatPeek to Send to n8n

1. Set the `N8N_WEBHOOK_URL` environment variable in your ThreatPeek backend:
   ```
   N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
   ```

2. The system will automatically forward all webhook events to this URL.

### Example n8n Workflow

Here's a basic n8n workflow for handling ThreatPeek alerts:

1. **Webhook Node**: 
   - Listen for POST requests at your webhook endpoint
   - Parse incoming JSON payload

2. **Function Node** (Optional):
   - Process and format the alert data
   - Extract relevant information

3. **Switch Node** (Optional):
   - Route different event types to different actions
   - Check `eventType` or `headers.x-event-type`

4. **Action Nodes**:
   - Send email notifications
   - Create tickets in issue trackers
   - Send messages to Slack/Discord
   - Trigger other automated responses

### Real-Time Log Monitoring Integration

The log monitoring system automatically detects anomalies in the `logs/notifications.log` file and forwards them to n8n without any additional configuration needed in n8n. The forwarded payload will include:

```json
{
  "eventType": "anomaly-detected",
  "payload": {
    "timestamp": "2023-01-01T00:00:00.000Z",
    "anomaly": "log_anomaly_detected",
    "severity": "high",
    "source": "log_monitor",
    "details": {
      "logType": "anomaly",
      "message": "Critical anomaly detected: Test anomaly",
      "logDetails": {
        "source": "test-script",
        "details": {
          "description": "This is a test anomaly notification",
          "testData": true
        }
      },
      "detectionSource": "log_file_monitoring"
    }
  },
  "headers": {
    "x-event-type": "log-anomaly",
    "x-source": "log-monitor"
  },
  "timestamp": "2023-01-01T00:00:01.000Z"
}
```

## Testing Webhook Integration

You can test the webhook integration using curl:

### Test Anomaly Detection Webhook
```bash
curl -X POST "http://localhost:3001/api/webhook/anomaly-detected" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2023-01-01T00:00:00.000Z",
    "anomaly": "test_anomaly",
    "severity": "critical",
    "source": "manual-test",
    "details": {
      "description": "This is a test anomaly notification"
    }
  }'
```

### Test Scan Completion Webhook
```bash
curl -X POST "http://localhost:3001/api/webhook/scan-completed" \
  -H "Content-Type: application/json" \
  -d '{
    "scanId": "test-scan-123",
    "status": "completed",
    "results": {
      "summary": {
        "totalFindings": 5,
        "criticalCount": 1,
        "highCount": 2
      }
    },
    "timestamp": "2023-01-01T00:00:00.000Z"
  }'
```

## Data Persistence

All webhook notifications are persisted in the `data/webhooks/` directory as JSON files:
- Anomaly notifications: `anomaly_{timestamp}_{id}.json`
- Scan completion notifications: `scan_{scanId}_{timestamp}.json`
- Generic notifications: `generic_{eventType}_{id}.json`

Log monitoring data is stored in `logs/notifications.log` with one JSON entry per line.

## Error Handling

The system includes comprehensive error handling:
- Failed webhook deliveries are logged but don't interrupt the main application flow
- All errors are logged to the console and appropriate log files
- Failed notifications can be retrieved from the webhook history endpoints

## Security Considerations

- All webhook endpoints are protected by CORS policies
- Rate limiting is applied to prevent abuse
- Security headers are set using Helmet.js
- In production, only trusted origins can access the API