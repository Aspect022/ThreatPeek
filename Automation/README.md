# ThreatPeek Automation System ⚡

Intelligent automation workflows powered by n8n for real-time threat alerting, notification management, and response coordination across multiple communication channels.

## 🎯 Overview

The Automation System serves as the nerve center for ThreatPeek's alert and response infrastructure, providing:

- **Multi-channel Alerting**: Email, WhatsApp, SMS, and webhook notifications
- **Intelligent Routing**: Severity-based notification routing and escalation
- **Data Integration**: Automated logging to Google Sheets and databases
- **Workflow Orchestration**: Complex response workflows and automation chains
- **Real-time Processing**: Immediate response to threat detection events
- **Customizable Logic**: Flexible workflow modification and extension

## 🛠️ Technology Stack

- **Automation Platform**: n8n (Node-based workflow automation)
- **Communication APIs**: Gmail, Twilio, Slack, Microsoft Teams
- **Data Integration**: Google Sheets, databases, REST APIs
- **Event Processing**: Webhooks, HTTP triggers, scheduled tasks
- **Configuration**: JSON-based workflow definitions
- **Monitoring**: Built-in execution logging and error handling

## 🏗️ Architecture

```
Automation/
├── 📄 Automation.json                # Main n8n workflow definition
├── 📂 workflows/                     # Additional workflow files
│   ├── 📄 threat-alerting.json      # Core threat alerting workflow
│   ├── 📄 escalation.json           # Escalation procedures
│   ├── 📄 reporting.json            # Automated reporting
│   └── 📄 maintenance.json          # System maintenance tasks
├── 📂 templates/                     # Message and email templates
│   ├── 📄 email-templates.html      # HTML email templates
│   ├── 📄 sms-templates.json        # SMS message templates
│   └── 📄 webhook-payloads.json     # Webhook payload templates
├── 📂 assets/                        # Workflow assets and images
│   ├── 📄 workflow-diagram.png      # Workflow visualization
│   ├── 📄 alert-flow.png           # Alert flow diagram
│   └── 📄 automation-overview.png   # System overview
├── 📂 config/                        # Configuration files
│   ├── 📄 credentials.json          # Service credentials template
│   ├── 📄 settings.json             # Workflow settings
│   └── 📄 environment.json          # Environment configuration
└── 📂 documentation/                 # Additional documentation
    ├── 📄 workflow-guide.md         # Workflow configuration guide
    ├── 📄 api-reference.md          # API integration reference
    └── 📄 troubleshooting.md        # Common issues and solutions
```

## 🚀 Quick Start

### Prerequisites

- n8n platform (self-hosted or cloud)
- Gmail account with app passwords enabled
- Twilio account for SMS/WhatsApp
- Google Sheets API access
- ThreatPeek backend service running

### Installation

1. **Install n8n** (if not already installed)
   ```bash
   # Via npm
   npm install -g n8n
   
   # Via Docker
   docker run -it --rm \
     --name n8n \
     -p 5678:5678 \
     -v ~/.n8n:/home/node/.n8n \
     n8nio/n8n
   ```

2. **Access n8n Interface**
   ```
   http://localhost:5678
   ```

3. **Import Workflow**
   - Open n8n interface
   - Click "Import from file"
   - Select `Automation.json`
   - Configure credentials and settings

### Workflow Configuration

#### Required Credentials

1. **Gmail Account**
   - Enable 2-factor authentication
   - Generate app-specific password
   - Configure in n8n Gmail node

2. **Twilio Account**
   - Account SID
   - Auth Token
   - Phone number for SMS/WhatsApp

3. **Google Sheets**
   - Service account credentials
   - Sheet ID and permissions

## 📊 Workflow Components

### Core Automation Workflow

The main `Automation.json` workflow includes:

#### 1. Webhook Trigger
```json
{
  "name": "Threat Alert Webhook",
  "type": "webhook",
  "httpMethod": "POST",
  "path": "/threat-alert",
  "responseMode": "onReceived"
}
```

**Expected Payload:**
```json
{
  "timestamp": "2023-10-15T14:30:00Z",
  "threat_type": "steganography|anomaly|malware",
  "severity": "low|medium|high|critical",
  "confidence": 0.95,
  "source": "stegoshield|anomaly_detection|manual",
  "details": {
    "filename": "suspicious_image.png",
    "analysis_results": {},
    "metadata": {}
  },
  "user_id": "user123",
  "session_id": "session456"
}
```

#### 2. Severity Assessment Node
```javascript
// Code node for threat classification
const threatData = $json;
let alertLevel = 'info';
let urgency = 'normal';

// Determine alert level based on severity and confidence
if (threatData.severity === 'critical' || threatData.confidence > 0.9) {
    alertLevel = 'critical';
    urgency = 'high';
} else if (threatData.severity === 'high' || threatData.confidence > 0.7) {
    alertLevel = 'warning';
    urgency = 'medium';
} else {
    alertLevel = 'info';
    urgency = 'low';
}

// Prepare notification data
return [{
    json: {
        ...threatData,
        alert_level: alertLevel,
        urgency: urgency,
        notification_channels: alertLevel === 'critical' ? ['email', 'sms', 'whatsapp'] : ['email'],
        response_required: alertLevel === 'critical'
    }
}];
```

#### 3. Email Notification Node
```json
{
  "name": "Gmail Alert",
  "type": "gmail",
  "operation": "send",
  "parameters": {
    "to": "security-team@company.com",
    "subject": "🚨 ThreatPeek Alert: {{ $json.alert_level }} - {{ $json.threat_type }}",
    "message": "HTML template with threat details",
    "attachments": []
  }
}
```

**Email Template:**
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        .alert-critical { background-color: #dc2626; color: white; }
        .alert-warning { background-color: #f59e0b; color: white; }
        .alert-info { background-color: #3b82f6; color: white; }
    </style>
</head>
<body>
    <div class="alert-{{ $json.alert_level }}">
        <h2>🚨 ThreatPeek Security Alert</h2>
        <p><strong>Threat Type:</strong> {{ $json.threat_type }}</p>
        <p><strong>Severity:</strong> {{ $json.severity }}</p>
        <p><strong>Confidence:</strong> {{ $json.confidence }}%</p>
        <p><strong>Detected At:</strong> {{ $json.timestamp }}</p>
        
        <h3>Details:</h3>
        <ul>
            <li><strong>Source:</strong> {{ $json.source }}</li>
            <li><strong>File:</strong> {{ $json.details.filename }}</li>
            <li><strong>User ID:</strong> {{ $json.user_id }}</li>
        </ul>
        
        <p><strong>Action Required:</strong> 
           {{ $json.response_required ? 'Immediate investigation needed' : 'Monitor and review' }}
        </p>
    </div>
</body>
</html>
```

#### 4. SMS/WhatsApp Notification (Critical Alerts Only)
```json
{
  "name": "Twilio SMS Alert",
  "type": "twilio",
  "operation": "send",
  "parameters": {
    "to": "+1234567890",
    "message": "🚨 CRITICAL ThreatPeek Alert: {{ $json.threat_type }} detected with {{ $json.confidence }}% confidence. Immediate action required. Check email for details."
  },
  "executeOnCondition": "$json.alert_level === 'critical'"
}
```

#### 5. Google Sheets Logging
```json
{
  "name": "Log to Google Sheets",
  "type": "googleSheets",
  "operation": "append",
  "parameters": {
    "sheetId": "your-sheet-id",
    "range": "Threat_Log!A:H",
    "values": [
      ["{{ $json.timestamp }}", "{{ $json.threat_type }}", "{{ $json.severity }}", 
       "{{ $json.confidence }}", "{{ $json.source }}", "{{ $json.details.filename }}", 
       "{{ $json.user_id }}", "{{ $json.alert_level }}"]
    ]
  }
}
```

### Advanced Workflow Features

#### Conditional Routing
```javascript
// Router node for different threat types
const threatType = $json.threat_type;

switch(threatType) {
    case 'steganography':
        return [[$json], [], []]; // Route to steganography handler
    case 'anomaly':
        return [[], [$json], []]; // Route to anomaly handler
    case 'malware':
        return [[], [], [$json]]; // Route to malware handler
    default:
        return [[$json], [], []]; // Default route
}
```

#### Escalation Logic
```javascript
// Escalation timer and logic
const alertTime = new Date($json.timestamp);
const currentTime = new Date();
const timeDiff = (currentTime - alertTime) / (1000 * 60); // Minutes

// Escalate if critical alert not acknowledged within 15 minutes
if ($json.alert_level === 'critical' && timeDiff > 15 && !$json.acknowledged) {
    return [{
        json: {
            ...$json,
            escalated: true,
            escalation_level: 2,
            notification_channels: ['email', 'sms', 'slack', 'teams'],
            recipients: ['security-manager@company.com', 'ciso@company.com']
        }
    }];
}

return [{ json: $json }];
```

## 📱 Communication Channels

### Email Notifications

**Features:**
- HTML-formatted alerts with severity-based styling
- Detailed threat information and metadata
- Actionable links for investigation
- Attachment support for reports and evidence

**Configuration:**
```json
{
  "gmail_settings": {
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "use_tls": true,
    "username": "alerts@yourcompany.com",
    "app_password": "your-app-password"
  }
}
```

### SMS Notifications

**Features:**
- Concise critical alerts
- Immediate delivery for urgent threats
- Multi-recipient support
- International number support

**Message Templates:**
```json
{
  "critical": "🚨 CRITICAL: {{ threat_type }} detected ({{ confidence }}% confidence). Immediate action required.",
  "high": "⚠️  HIGH: {{ threat_type }} threat detected. Please investigate.",
  "escalation": "🔥 ESCALATED: Critical alert not acknowledged. Immediate response needed."
}
```

### WhatsApp Business

**Features:**
- Rich media messages with images
- Interactive buttons for quick responses
- Group notifications for teams
- Message templates compliance

### Slack/Teams Integration

**Features:**
- Channel-based notifications
- Interactive message buttons
- Thread-based discussions
- Integration with incident management

## 📊 Data Integration

### Google Sheets Logging

**Sheet Structure:**
| Column | Field | Description |
|--------|-------|-------------|
| A | Timestamp | Alert generation time |
| B | Threat Type | Type of threat detected |
| C | Severity | Threat severity level |
| D | Confidence | Detection confidence score |
| E | Source | Detection source component |
| F | Filename | Related file or asset |
| G | User ID | Associated user identifier |
| H | Alert Level | Processed alert level |
| I | Status | Alert status (open/investigating/resolved) |
| J | Response Time | Time to acknowledgment |

### Database Integration

```javascript
// Database logging node
const logEntry = {
    timestamp: $json.timestamp,
    threat_type: $json.threat_type,
    severity: $json.severity,
    confidence: $json.confidence,
    source: $json.source,
    user_id: $json.user_id,
    alert_level: $json.alert_level,
    metadata: JSON.stringify($json.details)
};

// Insert into threats table
const query = `
    INSERT INTO threat_alerts 
    (timestamp, threat_type, severity, confidence, source, user_id, alert_level, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

return [{ json: { query, params: Object.values(logEntry) } }];
```

## ⚙️ Configuration Management

### Environment Variables

```json
{
  "GMAIL_USERNAME": "alerts@company.com",
  "GMAIL_APP_PASSWORD": "your-app-password",
  "TWILIO_ACCOUNT_SID": "your-twilio-sid",
  "TWILIO_AUTH_TOKEN": "your-twilio-token",
  "TWILIO_PHONE_NUMBER": "+1234567890",
  "GOOGLE_SHEETS_ID": "your-sheet-id",
  "WEBHOOK_SECRET": "your-webhook-secret",
  "ALERT_RECIPIENTS": "security@company.com,admin@company.com"
}
```

### Workflow Settings

```json
{
  "alert_thresholds": {
    "critical_confidence": 0.9,
    "high_confidence": 0.7,
    "medium_confidence": 0.5
  },
  "escalation_timeouts": {
    "critical": 900,  // 15 minutes
    "high": 3600,     // 1 hour
    "medium": 14400   // 4 hours
  },
  "notification_preferences": {
    "email_enabled": true,
    "sms_enabled": true,
    "whatsapp_enabled": false,
    "slack_enabled": true
  }
}
```

## 🔄 Integration Points

### ThreatPeek Backend Integration

```javascript
// Backend webhook sender
app.post('/api/threat-detected', async (req, res) => {
    const threatData = {
        timestamp: new Date().toISOString(),
        threat_type: req.body.type,
        severity: req.body.severity,
        confidence: req.body.confidence,
        source: 'backend',
        details: req.body.details,
        user_id: req.body.user_id,
        session_id: req.body.session_id
    };

    // Send to n8n webhook
    try {
        await axios.post('http://n8n:5678/webhook/threat-alert', threatData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.N8N_WEBHOOK_SECRET}`
            }
        });
        
        res.json({ success: true, message: 'Alert sent successfully' });
    } catch (error) {
        console.error('Failed to send alert:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

### Anomaly Detection Integration

```python
# Python ML service integration
import requests
import json

def send_anomaly_alert(prediction_results):
    """Send anomaly detection results to automation system"""
    
    webhook_url = "http://n8n:5678/webhook/threat-alert"
    
    for result in prediction_results:
        if result['anomaly_confidence'] > 0.7:
            alert_data = {
                'timestamp': datetime.now().isoformat(),
                'threat_type': 'anomaly',
                'severity': 'high' if result['anomaly_confidence'] > 0.9 else 'medium',
                'confidence': result['anomaly_confidence'],
                'source': 'anomaly_detection',
                'details': {
                    'model': result['model_name'],
                    'features': result['features'],
                    'anomaly_score': result['anomaly_score']
                },
                'user_id': result.get('user_id', 'system'),
                'session_id': result.get('session_id', 'batch')
            }
            
            try:
                response = requests.post(webhook_url, json=alert_data)
                response.raise_for_status()
                print(f"Alert sent for anomaly: {result['anomaly_confidence']}")
            except requests.RequestException as e:
                print(f"Failed to send alert: {e}")
```

## 📈 Monitoring & Analytics

### Workflow Execution Monitoring

n8n provides built-in monitoring for:
- **Execution History**: All workflow runs with success/failure status
- **Performance Metrics**: Execution time and resource usage
- **Error Tracking**: Failed executions with error details
- **Node Statistics**: Individual node performance and success rates

### Custom Analytics Dashboard

```javascript
// Analytics data collection node
const executionStats = {
    workflow_id: $workflow.id,
    execution_id: $execution.id,
    start_time: $execution.startedAt,
    end_time: new Date(),
    success: $execution.finished,
    error_count: $execution.data.resultData.error ? 1 : 0,
    nodes_executed: Object.keys($execution.data.resultData.runData).length,
    alert_data: $json
};

// Send to analytics service
return [{ json: executionStats }];
```

## 🛟 Troubleshooting

### Common Issues

**Webhook Not Triggering**
- Verify webhook URL and method
- Check firewall and network connectivity
- Validate request payload format
- Ensure proper authentication headers

**Email Delivery Failures**
- Verify Gmail app password and 2FA
- Check SMTP settings and ports
- Validate recipient email addresses
- Review Gmail sending limits

**SMS/WhatsApp Issues**
- Confirm Twilio account balance
- Verify phone number formats
- Check Twilio service status
- Review message content compliance

**Google Sheets Errors**
- Validate service account permissions
- Check sheet ID and range references
- Verify API quotas and limits
- Ensure proper column mapping

### Debug Mode

Enable detailed logging in n8n:
```bash
# Environment variable
N8N_LOG_LEVEL=debug

# Or in n8n interface
Settings > Log Level > Debug
```

### Testing Workflows

```bash
# Test webhook endpoint
curl -X POST http://localhost:5678/webhook/threat-alert \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2023-10-15T14:30:00Z",
    "threat_type": "test",
    "severity": "medium",
    "confidence": 0.8,
    "source": "manual_test",
    "details": {"test": true},
    "user_id": "test_user"
  }'
```

## 🔮 Future Enhancements

- [ ] **AI-Powered Triage**: Machine learning for alert prioritization
- [ ] **Incident Management**: Integration with ITSM platforms
- [ ] **Response Orchestration**: Automated response actions
- [ ] **Advanced Analytics**: Threat trend analysis and reporting
- [ ] **Multi-tenant Support**: Organization-specific workflow isolation
- [ ] **Mobile App Integration**: Push notifications and mobile responses
- [ ] **Blockchain Logging**: Immutable audit trails
- [ ] **Real-time Dashboards**: Live threat monitoring interfaces

## 🤝 Contributing

1. Follow n8n workflow best practices
2. Test all notification channels thoroughly
3. Document configuration changes
4. Validate webhook payloads
5. Consider scalability and performance

---

For detailed n8n documentation, visit: https://docs.n8n.io/
