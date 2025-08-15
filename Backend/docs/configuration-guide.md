# ThreatPeek Enhanced Scanner Configuration Guide

## Overview

This guide covers all configuration options for the ThreatPeek Enhanced Scanner, including environment variables, scan options, pattern definitions, and service configurations.

## Environment Variables

### Core Configuration

Create a `.env` file in the Backend directory with the following variables:

```bash
# Server Configuration
PORT=3001
NODE_ENV=production
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Scan Configuration
DEFAULT_SCAN_TIMEOUT=30000
MAX_CONCURRENT_SCANS=10
SCAN_CLEANUP_INTERVAL=3600000
SCAN_RETENTION_PERIOD=86400000

# Repository Scanning
REPO_CLONE_TIMEOUT=60000
REPO_MAX_SIZE=100000000
REPO_TEMP_DIR=./temp/repos
REPO_CLEANUP_ON_ERROR=true

# Pattern Engine
PATTERN_CONFIDENCE_THRESHOLD=0.5
PATTERN_CACHE_SIZE=1000
PATTERN_CACHE_TTL=3600000

# AI Analysis
AI_ANALYSIS_ENABLED=true
AI_ANALYSIS_TIMEOUT=10000
AI_ANALYSIS_CACHE_SIZE=500
AI_ANALYSIS_CACHE_TTL=1800000

# Resource Management
MEMORY_LIMIT_MB=1024
CPU_LIMIT_PERCENT=80
DISK_SPACE_LIMIT_MB=5120
RESOURCE_CHECK_INTERVAL=30000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/threatpeek.log
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=5

# Security
HELMET_ENABLED=true
CONTENT_SECURITY_POLICY=default-src 'self'
X_FRAME_OPTIONS=DENY
HSTS_MAX_AGE=31536000

# Database (Optional - for persistent storage)
DATABASE_URL=mongodb://localhost:27017/threatpeek
REDIS_URL=redis://localhost:6379
```

### Development vs Production

#### Development (.env.development)

```bash
NODE_ENV=development
LOG_LEVEL=debug
AI_ANALYSIS_ENABLED=false
PATTERN_CACHE_SIZE=100
MAX_CONCURRENT_SCANS=5
```

#### Production (.env.production)

```bash
NODE_ENV=production
LOG_LEVEL=warn
AI_ANALYSIS_ENABLED=true
PATTERN_CACHE_SIZE=1000
MAX_CONCURRENT_SCANS=20
HELMET_ENABLED=true
```

## Scan Configuration Options

### Default Scan Options

```javascript
const defaultScanOptions = {
  // Timing Configuration
  timeout: 30000, // Request timeout in milliseconds
  maxDepth: 3, // Maximum crawling depth for URL scans

  // Quality Control
  confidenceThreshold: 0.5, // Minimum confidence score (0.0-1.0)

  // File Filtering
  includePatterns: [], // Patterns to include (e.g., ["*.js", "*.html"])
  excludePatterns: [
    // Patterns to exclude
    "*.min.js",
    "*.min.css",
    "node_modules/**",
    ".git/**",
    "vendor/**",
    "dist/**",
    "build/**",
  ],

  // Rate Limiting
  rateLimit: {
    requestsPerSecond: 5, // Requests per second to target
    burstLimit: 10, // Maximum burst requests
    backoffStrategy: "exponential", // "linear" or "exponential"
  },

  // Feature Flags
  realTimeUpdates: false, // Enable WebSocket updates
  aiAnalysis: true, // Enable AI-enhanced analysis
  specializedGuidance: true, // Enable specialized security guidance
  findingConsolidation: true, // Enable finding grouping and consolidation

  // Repository-Specific Options
  branch: "main", // Git branch to scan
  maxSize: 100 * 1024 * 1024, // Maximum repository size (100MB)

  // Advanced Options
  userAgent: "ThreatPeek-Scanner/1.0",
  followRedirects: true,
  maxRedirects: 5,
  validateSSL: true,

  // Retry Configuration
  retryAttempts: 3,
  retryDelay: 1000,
  retryBackoff: 2.0,
};
```

### Scan Type Specific Configuration

#### URL Scan Configuration

```javascript
const urlScanConfig = {
  maxDepth: 3, // How deep to crawl
  maxPages: 100, // Maximum pages to scan
  respectRobotsTxt: true, // Follow robots.txt rules
  crawlDelay: 1000, // Delay between requests (ms)
  includeSubdomains: false, // Scan subdomains
  followExternalLinks: false, // Follow external links

  // Content Types to Scan
  contentTypes: [
    "text/html",
    "text/javascript",
    "application/javascript",
    "text/css",
    "application/json",
    "text/xml",
  ],

  // Headers to Send
  headers: {
    "User-Agent": "ThreatPeek-Scanner/1.0",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    Connection: "keep-alive",
  },
};
```

#### Repository Scan Configuration

```javascript
const repositoryScanConfig = {
  branch: "main", // Branch to scan
  maxSize: 100 * 1024 * 1024, // Max repo size (100MB)
  maxFiles: 10000, // Maximum files to scan
  cloneTimeout: 60000, // Clone timeout (ms)

  // File Type Filtering
  includeExtensions: [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".htm",
    ".php",
    ".py",
    ".java",
    ".cs",
    ".cpp",
    ".c",
    ".rb",
    ".go",
    ".rs",
    ".swift",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".env",
    ".config",
    ".ini",
    ".conf",
  ],

  excludeExtensions: [
    ".min.js",
    ".min.css",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
  ],

  // Directory Exclusions
  excludeDirectories: [
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "vendor",
    "dist",
    "build",
    "target",
    ".vscode",
    ".idea",
    "__pycache__",
    "coverage",
    ".nyc_output",
  ],

  // Git Configuration
  gitOptions: {
    depth: 1, // Shallow clone depth
    singleBranch: true, // Clone single branch only
    noCheckout: false, // Skip checkout after clone
    bare: false, // Create bare repository
  },
};
```

#### Security Headers Configuration

```javascript
const headersScanConfig = {
  // Headers to Check
  requiredHeaders: [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "X-XSS-Protection",
  ],

  // CSP Configuration
  cspChecks: {
    allowUnsafeInline: false, // Flag unsafe-inline
    allowUnsafeEval: false, // Flag unsafe-eval
    allowDataUris: false, // Flag data: URIs
    requireNonce: true, // Require nonce for scripts
    checkSources: true, // Validate source domains
  },

  // HSTS Configuration
  hstsChecks: {
    minMaxAge: 31536000, // Minimum max-age (1 year)
    requireIncludeSubDomains: true, // Require includeSubDomains
    requirePreload: false, // Require preload directive
  },

  // CORS Configuration
  corsChecks: {
    allowWildcardOrigin: false, // Flag wildcard origins
    allowCredentialsWithWildcard: false, // Flag credentials with wildcard
    checkPreflightHeaders: true, // Check preflight headers
  },
};
```

#### OWASP Scan Configuration

```javascript
const owaspScanConfig = {
  // OWASP Categories to Check
  categories: [
    "A01", // Broken Access Control
    "A02", // Cryptographic Failures
    "A03", // Injection
    "A04", // Insecure Design
    "A05", // Security Misconfiguration
    "A06", // Vulnerable Components
    "A07", // Authentication Failures
    "A08", // Software Integrity Failures
    "A09", // Logging Failures
    "A10", // Server-Side Request Forgery
  ],

  // Analysis Depth
  depth: "standard", // "basic", "standard", "comprehensive"

  // Specific Checks
  checks: {
    sqlInjection: true,
    xssVulnerabilities: true,
    csrfProtection: true,
    authenticationFlaws: true,
    sessionManagement: true,
    accessControl: true,
    cryptographicIssues: true,
    inputValidation: true,
    errorHandling: true,
    loggingAndMonitoring: true,
  },
};
```

## Pattern Engine Configuration

### Pattern Categories

```javascript
const patternCategories = {
  secrets: {
    enabled: true,
    confidenceThreshold: 0.7,
    patterns: [
      "api_keys",
      "database_credentials",
      "oauth_tokens",
      "private_keys",
      "certificates",
    ],
  },

  vulnerabilities: {
    enabled: true,
    confidenceThreshold: 0.6,
    patterns: [
      "sql_injection",
      "xss_patterns",
      "command_injection",
      "path_traversal",
      "xxe_patterns",
    ],
  },

  configurations: {
    enabled: true,
    confidenceThreshold: 0.5,
    patterns: [
      "debug_modes",
      "test_credentials",
      "development_configs",
      "exposed_endpoints",
      "weak_settings",
    ],
  },
};
```

### Custom Pattern Definition

```javascript
const customPattern = {
  id: "custom_api_key",
  name: "Custom API Key",
  category: "secrets",
  severity: "high",

  // Regular Expression
  regex: /custom_key_[a-zA-Z0-9]{32}/gi,

  // Validation Function (Optional)
  validator: (match) => {
    // Custom validation logic
    return match.length === 43 && match.startsWith("custom_key_");
  },

  // False Positive Filters
  falsePositiveFilters: [
    /custom_key_example/gi,
    /custom_key_test/gi,
    /custom_key_placeholder/gi,
  ],

  // Context Requirements
  contextRequirements: {
    beforeText: ["key", "token", "secret"],
    afterText: ["=", ":", "->"],
    fileTypes: [".js", ".ts", ".json", ".env"],
  },

  // Remediation Guidance
  remediation: {
    summary: "Remove custom API key from code",
    steps: [
      "Move key to environment variables",
      "Rotate the exposed key",
      "Implement secure key management",
    ],
    references: ["https://example.com/secure-key-management"],
  },
};
```

## Service Configuration

### AI Analysis Service

```javascript
const aiAnalysisConfig = {
  enabled: true,
  timeout: 10000,

  // Cache Configuration
  cache: {
    enabled: true,
    size: 500,
    ttl: 1800000, // 30 minutes
  },

  // Analysis Options
  options: {
    generateExplanations: true,
    calculateRiskScores: true,
    provideMitigationSteps: true,
    includeCodeExamples: true,
    contextualAnalysis: true,
  },

  // Provider Configuration (if using external AI service)
  provider: {
    type: "openai", // "openai", "anthropic", "local"
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4",
    maxTokens: 2000,
    temperature: 0.3,
  },
};
```

### Resource Manager Configuration

```javascript
const resourceManagerConfig = {
  enabled: true,

  // Memory Management
  memory: {
    limitMB: 1024, // Memory limit in MB
    warningThreshold: 0.8, // Warning at 80%
    criticalThreshold: 0.95, // Critical at 95%
    checkInterval: 30000, // Check every 30 seconds
  },

  // CPU Management
  cpu: {
    limitPercent: 80, // CPU limit percentage
    warningThreshold: 0.7, // Warning at 70%
    criticalThreshold: 0.9, // Critical at 90%
    checkInterval: 10000, // Check every 10 seconds
  },

  // Disk Space Management
  disk: {
    limitMB: 5120, // Disk limit in MB (5GB)
    warningThreshold: 0.8, // Warning at 80%
    criticalThreshold: 0.95, // Critical at 95%
    checkInterval: 60000, // Check every minute
    tempDirectory: "./temp", // Temporary files directory
  },

  // Cleanup Configuration
  cleanup: {
    enabled: true,
    interval: 3600000, // Cleanup every hour
    maxAge: 86400000, // Delete files older than 24 hours
    maxSize: 1073741824, // Delete if temp dir > 1GB
  },
};
```

### Error Recovery Service

```javascript
const errorRecoveryConfig = {
  enabled: true,

  // Retry Configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // Initial delay in ms
    backoffMultiplier: 2.0, // Exponential backoff multiplier
    maxDelay: 30000, // Maximum delay between retries
    jitter: true, // Add random jitter to delays
  },

  // Recoverable Errors
  recoverableErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "SOCKET_TIMEOUT",
    "DNS_LOOKUP_FAILED",
  ],

  // Circuit Breaker
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5, // Open after 5 failures
    resetTimeout: 60000, // Reset after 1 minute
    monitoringPeriod: 300000, // Monitor for 5 minutes
  },

  // Fallback Strategies
  fallbacks: {
    networkError: "partial_results", // Continue with partial results
    serviceUnavailable: "cache", // Use cached results if available
    timeout: "extend_deadline", // Extend deadline for critical scans
  },
};
```

## Database Configuration (Optional)

### MongoDB Configuration

```javascript
const mongoConfig = {
  url: process.env.DATABASE_URL || "mongodb://localhost:27017/threatpeek",
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferMaxEntries: 0,
    bufferCommands: false,
  },

  // Collections
  collections: {
    scans: "scans",
    results: "scan_results",
    patterns: "patterns",
    feedback: "user_feedback",
    statistics: "statistics",
  },

  // Indexes
  indexes: [
    { collection: "scans", index: { scanId: 1 }, unique: true },
    {
      collection: "scans",
      index: { createdAt: 1 },
      expireAfterSeconds: 2592000,
    }, // 30 days
    { collection: "results", index: { scanId: 1 } },
    { collection: "feedback", index: { patternId: 1, isFalsePositive: 1 } },
  ],
};
```

### Redis Configuration

```javascript
const redisConfig = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  options: {
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  },

  // Key Prefixes
  keyPrefixes: {
    scans: "scan:",
    results: "results:",
    cache: "cache:",
    locks: "lock:",
    stats: "stats:",
  },

  // TTL Settings (in seconds)
  ttl: {
    scanStatus: 3600, // 1 hour
    scanResults: 86400, // 24 hours
    patternCache: 3600, // 1 hour
    aiAnalysisCache: 1800, // 30 minutes
    statisticsCache: 300, // 5 minutes
  },
};
```

## Security Configuration

### Helmet Configuration

```javascript
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  frameguard: {
    action: "deny",
  },

  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
};
```

### CORS Configuration

```javascript
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "https://threatpeek.example.com",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },

  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-API-Key",
  ],

  exposedHeaders: [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],

  maxAge: 86400, // 24 hours
};
```

## Logging Configuration

### Winston Logger Configuration

```javascript
const loggingConfig = {
  level: process.env.LOG_LEVEL || "info",

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  transports: [
    // Console Transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File Transport
    new winston.transports.File({
      filename: "./logs/error.log",
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),

    // Combined Log File
    new winston.transports.File({
      filename: "./logs/combined.log",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],

  // Exception Handling
  exceptionHandlers: [
    new winston.transports.File({
      filename: "./logs/exceptions.log",
    }),
  ],

  // Rejection Handling
  rejectionHandlers: [
    new winston.transports.File({
      filename: "./logs/rejections.log",
    }),
  ],
};
```

## Performance Tuning

### Node.js Performance Options

```bash
# Memory Management
NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=128"

# Garbage Collection
NODE_OPTIONS="$NODE_OPTIONS --expose-gc --optimize-for-size"

# V8 Options
NODE_OPTIONS="$NODE_OPTIONS --max-http-header-size=16384"

# Worker Threads
UV_THREADPOOL_SIZE=16
```

### Cluster Configuration

```javascript
const clusterConfig = {
  enabled: process.env.NODE_ENV === "production",
  workers: process.env.CLUSTER_WORKERS || require("os").cpus().length,

  // Worker Configuration
  workerOptions: {
    execArgv: ["--max-old-space-size=1024", "--optimize-for-size"],
  },

  // Restart Configuration
  restart: {
    enabled: true,
    maxRestarts: 5,
    restartDelay: 1000,
    killTimeout: 5000,
  },

  // Health Checks
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    maxFailures: 3,
  },
};
```

## Deployment Configuration

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S threatpeek -u 1001

# Set permissions
RUN chown -R threatpeek:nodejs /app
USER threatpeek

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["npm", "start"]
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: "3.8"

services:
  threatpeek-backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mongodb://mongo:27017/threatpeek
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./logs:/app/logs
      - ./temp:/app/temp
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:5
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

### Kubernetes Configuration

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: threatpeek-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: threatpeek-backend
  template:
    metadata:
      labels:
        app: threatpeek-backend
    spec:
      containers:
        - name: threatpeek-backend
          image: threatpeek/backend:latest
          ports:
            - containerPort: 3001
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: threatpeek-secrets
                  key: database-url
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
```

## Configuration Validation

### Environment Validation Schema

```javascript
const configSchema = {
  PORT: {
    type: "number",
    default: 3001,
    min: 1024,
    max: 65535,
  },

  NODE_ENV: {
    type: "string",
    enum: ["development", "production", "test"],
    default: "development",
  },

  DEFAULT_SCAN_TIMEOUT: {
    type: "number",
    default: 30000,
    min: 5000,
    max: 300000,
  },

  MAX_CONCURRENT_SCANS: {
    type: "number",
    default: 10,
    min: 1,
    max: 100,
  },

  PATTERN_CONFIDENCE_THRESHOLD: {
    type: "number",
    default: 0.5,
    min: 0.0,
    max: 1.0,
  },
};

// Validation Function
function validateConfig() {
  const errors = [];

  for (const [key, schema] of Object.entries(configSchema)) {
    const value = process.env[key];

    if (!value && schema.required) {
      errors.push(`Missing required environment variable: ${key}`);
      continue;
    }

    const finalValue = value || schema.default;

    if (schema.type === "number") {
      const numValue = Number(finalValue);
      if (isNaN(numValue)) {
        errors.push(`Invalid number for ${key}: ${finalValue}`);
      } else if (schema.min && numValue < schema.min) {
        errors.push(`${key} must be >= ${schema.min}, got ${numValue}`);
      } else if (schema.max && numValue > schema.max) {
        errors.push(`${key} must be <= ${schema.max}, got ${numValue}`);
      }
    }

    if (schema.enum && !schema.enum.includes(finalValue)) {
      errors.push(
        `${key} must be one of: ${schema.enum.join(", ")}, got ${finalValue}`
      );
    }
  }

  if (errors.length > 0) {
    console.error("Configuration validation errors:");
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
}
```

This comprehensive configuration guide covers all aspects of configuring the ThreatPeek Enhanced Scanner for different environments and use cases. Adjust the values according to your specific requirements and infrastructure constraints.
