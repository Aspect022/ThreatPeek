/**
 * Integration tests for SimpleScanOrchestrator deduplication functionality
 * Tests orchestrator-level deduplication across scan phases
 */

const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');
const { DeduplicationEngine } = require('../services/deduplicationEngine');

// Mock scanners for testing
const mockUrlScanner = {
    scan: jest.fn()
};

const mockRepositoryScanner = {
    scan: jest.fn()
};

const mockFileDetectionScanner = {
    scan: jest.fn()
};

const mockHeaderAnalyzer = {
    scan: jest.fn()
};

const mockOwaspChecker = {
    scan: jest.fn()
};

// Mock the scanner modules
jest.mock('../services/urlScanner', () => mockUrlScanner);
jest.mock('../services/repositoryScanner', () => mockRepositoryScanner);
jest.mock('../services/fileDetectionScanner', () => mockFileDetectionScanner);
jest.mock('../services/headerAnalyzer', () => mockHeaderAnalyzer);
jest.mock('../services/owaspChecker', () => mockOwaspChecker);

describe('SimpleScanOrchestrator Deduplication Integration', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new SimpleScanOrchestrator();

        // Reset all mocks
        jest.clearAllMocks();

        // Set up default mock implementations
        mockUrlScanner.scan.mockResolvedValue([]);
        mockRepositoryScanner.scan.mockResolvedValue([]);
        mockFileDetectionScanner.scan.mockResolvedValue([]);
        mockHeaderAnalyzer.scan.mockResolvedValue([]);
        mockOwaspChecker.scan.mockResolvedValue([]);
    });

    afterEach(async () => {
        await orchestrator.shutdown();
    });

    describe('Phase-level deduplication', () => {
        test('should deduplicate findings within a single scan phase', async () => {
            // Create duplicate findings for URL scan
            const duplicateFindings = [
                {
                    type: 'hardcoded-password',
                    pattern: { id: 'password-001' },
                    file: 'config.js',
                    value: 'password123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 10, column: 5 }
                },
                {
                    type: 'hardcoded-password',
                    pattern: { id: 'password-001' },
                    file: 'config.js',
                    value: 'password123',
                    severity: 'high',
                    confidence: 0.8,
                    location: { line: 15, column: 8 }
                },
                {
                    type: 'api-key',
                    pattern: { id: 'api-key-001' },
                    file: 'api.js',
                    value: 'sk-1234567890',
                    severity: 'critical',
                    confidence: 0.95,
                    location: { line: 5, column: 12 }
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(duplicateFindings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have deduplication statistics
            expect(results.results.deduplicationStats).toBeDefined();
            expect(results.results.deduplicationStats.deduplicationEnabled).toBe(true);

            // Should have deduplicated the duplicate password finding
            const urlCategory = results.results.categories.find(cat => cat.scanType === 'url');
            expect(urlCategory.findings).toHaveLength(2); // 2 unique findings instead of 3
            expect(urlCategory.deduplicationStats.originalCount).toBe(3);
            expect(urlCategory.deduplicationStats.deduplicatedCount).toBe(2);
            expect(urlCategory.deduplicationStats.duplicatesRemoved).toBe(1);

            // Check that the deduplicated finding has merged properties
            const passwordFinding = urlCategory.findings.find(f => f.type === 'hardcoded-password');
            expect(passwordFinding.occurrenceCount).toBe(2);
            expect(passwordFinding.highestConfidence).toBe(0.9); // Highest confidence preserved
            expect(passwordFinding.mostSevereSeverity).toBe('high');
        });

        test('should handle deduplication errors gracefully', async () => {
            // Mock DeduplicationEngine to throw an error
            const originalDeduplicateFileFindings = DeduplicationEngine.prototype.deduplicateFileFindings;
            DeduplicationEngine.prototype.deduplicateFileFindings = jest.fn().mockImplementation(() => {
                throw new Error('Deduplication failed');
            });

            const findings = [
                {
                    type: 'test-finding',
                    pattern: { id: 'test-001' },
                    file: 'test.js',
                    value: 'test-value',
                    severity: 'medium',
                    confidence: 0.8
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(findings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should fall back to original results
            const urlCategory = results.results.categories.find(cat => cat.scanType === 'url');
            expect(urlCategory.findings).toHaveLength(1);
            expect(urlCategory.findings[0]).toEqual(findings[0]);

            // Restore original method
            DeduplicationEngine.prototype.deduplicateFileFindings = originalDeduplicateFileFindings;
        });
    });

    describe('Cross-phase deduplication', () => {
        test('should deduplicate findings across multiple scan phases', async () => {
            // Create findings that appear in multiple phases
            const sharedFinding = {
                type: 'hardcoded-password',
                pattern: { id: 'password-001' },
                file: 'config.js',
                value: 'password123',
                severity: 'high',
                confidence: 0.9,
                location: { line: 10, column: 5 }
            };

            const urlFindings = [
                sharedFinding,
                {
                    type: 'api-key',
                    pattern: { id: 'api-key-001' },
                    file: 'api.js',
                    value: 'sk-1234567890',
                    severity: 'critical',
                    confidence: 0.95,
                    location: { line: 5, column: 12 }
                }
            ];

            const repositoryFindings = [
                // Same finding as in URL scan (should be deduplicated)
                {
                    ...sharedFinding,
                    confidence: 0.85 // Lower confidence
                },
                {
                    type: 'database-password',
                    pattern: { id: 'db-password-001' },
                    file: 'db.js',
                    value: 'dbpass456',
                    severity: 'high',
                    confidence: 0.88,
                    location: { line: 20, column: 10 }
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(urlFindings);
            mockRepositoryScanner.scan.mockResolvedValue(repositoryFindings);

            const scanId = await orchestrator.startScan({
                repositoryUrl: 'https://github.com/test/repo',
                scanTypes: ['url', 'repository']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have final deduplication statistics
            expect(results.results.deduplicationStats).toBeDefined();
            expect(results.results.deduplicationStats.deduplicationEnabled).toBe(true);
            expect(results.results.deduplicationStats.totalDuplicatesRemoved).toBe(1);
            expect(results.results.deduplicationStats.finalFindingsCount).toBe(3);

            // Raw results should contain all findings before final deduplication
            expect(results.rawResults).toHaveLength(3); // After phase-level deduplication

            // Final summary should reflect deduplicated counts
            expect(results.results.summary.totalFindings).toBe(3);
            expect(results.results.summary.criticalCount).toBe(1);
            expect(results.results.summary.highCount).toBe(2);
        });

        test('should preserve highest confidence and most severe severity across phases', async () => {
            const baseFinding = {
                type: 'hardcoded-password',
                pattern: { id: 'password-001' },
                file: 'config.js',
                value: 'password123',
                location: { line: 10, column: 5 }
            };

            // URL scan finds it with medium severity and low confidence
            const urlFindings = [{
                ...baseFinding,
                severity: 'medium',
                confidence: 0.6
            }];

            // Repository scan finds it with high severity and high confidence
            const repositoryFindings = [{
                ...baseFinding,
                severity: 'high',
                confidence: 0.9
            }];

            // Files scan finds it with critical severity but medium confidence
            const fileFindings = [{
                ...baseFinding,
                severity: 'critical',
                confidence: 0.7
            }];

            mockUrlScanner.scan.mockResolvedValue(urlFindings);
            mockRepositoryScanner.scan.mockResolvedValue(repositoryFindings);
            mockFileDetectionScanner.scan.mockResolvedValue(fileFindings);

            const scanId = await orchestrator.startScan({
                repositoryUrl: 'https://github.com/test/repo',
                scanTypes: ['url', 'repository', 'files']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have only 1 finding after deduplication
            expect(results.results.deduplicationStats.finalFindingsCount).toBe(1);
            expect(results.results.deduplicationStats.totalDuplicatesRemoved).toBe(2);

            // Final summary should use the most severe severity (critical)
            expect(results.results.summary.totalFindings).toBe(1);
            expect(results.results.summary.criticalCount).toBe(1);
            expect(results.results.summary.highCount).toBe(0);
            expect(results.results.summary.mediumCount).toBe(0);
        });
    });

    describe('Deduplication statistics', () => {
        test('should include comprehensive deduplication statistics', async () => {
            const findings = [
                {
                    type: 'hardcoded-password',
                    pattern: { id: 'password-001' },
                    file: 'config.js',
                    value: 'password123',
                    severity: 'high',
                    confidence: 0.9
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(findings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have deduplication statistics
            const stats = results.results.deduplicationStats;
            expect(stats).toBeDefined();
            expect(stats.deduplicationEnabled).toBe(true);
            expect(stats.finalFindingsCount).toBeDefined();
            expect(stats.totalDuplicatesRemoved).toBeDefined();
            expect(stats.totalFindings).toBeDefined();
            expect(stats.uniqueFindings).toBeDefined();
            expect(stats.deduplicationTime).toBeDefined();
            expect(stats.deduplicationRate).toBeDefined();
            expect(stats.cacheSize).toBeDefined();

            // Phase-level statistics should also be present
            const urlCategory = results.results.categories.find(cat => cat.scanType === 'url');
            expect(urlCategory.deduplicationStats).toBeDefined();
            expect(urlCategory.deduplicationStats.originalCount).toBe(1);
            expect(urlCategory.deduplicationStats.deduplicatedCount).toBe(1);
            expect(urlCategory.deduplicationStats.duplicatesRemoved).toBe(0);
        });

        test('should handle scans with no results', async () => {
            mockUrlScanner.scan.mockResolvedValue([]);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have deduplication statistics even with no results
            const stats = results.results.deduplicationStats;
            expect(stats).toBeDefined();
            expect(stats.deduplicationEnabled).toBe(false);
            expect(stats.reason).toBe('No results to deduplicate');
        });

        test('should track memory usage and performance metrics', async () => {
            // Create a large number of findings to test performance tracking
            const findings = Array.from({ length: 100 }, (_, i) => ({
                type: 'test-finding',
                pattern: { id: `test-${i % 10}` }, // Create some duplicates
                file: `file${i % 20}.js`,
                value: `value${i % 30}`,
                severity: 'medium',
                confidence: 0.8,
                location: { line: i, column: 1 }
            }));

            mockUrlScanner.scan.mockResolvedValue(findings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have performance metrics
            const stats = results.results.deduplicationStats;
            expect(stats.deduplicationTime).toBeGreaterThan(0);
            expect(stats.memoryUsage).toBeGreaterThan(0);
            expect(stats.cacheSize).toBeGreaterThan(0);
            expect(stats.deduplicationRate).toBeGreaterThanOrEqual(0);
            expect(stats.deduplicationRate).toBeLessThanOrEqual(1);
        });
    });

    describe('Error handling and fallback', () => {
        test('should handle final deduplication errors gracefully', async () => {
            // Mock DeduplicationEngine to throw an error during final deduplication
            const originalDeduplicateScanFindings = DeduplicationEngine.prototype.deduplicateScanFindings;
            DeduplicationEngine.prototype.deduplicateScanFindings = jest.fn().mockImplementation(() => {
                throw new Error('Final deduplication failed');
            });

            const findings = [
                {
                    type: 'test-finding',
                    pattern: { id: 'test-001' },
                    file: 'test.js',
                    value: 'test-value',
                    severity: 'medium',
                    confidence: 0.8
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(findings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should have error information in deduplication stats
            const stats = results.results.deduplicationStats;
            expect(stats.deduplicationEnabled).toBe(false);
            expect(stats.error).toBe('Final deduplication failed');
            expect(stats.fallbackUsed).toBe(true);

            // Should still have scan results (fallback behavior)
            expect(results.results.categories).toHaveLength(1);
            expect(results.results.categories[0].findings).toHaveLength(1);

            // Restore original method
            DeduplicationEngine.prototype.deduplicateScanFindings = originalDeduplicateScanFindings;
        });

        test('should clean up deduplication engines after scan completion', async () => {
            const findings = [
                {
                    type: 'test-finding',
                    pattern: { id: 'test-001' },
                    file: 'test.js',
                    value: 'test-value',
                    severity: 'medium',
                    confidence: 0.8
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(findings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Deduplication engine should be created during scan
            expect(orchestrator.deduplicationEngines.has(scanId)).toBe(true);

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            // Wait a bit for cleanup to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            // Deduplication engine should be cleaned up after scan
            expect(orchestrator.deduplicationEngines.has(scanId)).toBe(false);
        });
    });

    describe('Integration with existing scan flow', () => {
        test('should maintain backward compatibility with existing scan results format', async () => {
            const findings = [
                {
                    type: 'hardcoded-password',
                    pattern: { id: 'password-001' },
                    file: 'config.js',
                    value: 'password123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 10, column: 5 }
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(findings);

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            // Should maintain existing result structure
            expect(results.scanId).toBe(scanId);
            expect(results.target).toBeDefined();
            expect(results.status).toBe('completed');
            expect(results.startTime).toBeDefined();
            expect(results.endTime).toBeDefined();
            expect(results.duration).toBeDefined();
            expect(results.progress).toBeDefined();
            expect(results.results).toBeDefined();
            expect(results.results.categories).toBeDefined();
            expect(results.results.summary).toBeDefined();
            expect(results.rawResults).toBeDefined();
            expect(results.errors).toBeDefined();

            // Should add deduplication statistics without breaking existing structure
            expect(results.results.deduplicationStats).toBeDefined();
        });

        test('should emit events during scan phases with deduplication info', async () => {
            const findings = [
                {
                    type: 'test-finding',
                    pattern: { id: 'test-001' },
                    file: 'test.js',
                    value: 'test-value',
                    severity: 'medium',
                    confidence: 0.8
                }
            ];

            mockUrlScanner.scan.mockResolvedValue(findings);

            const phaseCompletedEvents = [];
            orchestrator.on('scanPhaseCompleted', (event) => {
                phaseCompletedEvents.push(event);
            });

            const scanId = await orchestrator.startScan({
                url: 'https://example.com',
                scanTypes: ['url']
            });

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            // Should have emitted phase completed events
            expect(phaseCompletedEvents).toHaveLength(1);
            expect(phaseCompletedEvents[0].scanId).toBe(scanId);
            expect(phaseCompletedEvents[0].phase).toBe('url');
            expect(phaseCompletedEvents[0].results).toBeDefined();
        });
    });
});