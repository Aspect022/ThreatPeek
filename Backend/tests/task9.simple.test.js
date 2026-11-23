/**
 * Simple test for Task 9 - Update result processing and API responses
 * Tests basic deduplication statistics integration
 */

const { ResultFormatter } = require('../services/resultFormatter');
const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');

describe('Task 9 - API Response Deduplication Integration', () => {
    let resultFormatter;

    beforeEach(() => {
        resultFormatter = new ResultFormatter();
    });

    describe('Result Formatter Deduplication Statistics', () => {
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

            // Check that deduplication stats are preserved
            expect(formattedResults.results.deduplicationStats).toBeDefined();
            expect(formattedResults.results.deduplicationStats.deduplicationEnabled).toBe(true);
            expect(formattedResults.results.deduplicationStats.totalDuplicatesRemoved).toBe(2);
            expect(formattedResults.results.deduplicationStats.deduplicationRate).toBe('66.67%');

            // Check enhanced summary includes deduplication info
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

    describe('Scan Progress Deduplication Status', () => {
        test('should show deduplication disabled when no engine is available', () => {
            const orchestrator = new SimpleScanOrchestrator();
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