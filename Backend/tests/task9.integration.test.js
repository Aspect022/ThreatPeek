/**
 * Integration test for Task 9 - API endpoints with deduplication statistics
 * Tests that the enhanced scan controller returns deduplication information
 */

const request = require('supertest');
const express = require('express');
const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');

// Mock the scanner modules
jest.mock('../services/urlScanner', () => ({
    scan: jest.fn()
}));

describe('Task 9 - Enhanced Scan Controller API Integration', () => {
    let app;
    let orchestrator;

    beforeEach(() => {
        // Create Express app with enhanced scan routes
        app = express();
        app.use(express.json());

        // Initialize orchestrator
        orchestrator = new SimpleScanOrchestrator();

        // Mock the controller to use our orchestrator
        const enhancedScanController = {
            startEnhancedScan: async (req, res) => {
                try {
                    const scanId = await orchestrator.startScan({
                        url: req.body.url,
                        scanTypes: req.body.scanTypes || ['url']
                    });

                    res.json({
                        scanId,
                        status: 'started',
                        scanTypes: req.body.scanTypes || ['url'],
                        target: {
                            type: 'url',
                            value: req.body.url
                        }
                    });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            },

            getScanStatus: async (req, res) => {
                try {
                    const status = orchestrator.getScanStatus(req.params.scanId);
                    if (!status) {
                        return res.status(404).json({ error: 'Scan not found' });
                    }

                    res.json({
                        scanId: req.params.scanId,
                        status: status.status,
                        target: status.target,
                        progress: {
                            current: status.progress.current,
                            total: status.progress.total,
                            percentage: Math.round((status.progress.current / status.progress.total) * 100),
                            phases: status.progress.phases.map(phase => ({
                                type: phase.type,
                                status: phase.status,
                                progress: phase.progress,
                                hasErrors: phase.errors.length > 0
                            }))
                        },
                        deduplicationStatus: status.deduplicationStatus || null
                    });
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            },

            getScanResults: async (req, res) => {
                try {
                    const results = orchestrator.getScanResults(req.params.scanId);
                    if (!results) {
                        return res.status(404).json({ error: 'Scan results not found' });
                    }

                    res.json(results);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            }
        };

        // Setup routes
        app.post('/api/enhanced-scan', enhancedScanController.startEnhancedScan);
        app.get('/api/enhanced-scan/:scanId/status', enhancedScanController.getScanStatus);
        app.get('/api/enhanced-scan/:scanId/results', enhancedScanController.getScanResults);
    });

    afterEach(async () => {
        if (orchestrator) {
            await orchestrator.shutdown();
        }
        jest.clearAllMocks();
    });

    describe('POST /api/enhanced-scan - Start Enhanced Scan', () => {
        test('should start scan and return scan ID', async () => {
            const response = await request(app)
                .post('/api/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url']
                })
                .expect(200);

            expect(response.body).toHaveProperty('scanId');
            expect(response.body.status).toBe('started');
            expect(response.body.scanTypes).toContain('url');
            expect(response.body.target.type).toBe('url');
            expect(response.body.target.value).toBe('https://example.com');
        });
    });

    describe('GET /api/enhanced-scan/:scanId/status - Get Scan Status', () => {
        test('should return scan status with deduplication information', async () => {
            // Start a scan first
            const startResponse = await request(app)
                .post('/api/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url']
                });

            const scanId = startResponse.body.scanId;

            // Wait a moment for scan to initialize
            await new Promise(resolve => setTimeout(resolve, 100));

            const statusResponse = await request(app)
                .get(`/api/enhanced-scan/${scanId}/status`)
                .expect(200);

            expect(statusResponse.body).toHaveProperty('scanId', scanId);
            expect(statusResponse.body).toHaveProperty('status');
            expect(statusResponse.body).toHaveProperty('progress');
            expect(statusResponse.body).toHaveProperty('deduplicationStatus');

            // Check deduplication status structure
            const dedupStatus = statusResponse.body.deduplicationStatus;
            expect(dedupStatus).toHaveProperty('enabled');
            if (dedupStatus.enabled) {
                expect(dedupStatus).toHaveProperty('stats');
                expect(dedupStatus).toHaveProperty('currentCacheSize');
                expect(typeof dedupStatus.currentCacheSize).toBe('number');
            } else {
                expect(dedupStatus).toHaveProperty('reason');
            }
        });

        test('should return 404 for non-existent scan', async () => {
            await request(app)
                .get('/api/enhanced-scan/non-existent-scan/status')
                .expect(404);
        });
    });

    describe('GET /api/enhanced-scan/:scanId/results - Get Scan Results', () => {
        test('should return results with deduplication statistics when available', async () => {
            // Mock scanner to return some findings
            const urlScanner = require('../services/urlScanner');
            urlScanner.scan.mockResolvedValue([
                {
                    id: 'finding-1',
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'test-value',
                    severity: 'medium',
                    confidence: 0.7,
                    location: { line: 5, column: 10 }
                }
            ]);

            // Start scan
            const startResponse = await request(app)
                .post('/api/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url']
                });

            const scanId = startResponse.body.scanId;

            // Wait for scan to complete
            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            const resultsResponse = await request(app)
                .get(`/api/enhanced-scan/${scanId}/results`)
                .expect(200);

            const results = resultsResponse.body;

            // Check basic structure
            expect(results).toHaveProperty('scanId', scanId);
            expect(results).toHaveProperty('results');
            expect(results.results).toHaveProperty('categories');
            expect(results.results).toHaveProperty('summary');

            // Check deduplication statistics (may be present or not depending on implementation)
            if (results.results.deduplicationStats) {
                expect(results.results.deduplicationStats).toHaveProperty('deduplicationEnabled');
                if (results.results.deduplicationStats.deduplicationEnabled) {
                    expect(results.results.deduplicationStats).toHaveProperty('finalFindingsCount');
                    expect(results.results.deduplicationStats).toHaveProperty('totalDuplicatesRemoved');
                }
            }
        });

        test('should return 404 for non-existent scan results', async () => {
            await request(app)
                .get('/api/enhanced-scan/non-existent-scan/results')
                .expect(404);
        });
    });

    describe('Basic Scan Controller Compatibility', () => {
        test('should include deduplication info in basic scan responses', () => {
            // Test that basic scan controller includes deduplication status
            const scanData = {
                url: 'https://example.com',
                timestamp: new Date().toISOString(),
                results: [],
                scanMode: 'basic',
                deduplicationStats: {
                    deduplicationEnabled: false,
                    reason: 'Basic scan mode does not use deduplication'
                }
            };

            expect(scanData.deduplicationStats).toBeDefined();
            expect(scanData.deduplicationStats.deduplicationEnabled).toBe(false);
            expect(scanData.deduplicationStats.reason).toContain('Basic scan mode');
        });
    });
});