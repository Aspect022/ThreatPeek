# ThreatPeek Real-Time Log Monitoring

## Overview

ThreatPeek now includes a real-time log monitoring system that watches the `logs/notifications.log` file for new entries and automatically triggers alerts when anomalies are detected.

## How It Works

1. The system continuously monitors the `logs/notifications.log` file
2. When new entries are added to the log file, they are parsed in real-time
3. If an entry is identified as an anomaly (type: "anomaly"), an alert is automatically triggered
4. The alert is forwarded to your configured n8n webhook endpoint

## Log Format

The log monitoring system expects entries in the following JSON format:

```json
{
  "timestamp": "2023-01-01T00:00:00.000Z",
  "type": "anomaly",
  "severity": "critical|high|medium|low",
  "message": "Description of the anomaly",
  "details": {
    "source": "source_of_anomaly",
    "additional_details": "..."
  }
}
```

## Automatic Anomaly Detection

The system automatically detects anomalies in two ways:

1. **Scan-Triggered Anomalies**: When a security scan completes with critical or high severity findings
2. **Log-Monitored Anomalies**: When external systems write anomaly entries to the notifications log

## n8n Integration

When an anomaly is detected in the logs, the system automatically forwards it to your n8n webhook with the following payload:

```json
{
  "eventType": "anomaly-detected",
  "payload": {
    "timestamp": "2023-01-01T00:00:00.000Z",
    "anomaly": "log_anomaly_detected",
    "severity": "critical",
    "source": "log_monitor",
    "details": {
      "logType": "anomaly",
      "message": "Description of the anomaly",
      "logDetails": {
        "source": "source_of_anomaly",
        "additional_details": "..."
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

## Testing

To test the log monitoring system:

1. Start the ThreatPeek backend server
2. Run the test script: `node test-log-monitor.js`
3. Check your n8n webhook endpoint for forwarded notifications

## Configuration

The log monitoring system is automatically started when the server starts and requires no additional configuration. It monitors the `logs/notifications.log` file by default.

## Log Rotation

The system handles log file rotation automatically:
- If the log file is truncated or rotated, the monitor resets its position
- New entries are detected from the beginning of the file