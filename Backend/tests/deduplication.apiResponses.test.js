/**
 * Tests for deduplication statistics in API responses
 * Verifies that deduplication information is properly included in scan results
 */

const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');
const { ResultFormatter } = require('../services/resultFormatter');
const { DeduplicationEngine } = require('../utils/deduplicationEngine');

describe('Deduplication API Response Integration', () => {
    let orchestrator;
    let resultFormatter;

    beforeEach(() => {
        orchestrator = new SimpleScanOrchestrator();
        resultFormatter = new ResultFormatter();
    });

    afterEach(async () => {
        if (orchestrator) {
            await orchestrator.shutdown();
        }
    });

    describe('Scan Status API Response', () => {
        test('should include deduplication status in scan progress', async () => {
            // Mock scanner that returns duplicate findings
            const mockScanner = {
                scan: jest.fn().mockResolvedValue([
                    {
                        id: 'finding-1',
                        pattern: { id: 'hardcoded-password' },
                        file: 'config.js',
                        value: 'password123',
                        severity: 'critical',
                        confidence: 0.9,
                        location: { line: 10, column: 5 }
                    },
                    {
                        id: 'finding-2',
                        pattern: { id: 'hardcoded-password' },
                        file: 'config.js',
                        value: 'password123',
                        severity: 'critical',
                        confidence: 0.9,
                        location: { line: 15, column: 8 }
                    }
                ])
            };

            // Mock the scanner modules
            jest.doMock('../services/urlScanner', () => mockScanner);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan to start
            await new Promise(resolve => setTimeout(resolve, 100));

            const status = orchestrator.getScanStatus(scanId);

            expect(status).toBeDefined();
            expect(status.deduplicationStatus).toBeDefined();
            expect(status.deduplicationStatus.enabled).toBe(true);
            expect(status.deduplicationStatus.stats).toBeDefined();
            expect(typeof status.deduplicationStatus.currentCacheSize).toBe('number');
        });

        test('should show deduplication disabled when no engine is available', () => {
            const scanId = 'test-scan-id';

            // Create scan state without deduplication engine
            const scanState = {
                scanId,
                status: 'running',
                progress: { current: 0, total: 1, phases: [] },
                results: { categories: [], summary: {} }
            };

            orchestrator.scanProgress.set(scanId, scanState);

            const status = orchestrator.getScanStatus(scanId);

            expect(status.deduplicationStatus).toBeDefined();
            expect(status.deduplicationStatus.enabled).toBe(false);
            expect(status.deduplicationStatus.reason).toBe('No deduplication engine initialized');
        });
    });

    describe('Scan Results API Response', () => {
        test('should include deduplication statistics in final results', async () => {
            const mockFindings = [
                {
                    id: 'finding-1',
                    pattern: { id: 'api-key' },
                    file: 'app.js',
                    value: 'sk-1234567890',
                    severity: 'high',
                    confidence: 0.8,
                    location: { line: 5, column: 10 }
                },
                {
                    id: 'finding-2',
                    pattern: { id: 'api-key' },
                    file: 'app.js',
                    value: 'sk-1234567890',
                    severity: 'high',
                    confidence: 0.8,
                    location: { line: 10, column: 15 }
                },
                {
                    id: 'finding-3',
                    pattern: { id: 'password' },
                    file: 'config.js',
                    value: 'secret123',
                    severity: 'critical',
                    confidence: 0.9,
                    location: { line: 20, column: 5 }
                }
            ];

            const mockScanner = {
                scan: jest.fn().mockResolvedValue(mockFindings)
            };

            jest.doMock('../services/urlScanner', () => mockScanner);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan to complete
            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results).toBeDefined();
            expect(results.results.deduplicationStats).toBeDefined();
            expect(results.results.deduplicationStats.deduplicationEnabled).toBe(true);
            expect(results.results.deduplicationStats.finalFindingsCount).toBeDefined();
            expect(results.results.deduplicationStats.totalDuplicatesRemoved).toBeDefined();
            expect(results.results.deduplicationStats.deduplicationRate).toBeDefined();
        });

        test('should show occurrence counts in merged findings', async () => {
            const duplicateFindings = [
                {
                    id: 'finding-1',
                    pattern: { id: 'hardcoded-secret' },
                    file: 'utils.js',
                    value: 'mysecret123',
                    severity: 'high',
                    confidence: 0.7,
                    location: { line: 5, column: 10 }
                },
                {
                    id: 'finding-2',
                    pattern: { id: 'hardcoded-secret' },
                    file: 'utils.js',
                    value: 'mysecret123',
                    severity: 'critical', // Higher severity
                    confidence: 0.9, // Higher confidence
                    location: { line: 15, column: 5 }
                }
            ];

            const mockScanner = {
                scan: jest.fn().mockResolvedValue(duplicateFindings)
            };

            jest.doMock('../services/urlScanner', () => mockScanner);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            const results = orchestrator.getScanResults(scanId);
            const findings = results.results.categories[0]?.findings || [];

            expect(findings).toHaveLength(1); // Should be deduplicated to 1 finding

            const mergedFinding = findings[0];
            expect(mergedFinding.occurrenceCount).toBe(2);
            expect(mergedFinding.locations).toHaveLength(2);
            expect(mergedFinding.severity).toBe('critical'); // Should preserve highest severity
            expect(mergedFinding.confidence).toBe(0.9); // Should preserve highest confidence
        });
    });

    describe('Result Formatter Integration', () => {
        test('should include deduplication statistics in formatted results', () => {
            const mockScanResults = {
                scanId: 'test-scan-123',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [
                                {
                                    id: 'finding-1',
                                    severity: 'high',
                                    confidence: 0.8,
                                    occurrenceCount: 3,
                                    locations: [
                                        { file: 'app.js', line: 10, column: 5 },
                                        { file: 'app.js', line: 20, column: 8 },
                                        { file: 'config.js', line: 5, column: 12 }
                                    ]
                                }
                            ]
                        }
                    ],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 0,
                        highCount: 1,
                        mediumCount: 0,
                        lowCount: 0
                    },
                    deduplicationStats: {
                        deduplicationEnabled: true,
                        finalFindingsCount: 1,
                        totalDuplicatesRemoved: 2,
                        deduplicationRate: '66.67%',
                        totalFindings: 3,
                        duplicatesRemoved: 2,
                        uniqueFindings: 1
                    }
                }
            };

            const formattedResults = resultFormatter.formatResults(mockScanResults);

            expect(formattedResults.results.deduplicationStats).toBeDefined();
            expect(formattedResults.results.deduplicationStats.deduplicationEnabled).toBe(true);
            expect(formattedResults.results.deduplicationStats.totalDuplicatesRemoved).toBe(2);
            expect(formattedResults.results.deduplicationStats.deduplicationRate).toBe('66.67%');

            // Check enhanced summary
            expect(formattedResults.results.summary.totalOccurrences).toBe(3);
            expect(formattedResults.results.summary.duplicateFindings).toBe(1);
            expect(formattedResults.results.summary.uniqueFindings).toBe(1);
        });

        test('should include deduplication info in consolidated report', () => {
            const mockScanResults = {
                scanId: 'test-scan-456',
                target: { type: 'repository', value: 'https://github.com/example/repo' },
                status: 'completed',
                endTime: new Date().toISOString(),
                duration: 30000,
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [
                                {
                                    id: 'finding-1',
                                    severity: 'critical',
                                    confidence: 0.9,
                                    occurrenceCount: 5
                                }
                            ]
                        }
                    ],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 1,
                        highCount: 0,
                        mediumCount: 0,
                        lowCount: 0
                    },
                    deduplicationStats: {
                        deduplicationEnabled: true,
                        finalFindingsCount: 1,
                        totalDuplicatesRemoved: 4,
                        deduplicationRate: '80.00%'
                    }
                }
            };

            const consolidatedReport = resultFormatter.createConsolidatedReport(mockScanResults);

            expect(consolidatedReport.deduplicationStats).toBeDefined();
            expect(consolidatedReport.deduplicationStats.deduplicationEnabled).toBe(true);
            expect(consolidatedReport.deduplicationStats.totalDuplicatesRemoved).toBe(4);

            expect(consolidatedReport.metadata.deduplicationEnabled).toBe(true);

            expect(consolidatedReport.overview.deduplicationSummary).toBeDefined();
            expect(consolidatedReport.overview.deduplicationSummary.enabled).toBe(true);
            expect(consolidatedReport.overview.deduplicationSummary.duplicatesRemoved).toBe(4);
            expect(consolidatedReport.overview.deduplicationSummary.deduplicationRate).toBe('80.00%');
            expect(consolidatedReport.overview.deduplicationSummary.uniqueFindings).toBe(1);
        });

        test('should handle missing deduplication stats gracefully', () => {
            const mockScanResults = {
                scanId: 'test-scan-789',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [
                                {
                                    id: 'finding-1',
                                    severity: 'medium',
                                    confidence: 0.6
                                }
                            ]
                        }
                    ],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 1,
                        lowCount: 0
                    }
                    // No deduplicationStats
                }
            };

            const formattedResults = resultFormatter.formatResults(mockScanResults);

            expect(formattedResults.results.deduplicationStats).toBeUndefined();

            // Summary should still work with default values
            expect(formattedResults.results.summary.totalOccurrences).toBe(1);
            expect(formattedResults.results.summary.duplicateFindings).toBe(0);
            expect(formattedResults.results.summary.uniqueFindings).toBe(1);

            const consolidatedReport = resultFormatter.createConsolidatedReport(mockScanResults);
            expect(consolidatedReport.deduplicationStats).toBeUndefined();
            expect(consolidatedReport.overview.deduplicationSummary).toBeNull();
        });
    });

    describe('Category-level Deduplication Statistics', () => {
        test('should include deduplication stats at category level', async () => {
            const mockFindings = [
                {
                    id: 'finding-1',
                    pattern: { id: 'api-key' },
                    file: 'app.js',
                    value: 'key-123',
                    severity: 'high'
                },
                {
                    id: 'finding-2',
                    pattern: { id: 'api-key' },
                    file: 'app.js',
                    value: 'key-123',
                    severity: 'high'
                }
            ];

            const mockScanner = {
                scan: jest.fn().mockResolvedValue(mockFindings)
            };

            jest.doMock('../services/urlScanner', () => mockScanner);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            await new Promise(resolve => {
                orchestrator.on('scanCompleted', () => resolve());
            });

            const results = orchestrator.getScanResults(scanId);
            const category = results.results.categories[0];

            expect(category.deduplicationStats).toBeDefined();
            expect(category.deduplicationStats.originalCount).toBe(2);
            expect(category.deduplicationStats.deduplicatedCount).toBe(1);
            expect(category.deduplicationStats.duplicatesRemoved).toBe(1);
        });
    });

    describe('Error Handling in API Responses', () => {
        test('should include deduplication error information when deduplication fails', () => {
            const mockScanResults = {
                scanId: 'test-scan-error',
                target: { type: 'url', value: 'https://example.com' },
                status: 'partial',
                results: {
                    categories: [],
                    summary: {
                        totalFindings: 0,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 0,
                        lowCount: 0
                    },
                    deduplicationStats: {
                        deduplicationEnabled: false,
                        error: 'Deduplication timeout: 35000ms > 30000ms',
                        fallbackUsed: true
                    }
                }
            };

            const formattedResults = resultFormatter.formatResults(mockScanResults);

            expect(formattedResults.results.deduplicationStats).toBeDefined();
            expect(formattedResults.results.deduplicationStats.deduplicationEnabled).toBe(false);
            expect(formattedResults.results.deduplicationStats.error).toContain('timeout');
            expect(formattedResults.results.deduplicationStats.fallbackUsed).toBe(true);
        });
    });

    describe('Performance Impact Reporting', () => {
        test('should include deduplication performance metrics', () => {
            const mockScanResults = {
                scanId: 'test-scan-perf',
                target: { type: 'url', value: 'https://example.com' },
                status: 'completed',
                results: {
                    categories: [
                        {
                            category: 'secrets',
                            findings: [{ id: 'finding-1', severity: 'medium' }]
                        }
                    ],
                    summary: { totalFindings: 1 },
                    deduplicationStats: {
                        deduplicationEnabled: true,
                        deduplicationTime: 150,
                        averageDeduplicationTime: 125,
                        operationCount: 3,
                        memoryUsage: 1048576, // 1MB
                        peakMemoryUsage: 2097152, // 2MB
                        performance: {
                            maxOperationTime: 200,
                            recentAverageTime: 130,
                            slowOperationThreshold: 1000,
                            totalOperations: 3
                        }
                    }
                }
            };

            const formattedResults = resultFormatter.formatResults(mockScanResults);

            expect(formattedResults.results.deduplicationStats.performance).toBeDefined();
            expect(formattedResults.results.deduplicationStats.performance.maxOperationTime).toBe(200);
            expect(formattedResults.results.deduplicationStats.performance.recentAverageTime).toBe(130);
            expect(formattedResults.results.deduplicationStats.averageDeduplicationTime).toBe(125);
        });
    });
});