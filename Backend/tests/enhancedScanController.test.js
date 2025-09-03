/**
 * Integration Tests for Enhanced Scan Controller
 * Tests API endpoints, request handling, and response formatting
 */

const request = require('supertest');
const express = require('express');
const enhancedScanController = require('../controllers/enhancedScanController');

// Mock the ScanOrchestrator
jest.mock('../services/scanOrchestrator', () => {
    const mockOrchestrator = {
        startScan: jest.fn(),
        getScanStatus: jest.fn(),
        getScanResults: jest.fn(),
        cancelScan: jest.fn(),
        on: jest.fn(),
        cleanup: jest.fn()
    };

    return {
        ScanOrchestrator: jest.fn(() => mockOrchestrator)
    };
});

// Mock the pattern engine
jest.mock('../utils/enhancedPatternEngine', () => ({
    EnhancedPatternEngine: jest.fn(() => ({
        registerPatterns: jest.fn(),
        getStats: jest.fn(() => ({
            totalPatterns: 25,
            categoryCounts: {
                secrets: 15,
                vulnerabilities: 5,
                configurations: 5
            }
        }))
    }))
}));

const { ScanOrchestrator } = require('../services/scanOrchestrator');

describe('Enhanced Scan Controller Integration Tests', () => {
    let app;
    let mockOrchestrator;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Get the mock orchestrator instance
        mockOrchestrator = new ScanOrchestrator();

        // Set up routes
        app.post('/enhanced-scan', enhancedScanController.startEnhancedScan);
        app.get('/enhanced-scan/types', enhancedScanController.getScanTypes);
        app.get('/enhanced-scan/:scanId/status', enhancedScanController.getScanStatus);
        app.get('/enhanced-scan/:scanId/results', enhancedScanController.getScanResults);
        app.delete('/enhanced-scan/:scanId', enhancedScanController.cancelScan);

        jest.clearAllMocks();
    });

    describe('POST /enhanced-scan - Start Enhanced Scan', () => {
        test('should start URL scan successfully', async () => {
            const mockScanId = 'test-scan-123';
            mockOrchestrator.startScan.mockResolvedValue(mockScanId);

            const response = await request(app)
                .post('/enhanced-scan')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['url', 'headers'],
                    options: {
                        maxDepth: 3,
                        confidenceThreshold: 0.7
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                scanId: mockScanId,
                status: 'started',
                scanTypes: ['url', 'headers'],
                target: {
                    type: 'url',
                    value: 'https://example.com'
                },
                message: 'Enhanced scan started successfully'
            });

            expect(mockOrchestrator.startScan).toHaveBeenCalledWith({
                url: 'https://example.com',
                repositoryUrl: undefined,
                scanTypes: ['url', 'headers'],
                options: expect.objectContaining({
                    maxDepth: 3,
                    confidenceThreshold: 0.7,
                    timeout: 30000,
                    rateLimit: expect.any(Object)
                })
            });
        });

        test('should start repository scan successfully', async () => {
            const mockScanId = 'repo-scan-456';
            mockOrchestrator.startScan.mockResolvedValue(mockScanId);

            const response = await request(app)
                .post('/enhanced-scan')
                .send({
                    repositoryUrl: 'https://github.com/user/repo',
                    scanTypes: ['repository'],
                    options: {}
                });

            expect(response.status).toBe(200);
            expect(response.body.target.type).toBe('repository');
            expect(response.body.target.value).toBe('https://github.com/user/repo');
        });

        test('should return 400 for missing URL and repository URL', async () => {
            const response = await request(app)
                .post('/enhanced-scan')
                .send({
                    scanTypes: ['url']
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Either url or repositoryUrl must be provided');
        });

        test('should handle orchestrator errors', async () => {
            mockOrchestrator.startScan.mockRejectedValue(new Error('Invalid URL format'));

            const response = await request(app)
                .post('/enhanced-scan')
                .send({
                    url: 'invalid-url',
                    scanTypes: ['url']
                });

            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Failed to start enhanced scan');
        });

        test('should apply default options when not provided', async () => {
            const mockScanId = 'default-scan-789';
            mockOrchestrator.startScan.mockResolvedValue(mockScanId);

            await request(app)
                .post('/enhanced-scan')
                .send({
                    url: 'https://example.com'
                });

            expect(mockOrchestrator.startScan).toHaveBeenCalledWith({
                url: 'https://example.com',
                repositoryUrl: undefined,
                scanTypes: ['url'],
                options: expect.objectContaining({
                    maxDepth: 3,
                    timeout: 30000,
                    confidenceThreshold: 0.5,
                    rateLimit: {
                        requestsPerSecond: 5,
                        burstLimit: 10,
                        backoffStrategy: 'exponential'
                    }
                })
            });
        });
    });

    describe('GET /enhanced-scan/:scanId/status - Get Scan Status', () => {
        test('should return scan status successfully', async () => {
            const mockStatus = {
                status: 'running',
                target: { type: 'url', value: 'https://example.com' },
                progress: {
                    current: 2,
                    total: 3,
                    phases: [
                        { type: 'url', status: 'completed', progress: 100, startTime: new Date(), endTime: new Date(), errors: [] },
                        { type: 'files', status: 'running', progress: 50, startTime: new Date(), endTime: null, errors: [] },
                        { type: 'headers', status: 'pending', progress: 0, startTime: null, endTime: null, errors: [] }
                    ]
                },
                startTime: new Date(),
                endTime: null,
                duration: null,
                results: {
                    summary: {
                        totalFindings: 5,
                        criticalCount: 1,
                        highCount: 2,
                        mediumCount: 2,
                        lowCount: 0
                    }
                }
            };

            mockOrchestrator.getScanStatus.mockReturnValue(mockStatus);

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/status');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                scanId: 'test-scan-123',
                status: 'running',
                target: mockStatus.target,
                progress: {
                    current: 2,
                    total: 3,
                    percentage: 67,
                    phases: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'url',
                            status: 'completed',
                            progress: 100,
                            hasErrors: false
                        })
                    ])
                },
                startTime: mockStatus.startTime,
                endTime: null,
                duration: null,
                summary: mockStatus.results.summary
            });
        });

        test('should return 404 for non-existent scan', async () => {
            mockOrchestrator.getScanStatus.mockReturnValue(null);

            const response = await request(app)
                .get('/enhanced-scan/non-existent-scan/status');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Scan not found');
        });

        test('should return 400 for missing scan ID', async () => {
            const response = await request(app)
                .get('/enhanced-scan//status');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Scan ID is required');
        });
    });

    describe('GET /enhanced-scan/:scanId/results - Get Scan Results', () => {
        test('should return complete scan results', async () => {
            const mockResults = {
                scanId: 'test-scan-123',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                startTime: new Date(),
                endTime: new Date(),
                duration: 5000,
                progress: { current: 2, total: 2 },
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            scanType: 'url',
                            findings: [
                                {
                                    type: 'API Key',
                                    severity: 'high',
                                    confidence: 0.9,
                                    value: 'sk-test123',
                                    file: 'https://example.com',
                                    context: { before: 'const key = ', after: ';' }
                                }
                            ]
                        }
                    ]
                },
                errors: []
            };

            mockOrchestrator.getScanResults.mockReturnValue(mockResults);

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/results');

            expect(response.status).toBe(200);
            expect(response.body.scanId).toBe('test-scan-123');
            expect(response.body.results.categories).toHaveLength(1);
            expect(response.body.results.summary).toBeDefined();
        });

        test('should filter results by category', async () => {
            const mockResults = {
                scanId: 'test-scan-123',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [{ type: 'API Key', severity: 'high' }]
                        },
                        {
                            category: 'headers',
                            findings: [{ type: 'Missing Header', severity: 'medium' }]
                        }
                    ]
                }
            };

            mockOrchestrator.getScanResults.mockReturnValue(mockResults);

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/results?category=secrets');

            expect(response.status).toBe(200);
            expect(response.body.results.categories).toHaveLength(1);
            expect(response.body.results.categories[0].category).toBe('secrets');
        });

        test('should filter results by severity', async () => {
            const mockResults = {
                scanId: 'test-scan-123',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [
                                { type: 'Critical Issue', severity: 'critical' },
                                { type: 'Medium Issue', severity: 'medium' }
                            ]
                        }
                    ]
                }
            };

            mockOrchestrator.getScanResults.mockReturnValue(mockResults);

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/results?severity=critical');

            expect(response.status).toBe(200);
            expect(response.body.results.categories[0].findings).toHaveLength(1);
            expect(response.body.results.categories[0].findings[0].severity).toBe('critical');
        });

        test('should filter results by confidence threshold', async () => {
            const mockResults = {
                scanId: 'test-scan-123',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [
                                { type: 'High Confidence', confidence: 0.9, severity: 'high' },
                                { type: 'Low Confidence', confidence: 0.3, severity: 'high' }
                            ]
                        }
                    ]
                }
            };

            mockOrchestrator.getScanResults.mockReturnValue(mockResults);

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/results?confidenceThreshold=0.5');

            expect(response.status).toBe(200);
            expect(response.body.results.categories[0].findings).toHaveLength(1);
            expect(response.body.results.categories[0].findings[0].confidence).toBe(0.9);
        });

        test('should exclude context when requested', async () => {
            const mockResults = {
                scanId: 'test-scan-123',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [
                                {
                                    type: 'API Key',
                                    severity: 'high',
                                    context: { before: 'secret', after: 'value' }
                                }
                            ]
                        }
                    ]
                }
            };

            mockOrchestrator.getScanResults.mockReturnValue(mockResults);

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/results?includeContext=false');

            expect(response.status).toBe(200);
            expect(response.body.results.categories[0].findings[0].context).toBeUndefined();
        });
    });

    describe('DELETE /enhanced-scan/:scanId - Cancel Scan', () => {
        test('should cancel scan successfully', async () => {
            mockOrchestrator.cancelScan.mockReturnValue(true);

            const response = await request(app)
                .delete('/enhanced-scan/test-scan-123');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                scanId: 'test-scan-123',
                status: 'cancelled',
                message: 'Scan cancelled successfully'
            });

            expect(mockOrchestrator.cancelScan).toHaveBeenCalledWith('test-scan-123');
        });

        test('should return 404 for non-existent or completed scan', async () => {
            mockOrchestrator.cancelScan.mockReturnValue(false);

            const response = await request(app)
                .delete('/enhanced-scan/non-existent-scan');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Scan not found or already completed');
        });
    });

    describe('GET /enhanced-scan/types - Get Scan Types', () => {
        test('should return available scan types', async () => {
            const response = await request(app)
                .get('/enhanced-scan/types');

            expect(response.status).toBe(200);
            expect(response.body.scanTypes).toHaveLength(5);
            expect(response.body.scanTypes[0]).toEqual({
                type: 'url',
                name: 'URL Scan',
                description: 'Scan web pages for exposed secrets and vulnerabilities',
                options: expect.any(Object)
            });
            expect(response.body.patternStats).toEqual({
                totalPatterns: 25,
                categoryCounts: {
                    secrets: 15,
                    vulnerabilities: 5,
                    configurations: 5
                }
            });
        });
    });

    describe('Response Format Utilities', () => {
        test('should calculate filtered summary correctly', () => {
            const categories = [
                {
                    category: 'secrets',
                    findings: [
                        { severity: 'critical' },
                        { severity: 'high' },
                        { severity: 'medium' }
                    ]
                },
                {
                    category: 'headers',
                    findings: [
                        { severity: 'high' },
                        { severity: 'low' }
                    ]
                }
            ];

            const summary = enhancedScanController.calculateFilteredSummary(categories);

            expect(summary).toEqual({
                totalFindings: 5,
                criticalCount: 1,
                highCount: 2,
                mediumCount: 1,
                lowCount: 1,
                categoryCounts: {
                    secrets: 3,
                    headers: 2
                }
            });
        });

        test('should map severity to SARIF levels correctly', () => {
            expect(enhancedScanController.mapSeverityToSARIF('critical')).toBe('error');
            expect(enhancedScanController.mapSeverityToSARIF('high')).toBe('error');
            expect(enhancedScanController.mapSeverityToSARIF('medium')).toBe('warning');
            expect(enhancedScanController.mapSeverityToSARIF('low')).toBe('note');
            expect(enhancedScanController.mapSeverityToSARIF('unknown')).toBe('warning');
        });
    });

    describe('Error Handling', () => {
        test('should handle orchestrator errors gracefully', async () => {
            mockOrchestrator.getScanStatus.mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            const response = await request(app)
                .get('/enhanced-scan/test-scan-123/status');

            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Failed to get scan status');
        });

        test('should handle malformed requests', async () => {
            const response = await request(app)
                .post('/enhanced-scan')
                .send('invalid json');

            expect(response.status).toBe(400);
        });
    });
});