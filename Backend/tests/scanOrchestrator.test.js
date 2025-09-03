/**
 * Integration Tests for Scan Orchestrator
 * Tests multi-scan type coordination, progress tracking, and error recovery
 */

const { ScanOrchestrator } = require('../services/scanOrchestrator');

// Mock scanner modules
jest.mock('../services/urlScanner', () => ({
    scan: jest.fn()
}));

jest.mock('../services/repositoryScanner', () => ({
    scan: jest.fn()
}));

jest.mock('../services/fileDetectionScanner', () => ({
    scan: jest.fn()
}));

jest.mock('../services/headerAnalyzer', () => ({
    scan: jest.fn()
}));

jest.mock('../services/owaspChecker', () => ({
    scan: jest.fn()
}));

const urlScanner = require('../services/urlScanner');
const repositoryScanner = require('../services/repositoryScanner');
const fileDetectionScanner = require('../services/fileDetectionScanner');
const headerAnalyzer = require('../services/headerAnalyzer');
const owaspChecker = require('../services/owaspChecker');

describe('ScanOrchestrator Integration Tests', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new ScanOrchestrator();
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any active scans
        orchestrator.scanProgress.clear();
        orchestrator.scanResults.clear();
        orchestrator.scanErrors.clear();
    });

    describe('Basic Scan Orchestration', () => {
        test('should successfully orchestrate a single URL scan', async () => {
            // Mock successful URL scan
            const mockResults = [
                {
                    type: 'API Key',
                    severity: 'high',
                    confidence: 0.9,
                    value: 'sk-test123',
                    file: 'https://example.com',
                    pattern: { id: 'test-pattern', category: 'secrets' }
                }
            ];

            urlScanner.scan.mockResolvedValue(mockResults);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            expect(scanId).toBeDefined();
            expect(typeof scanId).toBe('string');

            // Wait for scan to complete
            await new Promise(resolve => {
                const checkStatus = () => {
                    const status = orchestrator.getScanStatus(scanId);
                    if (status && ['completed', 'failed', 'partial'].includes(status.status)) {
                        resolve();
                    } else {
                        setTimeout(checkStatus, 10);
                    }
                };
                checkStatus();
            });

            // Verify scan was called with correct parameters
            expect(urlScanner.scan).toHaveBeenCalledWith(
                { type: 'url', value: 'https://example.com' },
                expect.objectContaining({
                    onProgress: expect.any(Function)
                })
            );

            // Check final scan state
            const scanResults = orchestrator.getScanResults(scanId);
            expect(scanResults).toBeDefined();
            expect(scanResults.status).toBe('completed');
            expect(scanResults.results.categories).toHaveLength(1);
            expect(scanResults.results.categories[0].findings).toEqual(mockResults);
        });

        test('should orchestrate multiple scan types in sequence', async () => {
            // Mock results for different scanners
            const urlResults = [{ type: 'URL Finding', severity: 'high' }];
            const fileResults = [{ type: 'File Finding', severity: 'medium' }];
            const headerResults = [{ type: 'Header Finding', severity: 'low' }];

            urlScanner.scan.mockResolvedValue(urlResults);
            fileDetectionScanner.scan.mockResolvedValue(fileResults);
            headerAnalyzer.scan.mockResolvedValue(headerResults);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files', 'headers'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            // Verify all scanners were called
            expect(urlScanner.scan).toHaveBeenCalled();
            expect(fileDetectionScanner.scan).toHaveBeenCalled();
            expect(headerAnalyzer.scan).toHaveBeenCalled();

            // Check results contain all findings
            const scanResults = orchestrator.getScanResults(scanId);
            expect(scanResults.results.categories).toHaveLength(3);
            expect(scanResults.results.summary.totalFindings).toBe(3);
        });

        test('should handle repository scan requests', async () => {
            const mockResults = [
                {
                    type: 'Repository Secret',
                    severity: 'critical',
                    confidence: 0.95,
                    value: 'github_pat_123',
                    file: 'config.js'
                }
            ];

            repositoryScanner.scan.mockResolvedValue(mockResults);

            const scanRequest = {
                repositoryUrl: 'https://github.com/user/repo',
                scanTypes: ['repository'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            expect(repositoryScanner.scan).toHaveBeenCalledWith(
                { type: 'repository', value: 'https://github.com/user/repo' },
                expect.any(Object)
            );

            const scanResults = orchestrator.getScanResults(scanId);
            expect(scanResults.target.type).toBe('repository');
            expect(scanResults.target.value).toBe('https://github.com/user/repo');
        });
    });

    describe('Progress Tracking', () => {
        test('should track progress through scan phases', async () => {
            const progressUpdates = [];

            urlScanner.scan.mockImplementation(async (target, options) => {
                // Simulate progress updates
                if (options.onProgress) {
                    options.onProgress(25);
                    options.onProgress(50);
                    options.onProgress(100);
                }
                return [{ type: 'test', severity: 'low' }];
            });

            // Listen for progress events
            orchestrator.on('scanProgress', (data) => {
                progressUpdates.push(data);
            });

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            // Verify progress was tracked
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[0].scanId).toBe(scanId);
            expect(progressUpdates[0].phase).toBe('url');

            // Check final progress state
            const scanStatus = orchestrator.getScanStatus(scanId);
            expect(scanStatus.progress.current).toBe(1);
            expect(scanStatus.progress.total).toBe(1);
        });

        test('should emit phase events during scan execution', async () => {
            const events = [];

            orchestrator.on('scanPhaseStarted', (data) => events.push({ type: 'started', ...data }));
            orchestrator.on('scanPhaseCompleted', (data) => events.push({ type: 'completed', ...data }));
            orchestrator.on('scanCompleted', (data) => events.push({ type: 'scanCompleted', ...data }));

            urlScanner.scan.mockResolvedValue([]);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            // Verify events were emitted
            expect(events).toHaveLength(3);
            expect(events[0].type).toBe('started');
            expect(events[1].type).toBe('completed');
            expect(events[2].type).toBe('scanCompleted');
            expect(events[0].scanId).toBe(scanId);
        });
    });

    describe('Error Recovery', () => {
        test('should handle recoverable errors with retry logic', async () => {
            let callCount = 0;

            urlScanner.scan.mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                    const error = new Error('Connection timeout');
                    error.code = 'ETIMEDOUT';
                    throw error;
                }
                return [{ type: 'recovered', severity: 'medium' }];
            });

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            // Verify retry was attempted
            expect(urlScanner.scan).toHaveBeenCalledTimes(2);

            // Check scan completed successfully after retry
            const scanResults = orchestrator.getScanResults(scanId);
            expect(scanResults.status).toBe('completed');
            expect(scanResults.results.categories[0].findings).toHaveLength(1);
        });

        test('should continue with partial results when non-critical errors occur', async () => {
            urlScanner.scan.mockResolvedValue([{ type: 'url-success', severity: 'high' }]);

            fileDetectionScanner.scan.mockRejectedValue(new Error('File scan failed'));

            headerAnalyzer.scan.mockResolvedValue([{ type: 'header-success', severity: 'medium' }]);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files', 'headers'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);

            const scanResults = orchestrator.getScanResults(scanId);

            // Should have partial status due to file scan failure
            expect(scanResults.status).toBe('partial');

            // Should have results from successful scans
            expect(scanResults.results.categories).toHaveLength(2);

            // Should have error information
            expect(scanResults.errors).toHaveLength(1);
            expect(scanResults.errors[0].phase).toBe('files');
        });

        test('should fail completely on critical errors', async () => {
            const criticalError = new Error('Invalid URL format');
            criticalError.code = 'INVALID_URL';

            urlScanner.scan.mockRejectedValue(criticalError);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            await expect(orchestrator.startScan(scanRequest)).rejects.toThrow('Invalid URL format');
        });

        test('should handle scan timeout', async () => {
            // Mock a scanner that takes too long
            urlScanner.scan.mockImplementation(() => {
                return new Promise(() => { }); // Never resolves
            });

            // Set a very short timeout for testing
            orchestrator.scanTimeout = 50;

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            // Start scan - this now returns immediately
            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for timeout to trigger
            await new Promise(resolve => setTimeout(resolve, 100));
            const scanResults = orchestrator.getScanResults(scanId);
            expect(scanResults.status).toBe('timeout');
        }, 5000);
    });

    describe('Request Validation', () => {
        test('should validate scan request parameters', async () => {
            // Test missing URL and repository URL
            await expect(orchestrator.startScan({})).rejects.toThrow('Either url or repositoryUrl must be provided');

            // Test both URL and repository URL provided
            await expect(orchestrator.startScan({
                url: 'https://example.com',
                repositoryUrl: 'https://github.com/user/repo'
            })).rejects.toThrow('Cannot specify both url and repositoryUrl');

            // Test invalid URL format
            await expect(orchestrator.startScan({
                url: 'not-a-valid-url'
            })).rejects.toThrow('Invalid URL format');

            // Test invalid scan types
            await expect(orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['invalid-type']
            })).rejects.toThrow('Unknown scan type: invalid-type');
        });
    });

    describe('Result Management', () => {
        test('should calculate correct summary statistics', async () => {
            const mockResults = [
                { type: 'Critical Issue', severity: 'critical' },
                { type: 'High Issue', severity: 'high' },
                { type: 'Medium Issue', severity: 'medium' },
                { type: 'Low Issue', severity: 'low' },
                { type: 'Another High', severity: 'high' }
            ];

            urlScanner.scan.mockResolvedValue(mockResults);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            const scanId = await orchestrator.startScan(scanRequest);
            const scanResults = orchestrator.getScanResults(scanId);

            expect(scanResults.results.summary.totalFindings).toBe(5);
            expect(scanResults.results.summary.criticalCount).toBe(1);
            expect(scanResults.results.summary.highCount).toBe(2);
            expect(scanResults.results.summary.mediumCount).toBe(1);
            expect(scanResults.results.summary.lowCount).toBe(1);
        });

        test('should support scan cancellation', async () => {
            let resolveScanner;

            // Mock a scan that we can control
            urlScanner.scan.mockImplementation(() => {
                return new Promise((resolve) => {
                    resolveScanner = resolve;
                });
            });

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            // Start the scan (this will return immediately with scanId)
            const scanId = await orchestrator.startScan(scanRequest);

            // The scan should be running now
            let scanStatus = orchestrator.getScanStatus(scanId);
            expect(scanStatus.status).toBe('running');

            // Cancel the scan
            const cancelled = orchestrator.cancelScan(scanId);
            expect(cancelled).toBe(true);

            scanStatus = orchestrator.getScanStatus(scanId);
            expect(scanStatus.status).toBe('cancelled');

            // Clean up the mock
            if (resolveScanner) {
                resolveScanner([]);
            }
        });

        test('should clean up old scan data', async () => {
            urlScanner.scan.mockResolvedValue([]);

            // Create multiple scans
            const scanIds = [];
            for (let i = 0; i < 3; i++) {
                const scanId = await orchestrator.startScan({
                    url: 'https://example.com',
                    scanTypes: ['url'],
                    options: {}
                });
                scanIds.push(scanId);
            }

            // Verify all scans exist
            expect(orchestrator.scanProgress.size).toBe(3);

            // Clean up with 0 max age (should remove all)
            const cleaned = orchestrator.cleanup(0);
            expect(cleaned).toBe(3);
            expect(orchestrator.scanProgress.size).toBe(0);
        });
    });

    describe('Scanner Integration', () => {
        test('should handle unknown scan types', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['unknown-scanner'],
                options: {}
            };

            await expect(orchestrator.startScan(scanRequest)).rejects.toThrow('Unknown scan type: unknown-scanner');
        });

        test('should pass options correctly to scanners', async () => {
            const customOptions = {
                maxDepth: 5,
                timeout: 60000,
                confidenceThreshold: 0.8,
                customParam: 'test-value'
            };

            urlScanner.scan.mockResolvedValue([]);

            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: customOptions
            };

            await orchestrator.startScan(scanRequest);

            expect(urlScanner.scan).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining(customOptions)
            );
        });
    });
});