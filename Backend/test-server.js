const express = require('express');
const cors = require('cors');

// Import log monitor
const logMonitor = require('./utils/logMonitor');

const app = express();
const PORT = 3001;

// Enable CORS for localhost:3000
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        logMonitor: logMonitor.getStatus()
    });
});

// Simple scan endpoint
app.post('/api/scan/enhanced', (req, res) => {
    console.log('Received scan request:', req.body);

    const scanId = 'test-scan-' + Date.now();

    res.json({
        scanId,
        status: 'started',
        message: 'Test scan started'
    });
});

// Simple status endpoint
app.get('/api/scan/enhanced/:scanId/status', (req, res) => {
    const { scanId } = req.params;

    res.json({
        scanId,
        status: 'completed',
        progress: {
            current: 1,
            total: 1,
            percentage: 100
        }
    });
});

// Simple results endpoint
app.get('/api/scan/enhanced/:scanId/results', (req, res) => {
    const { scanId } = req.params;

    res.json({
        scanId,
        status: 'completed',
        target: {
            type: 'url',
            value: 'https://example.com'
        },
        results: {
            categories: [
                {
                    category: 'secrets',
                    scanType: 'url',
                    findings: [
                        {
                            id: 'test-finding-1',
                            type: 'api_key',
                            severity: 'high',
                            confidence: 0.9,
                            title: 'Exposed API Key',
                            description: 'Test API key found for development testing',
                            location: {
                                url: 'https://example.com/config.js',
                                file: 'config.js',
                                line: 15
                            },
                            evidence: {
                                pattern: 'sk_test_****',
                                value: 'sk_test_example_key',
                                context: 'const apiKey = "sk_test_example_key";'
                            }
                        }
                    ],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 0,
                        highCount: 1,
                        mediumCount: 0,
                        lowCount: 0
                    }
                },
                {
                    category: 'headers',
                    scanType: 'headers',
                    findings: [
                        {
                            id: 'test-finding-2',
                            type: 'missing_csp',
                            severity: 'medium',
                            confidence: 0.8,
                            title: 'Missing Content Security Policy',
                            description: 'No Content-Security-Policy header found',
                            location: {
                                url: 'https://example.com'
                            },
                            evidence: {
                                pattern: 'missing_header',
                                value: 'Content-Security-Policy'
                            }
                        }
                    ],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 1,
                        lowCount: 0
                    }
                }
            ],
            summary: {
                totalFindings: 2,
                criticalCount: 0,
                highCount: 1,
                mediumCount: 1,
                lowCount: 0
            }
        },
        errors: []
    });
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Test Backend running on port ${PORT}`);
    console.log(`✅ CORS enabled for localhost:3000`);
    console.log(`📋 Test endpoints available`);
    
    // Start log monitoring
    logMonitor.startMonitoring();
});

// Keep the process running
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down test server...');
    logMonitor.stopMonitoring();
    server.close(() => {
        console.log('✅ Test server closed');
        process.exit(0);
    });
});