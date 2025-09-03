# ThreatPeek Enhanced Scanner API Documentation

## Overview

The ThreatPeek Enhanced Scanner API provides comprehensive security scanning capabilities for web applications and Git repositories. This API supports multiple scan types including secret detection, file exposure analysis, security header validation, and OWASP Top 10 baseline checks.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Currently, the API does not require authentication. In production environments, implement appropriate authentication mechanisms such as API keys or JWT tokens.

## Rate Limiting

The API implements rate limiting to prevent abuse:

- Default: 5 requests per second per IP
- Burst limit: 10 requests
- Backoff strategy: Exponential

## API Endpoints

### 1. Start Enhanced Scan

Start a new security scan with multiple scan types.

**Endpoint:** `POST /scan/enhanced`

**Request Body:**

```json
{
  "url": "https://example.com",
  "repositoryUrl": "https://github.com/user/repo.git",
  "scanTypes": ["url", "repository", "files", "headers", "owasp"],
  "options": {
    "maxDepth": 3,
    "timeout": 30000,
    "confidenceThreshold": 0.5,
    "includePatterns": ["*.js", "*.html"],
    "excludePatterns": ["*.min.js", "node_modules/**"],
    "rateLimit": {
      "requestsPerSecond": 5,
      "burstLimit": 10,
      "backoffStrategy": "exponential"
    },
    "realTimeUpdates": false,
    "aiAnalysis": true,
    "specializedGuidance": true,
    "findingConsolidation": true
  }
}
```

**Parameters:**

| Parameter       | Type   | Required    | Description                                                         |
| --------------- | ------ | ----------- | ------------------------------------------------------------------- |
| `url`           | string | Conditional | Target URL to scan (required if repositoryUrl not provided)         |
| `repositoryUrl` | string | Conditional | Git repository URL to clone and scan (required if url not provided) |
| `scanTypes`     | array  | No          | Array of scan types to perform (default: ["url"])                   |
| `options`       | object | No          | Scan configuration options                                          |

**Scan Types:**

- `url`: Scan web pages for exposed secrets and vulnerabilities
- `repository`: Clone and scan Git repositories
- `files`: Detect exposed sensitive files and directories
- `headers`: Analyze HTTP security headers
- `owasp`: Check for OWASP Top 10 vulnerabilities

**Options:**

| Option                 | Type    | Default   | Description                                     |
| ---------------------- | ------- | --------- | ----------------------------------------------- |
| `maxDepth`             | number  | 3         | Maximum crawling depth for URL scans            |
| `timeout`              | number  | 30000     | Request timeout in milliseconds                 |
| `confidenceThreshold`  | number  | 0.5       | Minimum confidence score for findings (0.0-1.0) |
| `includePatterns`      | array   | []        | File patterns to include in scanning            |
| `excludePatterns`      | array   | []        | File patterns to exclude from scanning          |
| `rateLimit`            | object  | See above | Rate limiting configuration                     |
| `realTimeUpdates`      | boolean | false     | Enable real-time progress updates               |
| `aiAnalysis`           | boolean | true      | Enable AI-enhanced analysis                     |
| `specializedGuidance`  | boolean | true      | Enable specialized security guidance            |
| `findingConsolidation` | boolean | true      | Enable finding consolidation and grouping       |

**Response:**

```json
{
  "scanId": "uuid-string",
  "status": "started",
  "scanTypes": ["url", "headers"],
  "target": {
    "type": "url",
    "value": "https://example.com"
  },
  "message": "Enhanced scan started successfully"
}
```

**Status Codes:**

- `200`: Scan started successfully
- `400`: Invalid request parameters
- `500`: Internal server error

---

### 2. Get Scan Status

Retrieve the current status and progress of a scan.

**Endpoint:** `GET /scan/enhanced/{scanId}/status`

**Parameters:**

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `scanId`  | string | Yes      | Unique scan identifier |

**Response:**

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
        "duration": 5000,
        "hasErrors": false
      },
      {
        "type": "headers",
        "status": "running",
        "progress": 75,
        "duration": null,
        "hasErrors": false
      }
    ]
  },
  "startTime": "2024-01-01T12:00:00.000Z",
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

**Status Values:**

- `initializing`: Scan is being set up
- `running`: Scan is actively running
- `completed`: Scan completed successfully
- `partial`: Scan completed with some errors
- `failed`: Scan failed completely
- `cancelled`: Scan was cancelled by user
- `timeout`: Scan exceeded time limit

**Status Codes:**

- `200`: Status retrieved successfully
- `404`: Scan not found
- `500`: Internal server error

---

### 3. Get Scan Results

Retrieve complete scan results with filtering and formatting options.

**Endpoint:** `GET /scan/enhanced/{scanId}/results`

**Parameters:**

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `scanId`  | string | Yes      | Unique scan identifier |

**Query Parameters:**

| Parameter             | Type    | Default    | Description                        |
| --------------------- | ------- | ---------- | ---------------------------------- |
| `format`              | string  | "json"     | Output format (json, csv, sarif)   |
| `category`            | string  | null       | Filter by finding category         |
| `severity`            | string  | null       | Filter by severity level           |
| `confidenceThreshold` | number  | null       | Filter by minimum confidence score |
| `includeContext`      | boolean | true       | Include contextual information     |
| `sortBy`              | string  | "severity" | Sort results by field              |
| `sortOrder`           | string  | "desc"     | Sort order (asc, desc)             |
| `limit`               | number  | null       | Maximum number of results          |
| `offset`              | number  | 0          | Results offset for pagination      |
| `consolidated`        | boolean | false      | Return consolidated report         |

**Response (JSON format):**

```json
{
  "scanId": "uuid-string",
  "target": {
    "type": "url",
    "value": "https://example.com"
  },
  "status": "completed",
  "startTime": "2024-01-01T12:00:00.000Z",
  "endTime": "2024-01-01T12:05:00.000Z",
  "duration": 300000,
  "results": {
    "categories": [
      {
        "category": "secrets",
        "scanType": "url",
        "findings": [
          {
            "id": "finding-uuid",
            "type": "api_key",
            "severity": "high",
            "confidence": 0.95,
            "title": "Exposed API Key",
            "description": "Stripe API key found in JavaScript file",
            "location": {
              "file": "js/config.js",
              "line": 15,
              "url": "https://example.com/js/config.js"
            },
            "evidence": {
              "value": "sk_test_****",
              "context": "const apiKey = 'sk_test_4eC39HqLyjWDarjtT1zdp7dc';"
            },
            "remediation": {
              "summary": "Remove API key from client-side code",
              "steps": [
                "Move API key to server-side environment variables",
                "Use public key for client-side operations",
                "Rotate the exposed API key immediately"
              ]
            },
            "aiAnalysis": {
              "explanation": "This Stripe API key is exposed in client-side JavaScript...",
              "impact": "High - Allows unauthorized access to Stripe account",
              "remediation": "Immediate action required to rotate key and implement secure storage"
            }
          }
        ],
        "summary": {
          "totalFindings": 1,
          "criticalCount": 0,
          "highCount": 1,
          "mediumCount": 0,
          "lowCount": 0
        }
      }
    ],
    "summary": {
      "totalFindings": 1,
      "criticalCount": 0,
      "highCount": 1,
      "mediumCount": 0,
      "lowCount": 0,
      "overallRiskScore": 7.5,
      "riskLevel": "high"
    },
    "aiAnalysis": {
      "summary": {
        "overallRiskScore": 7.5,
        "riskLevel": "high",
        "prioritizedFindings": ["finding-uuid"]
      },
      "recommendations": [
        "Implement secure API key management",
        "Add security headers to prevent XSS",
        "Regular security audits recommended"
      ]
    },
    "specializedGuidance": {
      "securityMisconfigurations": {
        "apiKeyExposure": {
          "description": "API keys exposed in client-side code",
          "remediation": "Use environment variables and server-side proxy",
          "codeExamples": [
            "// Server-side (Node.js)\nconst stripeKey = process.env.STRIPE_SECRET_KEY;"
          ]
        }
      },
      "implementationSteps": [
        "Set up environment variable management",
        "Implement API proxy endpoints",
        "Update client-side code to use proxy"
      ]
    },
    "consolidation": {
      "groups": [
        {
          "category": "exposed_secrets",
          "findings": ["finding-uuid"],
          "consolidatedRemediation": {
            "steps": ["Rotate all exposed keys", "Implement secure storage"],
            "priority": "critical"
          }
        }
      ]
    }
  },
  "errors": []
}
```

**Status Codes:**

- `200`: Results retrieved successfully
- `404`: Scan not found
- `400`: Invalid query parameters
- `500`: Internal server error

---

### 4. Cancel Scan

Cancel an active scan.

**Endpoint:** `DELETE /scan/enhanced/{scanId}`

**Parameters:**

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `scanId`  | string | Yes      | Unique scan identifier |

**Response:**

```json
{
  "scanId": "uuid-string",
  "status": "cancelled",
  "message": "Scan cancelled successfully"
}
```

**Status Codes:**

- `200`: Scan cancelled successfully
- `404`: Scan not found
- `400`: Scan cannot be cancelled (already completed)
- `500`: Internal server error

---

### 5. Record Feedback

Record user feedback for false positive learning.

**Endpoint:** `POST /scan/enhanced/{scanId}/feedback`

**Parameters:**

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `scanId`  | string | Yes      | Unique scan identifier |

**Request Body:**

```json
{
  "findingId": "finding-uuid",
  "isFalsePositive": true,
  "patternId": "stripe_api_key",
  "value": "sk_test_example",
  "metadata": {
    "userComment": "This is a test key, not production",
    "category": "test_data"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Feedback recorded successfully",
  "findingId": "finding-uuid",
  "isFalsePositive": true,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Status Codes:**

- `200`: Feedback recorded successfully
- `400`: Invalid feedback data
- `404`: Scan or finding not found
- `500`: Internal server error

---

### 6. Get Confidence Statistics

Retrieve confidence scoring and pattern engine statistics.

**Endpoint:** `GET /scan/enhanced/confidence-stats`

**Response:**

```json
{
  "confidenceScoring": {
    "totalFeedback": 150,
    "falsePositiveRate": 0.12,
    "accuracyImprovement": 0.15,
    "patternAccuracy": {
      "stripe_api_key": 0.95,
      "github_token": 0.88,
      "aws_access_key": 0.92
    }
  },
  "patternEngine": {
    "totalPatterns": 45,
    "categoryCounts": {
      "secrets": 25,
      "vulnerabilities": 12,
      "configurations": 8
    },
    "averageConfidence": 0.87
  },
  "resultFormatter": {
    "supportedFormats": ["json", "csv", "sarif"],
    "supportedCategories": [
      "secrets",
      "files",
      "headers",
      "owasp",
      "misconfig"
    ],
    "supportedSeverityLevels": ["critical", "high", "medium", "low"]
  }
}
```

**Status Codes:**

- `200`: Statistics retrieved successfully
- `500`: Internal server error

---

### 7. Get Available Scan Types

Retrieve information about available scan types and their configurations.

**Endpoint:** `GET /scan/enhanced/types`

**Response:**

```json
{
  "scanTypes": [
    {
      "type": "url",
      "name": "URL Scan",
      "description": "Scan web pages for exposed secrets and vulnerabilities",
      "options": {
        "maxDepth": "Maximum depth for crawling (default: 3)",
        "timeout": "Request timeout in milliseconds (default: 30000)",
        "includePatterns": "File patterns to include (array)",
        "excludePatterns": "File patterns to exclude (array)"
      }
    },
    {
      "type": "repository",
      "name": "Repository Scan",
      "description": "Clone and scan Git repositories for security issues",
      "options": {
        "branch": "Specific branch to scan (default: main/master)",
        "maxSize": "Maximum repository size in bytes",
        "includePatterns": "File patterns to include (array)",
        "excludePatterns": "File patterns to exclude (array)"
      }
    }
  ],
  "patternStats": {
    "totalPatterns": 45,
    "categoryCounts": {
      "secrets": 25,
      "vulnerabilities": 12,
      "configurations": 8
    }
  }
}
```

**Status Codes:**

- `200`: Scan types retrieved successfully
- `500`: Internal server error

---

## Output Formats

### JSON Format

Default format with complete structured data including AI analysis and specialized guidance.

### CSV Format

Comma-separated values format suitable for spreadsheet applications:

```csv
ID,Type,Severity,Confidence,Title,Description,File,Line,URL,Value
finding-1,api_key,high,0.95,Exposed API Key,Stripe API key found,config.js,15,https://example.com/config.js,sk_test_****
```

### SARIF Format

Static Analysis Results Interchange Format (SARIF) v2.1.0 compatible output for integration with security tools:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "ThreatPeek Enhanced Scanner",
          "version": "1.0.0"
        }
      },
      "results": [
        {
          "ruleId": "api_key_exposure",
          "level": "error",
          "message": {
            "text": "Exposed API Key: Stripe API key found in JavaScript file"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "https://example.com/js/config.js"
                },
                "region": {
                  "startLine": 15
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Error Handling

### Error Response Format

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details",
    "suggestion": "How to fix the error"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Common Error Codes

| Code                  | Description                             | HTTP Status |
| --------------------- | --------------------------------------- | ----------- |
| `INVALID_URL`         | Malformed or invalid URL                | 400         |
| `INVALID_REPOSITORY`  | Invalid repository URL or access denied | 400         |
| `SCAN_NOT_FOUND`      | Scan ID does not exist                  | 404         |
| `SCAN_TIMEOUT`        | Scan exceeded maximum time limit        | 408         |
| `RATE_LIMIT_EXCEEDED` | Too many requests                       | 429         |
| `INTERNAL_ERROR`      | Unexpected server error                 | 500         |
| `SERVICE_UNAVAILABLE` | Scanner service temporarily unavailable | 503         |

## Rate Limiting

The API implements rate limiting with the following headers in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 60
```

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "remaining": 0,
    "resetTime": "2024-01-01T13:00:00.000Z",
    "retryAfter": 60
  }
}
```

## WebSocket Support (Optional)

For real-time updates, connect to the WebSocket endpoint:

**Endpoint:** `ws://localhost:3001/ws/scan/{scanId}`

**Messages:**

```json
{
  "type": "progress",
  "scanId": "uuid-string",
  "progress": {
    "current": 2,
    "total": 4,
    "percentage": 50
  }
}

{
  "type": "phase_completed",
  "scanId": "uuid-string",
  "phase": "url",
  "results": [...]
}

{
  "type": "scan_completed",
  "scanId": "uuid-string",
  "status": "completed"
}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require("axios");

class ThreatPeekClient {
  constructor(baseURL = "http://localhost:3001/api") {
    this.baseURL = baseURL;
  }

  async startScan(config) {
    const response = await axios.post(`${this.baseURL}/scan/enhanced`, config);
    return response.data;
  }

  async getScanStatus(scanId) {
    const response = await axios.get(
      `${this.baseURL}/scan/enhanced/${scanId}/status`
    );
    return response.data;
  }

  async getScanResults(scanId, options = {}) {
    const response = await axios.get(
      `${this.baseURL}/scan/enhanced/${scanId}/results`,
      {
        params: options,
      }
    );
    return response.data;
  }

  async waitForCompletion(scanId, timeout = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getScanStatus(scanId);

      if (["completed", "partial", "failed"].includes(status.status)) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Scan timeout");
  }
}

// Usage
const client = new ThreatPeekClient();

async function scanWebsite() {
  const scan = await client.startScan({
    url: "https://example.com",
    scanTypes: ["url", "headers"],
    options: { timeout: 30000 },
  });

  console.log("Scan started:", scan.scanId);

  const finalStatus = await client.waitForCompletion(scan.scanId);
  const results = await client.getScanResults(scan.scanId);

  console.log("Scan completed:", results);
}
```

### Python

```python
import requests
import time

class ThreatPeekClient:
    def __init__(self, base_url='http://localhost:3001/api'):
        self.base_url = base_url

    def start_scan(self, config):
        response = requests.post(f'{self.base_url}/scan/enhanced', json=config)
        response.raise_for_status()
        return response.json()

    def get_scan_status(self, scan_id):
        response = requests.get(f'{self.base_url}/scan/enhanced/{scan_id}/status')
        response.raise_for_status()
        return response.json()

    def get_scan_results(self, scan_id, **params):
        response = requests.get(f'{self.base_url}/scan/enhanced/{scan_id}/results', params=params)
        response.raise_for_status()
        return response.json()

    def wait_for_completion(self, scan_id, timeout=300):
        start_time = time.time()

        while time.time() - start_time < timeout:
            status = self.get_scan_status(scan_id)

            if status['status'] in ['completed', 'partial', 'failed']:
                return status

            time.sleep(1)

        raise TimeoutError('Scan timeout')

# Usage
client = ThreatPeekClient()

scan = client.start_scan({
    'url': 'https://example.com',
    'scanTypes': ['url', 'headers'],
    'options': {'timeout': 30000}
})

print(f"Scan started: {scan['scanId']}")

final_status = client.wait_for_completion(scan['scanId'])
results = client.get_scan_results(scan['scanId'])

print(f"Scan completed: {results}")
```

## Best Practices

### 1. Scan Configuration

- Use appropriate timeout values based on target size
- Set confidence thresholds to reduce false positives
- Use include/exclude patterns to focus scanning
- Enable AI analysis for better remediation guidance

### 2. Error Handling

- Always check scan status before retrieving results
- Implement retry logic for network errors
- Handle partial results gracefully
- Monitor rate limits and implement backoff

### 3. Performance

- Use consolidated reports for large result sets
- Implement result pagination for large datasets
- Cache results when appropriate
- Cancel unnecessary scans to free resources

### 4. Security

- Validate and sanitize all input parameters
- Implement proper authentication in production
- Use HTTPS for all API communications
- Regularly rotate API keys and credentials

### 5. Integration

- Use SARIF format for security tool integration
- Implement WebSocket connections for real-time updates
- Store scan results for historical analysis
- Set up automated scanning workflows
