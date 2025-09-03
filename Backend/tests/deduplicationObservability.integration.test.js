/**
 * Integration tests for deduplication logging and observability in real scanning scenarios
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');
const { DeduplicationLogger } = require('../utils/deduplicationLogger');
const { DeduplicationDebugger } = require('../utils/deduplicationDebugger');
const fs = require('fs-extra');
const path = require('path');

describe('Deduplication Observability Integration Tests', () => {
    let engine;
    let logger;
    let debugger;
    let testLogDir;
    let testDebugDir;

    beforeAll(async () => {
        // Create temporary directories for testing
        testLogDir = path.join(__dirname, 'temp', 'integration-logs');
        testDebugDir = path.join(__dirname, 'temp', 'integration-debug');
        await fs.ensureDir(testLogDir);
        await fs.ensureDir(testDebugDir);
    });

    beforeEach(() => {
        // Initialize components with comprehensive logging enabled
        logger = new DeduplicationLogger({
            logLevel: 'debug',
            enableDebugMode: true,
            enableFileLogging: true,
            enablePerformanceLogging: true,
            logDirectory: testLogDir,
            enableConsoleLogging: false,
            debugCategories: ['fingerprint', 'merge', 'performance', 'cache']
        });

        debugger = new DeduplicationDebugger({
            enableDetailedAnalysis: true,
            enableFingerprintAnalysis: true,
            enablePerformanceAnalysis: true,
            outputDirectory: testDebugDir,
            enableConsoleOutput: false,
            enableFileOutput: true
        });

        engine = new DeduplicationEngine({
            enableDebugMode: true,
            enablePerformanceMonitoring: true,
            enableDetailedAnalysis: true,
            enableFingerprintAnalysis: true,
            enablePerformanceAnalysis: true,
            logger,
            debugger,
            maxCacheSize: 1000,
            slowOperationThreshold: 100 // Lower threshold for testing
        });
    });

    afterAll(async () => {
        // Clean up test directories
        try {
            await fs.remove(path.join(__dirname, 'temp'));
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Real-world Scanning Scenarios', () => {
        test('should log comprehensive data during typical scan with duplicates', async () => {
            // Simulate a typical scan with various types of findings and duplicates
            const findings = [
                // Hardcoded passwords (duplicates)
                { pattern: { id: 'hardcoded-password' }, file: 'config.js', value: 'password123', confidence: 0.9, severity: 'critical', location: { line: 10, column: 20 } },
                { pattern: { id: 'hardcoded-password' }, file: 'config.js', value: 'password123', confidence: 0.8, severity: 'high', location: { line: 15, column: 25 } },
                { pattern: { id: 'hardcoded-password' }, file: 'settings.js', value: 'password123', confidence: 0.9, severity: 'critical', location: { line: 5, column: 10 } },

                // API keys (some duplicates)
                { pattern: { id: 'api-key' }, file: 'api.js', value: 'sk-1234567890abcdef', confidence: 0.95, severity: 'critical', location: { line: 1, column: 1 } },
                { pattern: { id: 'api-key' }, file: 'api.js', value: 'sk-1234567890abcdef', confidence: 0.9, severity: 'high', location: { line: 2, column: 1 } },
                { pattern: { id: 'api-key' }, file: 'client.js', value: 'sk-abcdef1234567890', confidence: 0.95, severity: 'critical', location: { line: 8, column: 15 } },

                // SQL injection vulnerabilities (unique)
                { pattern: { id: 'sql-injection' }, file: 'database.js', value: 'SELECT * FROM users WHERE id = ' + userId, confidence: 0.8, severity: 'high', location: { line: 45, column: 20 } },
                { pattern: { id: 'sql-injection' }, file: 'queries.js', value: 'DELETE FROM logs WHERE date < ' + cutoffDate, confidence: 0.75, severity: 'medium', location: { line: 12, column: 5 } },

                // XSS vulnerabilities (unique)
                { pattern: { id: 'xss-vulnerability' }, file: 'render.js', value: 'innerHTML = userInput', confidence: 0.7, severity: 'medium', location: { line: 33, column: 10 } },

                // Configuration issues (some duplicates)
                { pattern: { id: 'debug-enabled' }, file: 'app.js', value: 'debug: true', confidence: 0.6, severity: 'low', location: { line: 3, column: 5 } },
                { pattern: { id: 'debug-enabled' }, file: 'server.js', value: 'debug: true', confidence: 0.6, severity: 'low', location: { line: 7, column: 8 } }
            ];

            // Perform file-level deduplication first
            const fileGroups = findings.reduce((groups, finding) => {
                if (!groups[finding.file]) groups[finding.file] = [];
                groups[finding.file].push(finding);
                return groups;
            }, {});

            let allDeduplicatedFindings = [];
            for (const [filePath, fileFindings] of Object.entries(fileGroups)) {
                const deduplicated = engine.deduplicateFileFindings(fileFindings, filePath);
                allDeduplicatedFindings.push(...deduplicated);
            }

            // Perform scan-level deduplication
            const finalResults = engine.deduplicateScanFindings(allDeduplicatedFindings);

            // Verify deduplication worked
            expect(finalResults.length).toBeLessThan(findings.length);
            expect(finalResults.length).toBeGreaterThan(0);

            // Check logging metrics
            const loggingMetrics = logger.getMetrics();
            expect(loggingMetrics.operations['operation_start']).toBeGreaterThan(0);
            expect(loggingMetrics.operations['operation_complete']).toBeGreaterThan(0);
            expect(loggingMetrics.performance.totalOperations).toBeGreaterThan(0);
            expect(loggingMetrics.debug.totalEvents).toBeGreaterThan(0);

            // Check observability report
            const observabilityReport = engine.getObservabilityReport();
            expect(observabilityReport.deduplication.stats.totalFindings).toBe(allDeduplicatedFindings.length);
            expect(observabilityReport.deduplication.stats.uniqueFindings).toBe(finalResults.length);
            expect(observabilityReport.deduplication.stats.duplicatesRemoved).toBeGreaterThan(0);

            // Verify specific deduplication scenarios
            const passwordFindings = finalResults.filter(f => f.pattern.id === 'hardcoded-password');
            expect(passwordFindings.length).toBeLessThan(3); // Should be deduplicated

            const apiKeyFindings = finalResults.filter(f => f.pattern.id === 'api-key');
            expect(apiKeyFindings.length).toBe(2); // Two unique API keys

            // Check that merged findings have correct occurrence counts
            const mergedFindings = finalResults.filter(f => f.occurrenceCount > 1);
            expect(mergedFindings.length).toBeGreaterThan(0);
        });

        test('should detect and log performance issues with large datasets', async () => {
            // Create a large dataset that should trigger performance monitoring
            const largeDataset = [];

            // Create patterns with high duplicate rates
            for (let i = 0; i < 500; i++) {
                largeDataset.push({
                    pattern: { id: 'hardcoded-secret' },
                    file: `file${i % 50}.js`, // 50 files
                    value: i < 250 ? 'duplicate-secret-123' : `unique-secret-${i}`, // 50% duplicates
                    confidence: 0.8 + (Math.random() * 0.2),
                    severity: ['low', 'medium', 'high', 'critical'][i % 4],
                    location: { line: i % 100, column: i % 50 }
                });
            }

            // Add some other patterns
            for (let i = 0; i < 200; i++) {
                largeDataset.push({
                    pattern: { id: 'api-key-pattern' },
                    file: `api${i % 20}.js`,
                    value: i < 100 ? 'sk-duplicate-key-abc123' : `sk-unique-key-${i}`,
                    confidence: 0.9,
                    severity: 'critical',
                    location: { line: i % 50, column: 10 }
                });
            }

            const startTime = Date.now();
            const results = engine.deduplicateScanFindings(largeDataset);
            const totalDuration = Date.now() - startTime;

            // Verify deduplication effectiveness
            expect(results.length).toBeLessThan(largeDataset.length);
            expect(results.length).toBeGreaterThan(100); // Should have many unique findings

            // Check performance logging
            const performanceReport = engine.getPerformanceReport();
            if (performanceReport.enabled) {
                expect(performanceReport.summary.totalOperations).toBeGreaterThan(0);

                // Check if slow operations were detected
                if (totalDuration > engine.options.slowOperationThreshold) {
                    expect(performanceReport.summary.slowOperations).toBeGreaterThan(0);
                }
            }

            // Check debugging analysis
            const debugReport = debugger.getDebugReport();
            expect(debugReport.summary.totalOperations).toBeGreaterThan(0);

            // Verify metrics export
            const exportedMetrics = engine.exportMetrics();
            expect(exportedMetrics['deduplication.findings.total']).toBe(largeDataset.length);
            expect(exportedMetrics['deduplication.findings.unique']).toBe(results.length);
            expect(exportedMetrics['deduplication.duplicates.removed']).toBeGreaterThan(0);
            expect(exportedMetrics['deduplication.rate.percentage']).toBeGreaterThan(0);
        });

        test('should handle and log error scenarios gracefully', async () => {
            // Test various error scenarios
            const problematicFindings = [
                // Normal finding
                { pattern: { id: 'normal' }, file: 'test.js', value: 'normal-value', confidence: 0.8, severity: 'medium' },

                // Finding with missing pattern
                { file: 'test.js', value: 'no-pattern', confidence: 0.8, severity: 'medium' },

                // Finding with null values
                { pattern: { id: 'null-test' }, file: null, value: null, confidence: 0.8, severity: 'medium' },

                // Finding with undefined values
                { pattern: { id: 'undefined-test' }, file: undefined, value: undefined, confidence: 0.8, severity: 'medium' },

                // Finding with very long values
                { pattern: { id: 'long-value' }, file: 'test.js', value: 'x'.repeat(10000), confidence: 0.8, severity: 'medium' }
            ];

            // Should handle errors gracefully
            let results;
            expect(() => {
                results = engine.deduplicateScanFindings(problematicFindings);
            }).not.toThrow();

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            // Check that error handling was logged
            const loggingMetrics = logger.getMetrics();
            expect(typeof loggingMetrics).toBe('object');

            // Verify observability report still works
            const observabilityReport = engine.getObservabilityReport();
            expect(observabilityReport).toBeDefined();
            expect(observabilityReport.deduplication).toBeDefined();
        });

        test('should provide detailed fingerprint collision analysis', async () => {
            // Create findings that might cause fingerprint collisions
            const collisionTestFindings = [
                // Identical findings (legitimate collision)
                { pattern: { id: 'test-pattern' }, file: 'test.js', value: 'secret123', confidence: 0.9, severity: 'high' },
                { pattern: { id: 'test-pattern' }, file: 'test.js', value: 'secret123', confidence: 0.8, severity: 'medium' },

                // Similar but different findings
                { pattern: { id: 'test-pattern' }, file: 'test.js', value: 'secret124', confidence: 0.9, severity: 'high' },
                { pattern: { id: 'test-pattern' }, file: 'Test.js', value: 'secret123', confidence: 0.9, severity: 'high' }, // Different case

                // Same pattern, different files
                { pattern: { id: 'test-pattern' }, file: 'other.js', value: 'secret123', confidence: 0.9, severity: 'high' },

                // Different patterns, same values
                { pattern: { id: 'other-pattern' }, file: 'test.js', value: 'secret123', confidence: 0.9, severity: 'high' }
            ];

            const results = engine.deduplicateScanFindings(collisionTestFindings);

            // Verify deduplication logic
            expect(results.length).toBeLessThan(collisionTestFindings.length);

            // Check debugging analysis for fingerprint analysis
            const debugReport = debugger.getDebugReport();
            expect(debugReport.summary.totalOperations).toBeGreaterThan(0);

            // Verify that fingerprint generation was logged
            const loggingMetrics = logger.getMetrics();
            expect(loggingMetrics.debug.totalEvents).toBeGreaterThan(0);

            // Check observability report for fingerprint data
            const observabilityReport = engine.getObservabilityReport();
            expect(observabilityReport.deduplication.stats.cacheSize).toBeGreaterThan(0);
        });

        test('should track cache performance and efficiency', async () => {
            // Create findings that will test cache performance
            const cacheTestFindings = [];

            // Add findings that will be repeated (cache hits)
            const repeatedFinding = { pattern: { id: 'cached-pattern' }, file: 'cache-test.js', value: 'cached-value', confidence: 0.8, severity: 'medium' };

            for (let i = 0; i < 50; i++) {
                cacheTestFindings.push({ ...repeatedFinding });
            }

            // Add unique findings (cache misses)
            for (let i = 0; i < 50; i++) {
                cacheTestFindings.push({
                    pattern: { id: 'unique-pattern' },
                    file: `unique-${i}.js`,
                    value: `unique-value-${i}`,
                    confidence: 0.8,
                    severity: 'medium'
                });
            }

            // Process findings to generate cache activity
            const results = engine.deduplicateScanFindings(cacheTestFindings);

            // Verify cache was used effectively
            expect(results.length).toBeLessThan(cacheTestFindings.length);

            // Check cache metrics
            const observabilityReport = engine.getObservabilityReport();
            expect(observabilityReport.deduplication.stats.cacheSize).toBeGreaterThan(0);

            // Verify cache utilization in exported metrics
            const exportedMetrics = engine.exportMetrics();
            expect(exportedMetrics['deduplication.cache.size']).toBeGreaterThan(0);
            expect(exportedMetrics['deduplication.cache.utilization']).toBeGreaterThan(0);
            expect(exportedMetrics['deduplication.cache.utilization']).toBeLessThanOrEqual(1);
        });

        test('should generate comprehensive daily summary', async () => {
            // Perform multiple operations throughout the "day"
            const operations = [
                // Morning scan - mostly unique findings
                Array.from({ length: 100 }, (_, i) => ({
                    pattern: { id: 'morning-pattern' },
                    file: `morning-${i}.js`,
                    value: `morning-secret-${i}`,
                    confidence: 0.8,
                    severity: 'medium'
                })),

                // Afternoon scan - some duplicates
                Array.from({ length: 80 }, (_, i) => ({
                    pattern: { id: 'afternoon-pattern' },
                    file: `afternoon-${i % 40}.js`, // 50% file overlap
                    value: i < 40 ? `duplicate-afternoon-secret` : `unique-afternoon-secret-${i}`,
                    confidence: 0.9,
                    severity: 'high'
                })),

                // Evening scan - high duplicate rate
                Array.from({ length: 60 }, (_, i) => ({
                    pattern: { id: 'evening-pattern' },
                    file: `evening-${i % 10}.js`, // High file overlap
                    value: i < 45 ? 'common-evening-secret' : `rare-evening-secret-${i}`,
                    confidence: 0.7,
                    severity: 'low'
                }))
            ];

            // Process each operation
            for (const operationFindings of operations) {
                engine.deduplicateScanFindings(operationFindings);

                // Small delay to simulate time passing
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Get daily summary
            const debugReport = debugger.getDebugReport();
            expect(debugReport.dailySummary).toBeDefined();
            expect(debugReport.dailySummary.operations).toBe(3);
            expect(debugReport.dailySummary.totalFindings).toBeGreaterThan(0);
            expect(debugReport.dailySummary.totalDuplicatesRemoved).toBeGreaterThan(0);

            // Verify comprehensive observability
            const observabilityReport = engine.getObservabilityReport();
            expect(observabilityReport.deduplication.stats.operationCount).toBe(3);
            expect(observabilityReport.deduplication.stats.totalFindings).toBeGreaterThan(0);
            expect(observabilityReport.deduplication.stats.duplicatesRemoved).toBeGreaterThan(0);
        });
    });

    describe('File Output and Persistence', () => {
        test('should create and maintain log files', async () => {
            // Generate some logging activity
            const findings = Array.from({ length: 20 }, (_, i) => ({
                pattern: { id: 'log-test-pattern' },
                file: `log-test-${i}.js`,
                value: `log-test-value-${i}`,
                confidence: 0.8,
                severity: 'medium'
            }));

            engine.deduplicateScanFindings(findings);

            // Wait for async file operations
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check that log files were created
            const logFiles = await logger.getLogFiles();
            expect(Array.isArray(logFiles)).toBe(true);

            // Verify log directory exists and has files
            const logDirExists = await fs.pathExists(testLogDir);
            expect(logDirExists).toBe(true);
        });

        test('should create debug analysis files', async () => {
            // Generate analysis data
            const findings = Array.from({ length: 30 }, (_, i) => ({
                pattern: { id: 'debug-test-pattern' },
                file: `debug-test-${i % 10}.js`,
                value: i < 15 ? 'duplicate-debug-value' : `unique-debug-value-${i}`,
                confidence: 0.8,
                severity: 'medium'
            }));

            engine.deduplicateScanFindings(findings);

            // Wait for async file operations
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check that debug directory exists
            const debugDirExists = await fs.pathExists(testDebugDir);
            expect(debugDirExists).toBe(true);
        });
    });

    describe('Metrics Export and Monitoring Integration', () => {
        test('should export metrics compatible with monitoring systems', () => {
            // Generate diverse findings for comprehensive metrics
            const findings = [
                ...Array.from({ length: 50 }, (_, i) => ({
                    pattern: { id: 'metric-pattern-1' },
                    file: `metric-file-${i % 10}.js`,
                    value: i < 25 ? 'duplicate-metric-value' : `unique-metric-value-${i}`,
                    confidence: 0.8,
                    severity: 'high'
                })),
                ...Array.from({ length: 30 }, (_, i) => ({
                    pattern: { id: 'metric-pattern-2' },
                    file: `metric-file-${i % 5}.js`,
                    value: `always-unique-${i}`,
                    confidence: 0.9,
                    severity: 'critical'
                }))
            ];

            engine.deduplicateScanFindings(findings);

            const exportedMetrics = engine.exportMetrics();

            // Verify all expected metrics are present
            const expectedMetrics = [
                'deduplication.operations.total',
                'deduplication.findings.total',
                'deduplication.findings.unique',
                'deduplication.duplicates.removed',
                'deduplication.rate.percentage',
                'deduplication.errors.total',
                'deduplication.performance.average_duration_ms',
                'deduplication.cache.size',
                'deduplication.cache.utilization',
                'deduplication.circuit_breaker.state',
                'deduplication.metrics.timestamp'
            ];

            expectedMetrics.forEach(metric => {
                expect(exportedMetrics).toHaveProperty(metric);
                expect(typeof exportedMetrics[metric]).toBe('number');
            });

            // Verify metric values make sense
            expect(exportedMetrics['deduplication.findings.total']).toBe(80);
            expect(exportedMetrics['deduplication.findings.unique']).toBeLessThan(80);
            expect(exportedMetrics['deduplication.duplicates.removed']).toBeGreaterThan(0);
            expect(exportedMetrics['deduplication.rate.percentage']).toBeGreaterThan(0);
            expect(exportedMetrics['deduplication.cache.utilization']).toBeGreaterThan(0);
            expect(exportedMetrics['deduplication.cache.utilization']).toBeLessThanOrEqual(1);
        });

        test('should provide real-time observability data', () => {
            // Simulate real-time scanning scenario
            const batchSize = 25;
            const totalBatches = 4;

            for (let batch = 0; batch < totalBatches; batch++) {
                const batchFindings = Array.from({ length: batchSize }, (_, i) => ({
                    pattern: { id: `batch-${batch}-pattern` },
                    file: `batch-${batch}-file-${i % 5}.js`,
                    value: i < batchSize / 2 ? `batch-${batch}-duplicate` : `batch-${batch}-unique-${i}`,
                    confidence: 0.8,
                    severity: 'medium'
                }));

                engine.deduplicateScanFindings(batchFindings);

                // Get real-time observability data
                const observabilityReport = engine.getObservabilityReport();

                expect(observabilityReport.timestamp).toBeDefined();
                expect(observabilityReport.deduplication.stats.operationCount).toBe(batch + 1);
                expect(observabilityReport.monitoring.systemHealth).toBeDefined();

                // Verify configuration is included
                expect(observabilityReport.configuration.options).toBeDefined();
                expect(observabilityReport.configuration.thresholds).toBeDefined();
            }

            // Final verification
            const finalReport = engine.getObservabilityReport();
            expect(finalReport.deduplication.stats.operationCount).toBe(totalBatches);
            expect(finalReport.deduplication.stats.totalFindings).toBe(totalBatches * batchSize);
        });
    });
});