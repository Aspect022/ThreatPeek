/**
 * Integration tests for enhanced scan controller with deduplication
 * Tests API endpoints to ensure deduplication statistics are properly returned
 */

const request = require('supertest');
const express = require('express');
const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');

// Mock the scanner modules
jest.mock('../services/urlScanner', () => ({
    scan: jest.fn()
}));

jest.mock('../services/repositoryScanner', () => ({
    scan: jest.fn()
}));

describe('Enhanced Scan Controller - Deduplication API Integration', () => {
    let app;
    let orchestrator;

    beforeEach(() => {
        // Create Express app with enhanced scan routes
        app = express();
        app.use(express.json());

        // Initialize orchestrator
        orchestrator = new SimpleScanOrchestrator();

        // Mock the global orchestrator in the controller
        jest.doMock('../services/scanOrchestrator', () => ({
            ScanOrchestrator: jest.fn().mockImplementation(() => orchestrator)
        }));

        // Import and setup routes after mocking
        const enhancedScanRoutes = require('../routes/enhancedScan');
        app.use('/api/enhanced-scan', enhancedScanRoutes);
    });

    afterEach(async () => {
        if (orchestrator) {
            await orchestrator.shutdown();
        }
        jest.clearAllMocks();
    });

    describe('POST /api/enhanced-scan - Start Enhanced Scan', () => {
        test('should start scan and return scan ID with deduplication enabled', async () => {
            const response = await request(app)
                .post('/api/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url'],
                    options: {
                        enableDeduplication: true
                    }
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
        test('should return results with deduplication statistics', async () => {
            // Mock scanner to return duplicate findings
            const urlScanner = require('../services/urlScanner');
            urlScanner.scan.mockResolvedValue([
                {
                    id: 'finding-1',
                    pattern: { id: 'api-key' },
                    file: 'config.js',
                    value: 'sk-test123',
                    severity: 'high',
                    confidence: 0.8,
                    location: { line: 10, column: 5 }
                },
                {
                    id: 'finding-2',
                    pattern: { id: 'api-key' },
                    file: 'config.js',
                    value: 'sk-test123',
                    severity: 'critical', // Higher severity
                    confidence: 0.9, // Higher confidence
                    location: { line: 20, column: 8 }
                },
                {
                    id: 'finding-3',
                    pattern: { id: 'password' },
                    file: 'app.js',
                    value: 'password123',
                    severity: 'medium',
                    confidence: 0.7,
                    location: { line: 5, column: 12 }
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

            // Check deduplication statistics
            expect(results.results).toHaveProperty('deduplicationStats');
            const dedupStats = results.results.deduplicationStats;

            expect(dedupStats).toHaveProperty('deduplicationEnabled', true);
            expect(dedupStats).toHaveProperty('finalFindingsCount');
            expect(dedupStats).toHaveProperty('totalDuplicatesRemoved');
            expect(dedupStats).toHaveProperty('deduplicationRate');

            // Verify deduplication worked
            expect(dedupStats.totalDuplicatesRemoved).toBeGreaterThan(0);
            expect(dedupStats.finalFindingsCount).toBeLessThan(3); // Should be less than original 3

            // Check that findings have occurrence counts
            const findings = results.results.categories[0]?.findings || [];
            const duplicatedFinding = findings.find(f => f.occurrenceCount > 1);

            if (duplicatedFinding) {
                expect(duplicatedFinding).toHaveProperty('occurrenceCount');
                expect(duplicatedFinding.occurrenceCount).toBeGreaterThan(1);
                expect(duplicatedFinding).toHaveProperty('locations');
                expect(duplicatedFinding.locations.length).toBeGreaterThan(1);
                expect(duplicatedFinding.severity).toBe('critical'); // Should preserve highest severity
                expect(duplicatedFinding.confidence).toBe(0.9); // Should preserve highest confidence
            }
        });

        test('should return consolidated report with deduplication info', async () => {
            // Mock scanner
            const urlScanner = require('../services/urlScanner');
            urlScanner.scan.mockResolvedValue([
                {
                    id: 'finding-1',
                    pattern: { id: 'secret' },
                    file: 'test.js',
                    value: 'secret123',
                    severity: 'high',
                    confidence: 0.8
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

            // Wait for completion
            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            const resultsResponse = await request(app)
                .get(`/api/enhanced-scan/${scanId}/results?consolidated=true`)
                .expect(200);

            const report = resultsResponse.body;

            expect(report).toHaveProperty('overview');
            expect(report.overview).toHaveProperty('deduplicationSummary');

            if (report.overview.deduplicationSummary) {
                expect(report.overview.deduplicationSummary).toHaveProperty('enabled');
                expect(report.overview.deduplicationSummary).toHaveProperty('duplicatesRemoved');
                expect(report.overview.deduplicationSummary).toHaveProperty('deduplicationRate');
                expect(report.overview.deduplicationSummary).toHaveProperty('uniqueFindings');
            }

            expect(report).toHaveProperty('metadata');
            if (report.deduplicationStats) {
                expect(report.metadata).toHaveProperty('deduplicationEnabled');
            }
        });

        test('should handle different output formats with deduplication stats', async () => {
            // Mock scanner
            const urlScanner = require('../services/urlScanner');
            urlScanner.scan.mockResolvedValue([
                {
                    id: 'finding-1',
                    pattern: { id: 'token' },
                    file: 'auth.js',
                    value: 'token-abc123',
                    severity: 'medium',
                    confidence: 0.6
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

            // Wait for completion
            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            // Test JSON format (default)
            const jsonResponse = await request(app)
                .get(`/api/enhanced-scan/${scanId}/results?format=json`)
                .expect(200);

            expect(jsonResponse.body.results).toHaveProperty('deduplicationStats');
        });

        test('should return 404 for non-existent scan results', async () => {
            await request(app)
                .get('/api/enhanced-scan/non-existent-scan/results')
                .expect(404);
        });
    });

    describe('Error Handling with Deduplication', () => {
        test('should handle deduplication errors gracefully', async () => {
            // Mock scanner to return findings that might cause deduplication errors
            const urlScanner = require('../services/urlScanner');
            urlScanner.scan.mockResolvedValue([
                {
                    id: 'finding-1',
                    pattern: { id: 'malformed-pattern' },
                    file: null, // This might cause deduplication issues
                    value: 'test-value',
                    severity: 'low'
                }
            ]);

            const startResponse = await request(app)
                .post('/api/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url']
                });

            const scanId = startResponse.body.scanId;

            // Wait for completion
            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            const resultsResponse = await request(app)
                .get(`/api/enhanced-scan/${scanId}/results`)
                .expect(200);

            // Should still return results even if deduplication had issues
            expect(resultsResponse.body).toHaveProperty('results');
            expect(resultsResponse.body.results).toHaveProperty('deduplicationStats');

            // Check if error information is included
            const dedupStats = resultsResponse.body.results.deduplicationStats;
            if (!dedupStats.deduplicationEnabled) {
                expect(dedupStats).toHaveProperty('error');
            }
        });
    });

    describe('Filtering with Deduplication Statistics', () => {
        test('should preserve deduplication info when filtering results', async () => {
            // Mock scanner with multiple severity levels
            const urlScanner = require('../services/urlScanner');
            urlScanner.scan.mockResolvedValue([
                {
                    id: 'finding-1',
                    pattern: { id: 'critical-issue' },
                    file: 'app.js',
                    value: 'critical-data',
                    severity: 'critical',
                    confidence: 0.9
                },
                {
                    id: 'finding-2',
                    pattern: { id: 'medium-issue' },
                    file: 'utils.js',
                    value: 'medium-data',
                    severity: 'medium',
                    confidence: 0.6
                }
            ]);

            const startResponse = await request(app)
                .post('/api/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url']
                });

            const scanId = startResponse.body.scanId;

            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            // Filter for only critical findings
            const filteredResponse = await request(app)
                .get(`/api/enhanced-scan/${scanId}/results?severity=critical`)
                .expect(200);

            const results = filteredResponse.body;

            // Should still have deduplication stats
            expect(results.results).toHaveProperty('deduplicationStats');

            // Should have filtering metadata
            expect(results.results).toHaveProperty('metadata');
            expect(results.results.metadata).toHaveProperty('filters');
            expect(results.results.metadata.filters.severity).toBe('critical');

            // Should only have critical findings
            expect(results.results.summary.criticalCount).toBeGreaterThan(0);
            expect(results.results.summary.mediumCount).toBe(0);
        });
    });
});