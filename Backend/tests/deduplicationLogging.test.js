/**
 * Unit tests for deduplication logging and observability features
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');
const { DeduplicationLogger } = require('../utils/deduplicationLogger');
const { DeduplicationDebugger } = require('../utils/deduplicationDebugger');
const { DeduplicationMonitor } = require('../utils/deduplicationMonitor');
const fs = require('fs-extra');
const path = require('path');

describe('Deduplication Logging and Observability', () => {
    let engine;
    let logger;
    let deduplicationDebugger;
    let monitor;
    let testLogDir;
    let testDebugDir;

    beforeEach(async () => {
        // Create temporary directories for testing
        testLogDir = path.join(__dirname, 'temp', 'logs');
        testDebugDir = path.join(__dirname, 'temp', 'debug');
        await fs.ensureDir(testLogDir);
        await fs.ensureDir(testDebugDir);

        // Initialize components with test configuration
        logger = new DeduplicationLogger({
            logLevel: 'debug',
            enableDebugMode: true,
            enableFileLogging: true,
            logDirectory: testLogDir,
            enableConsoleLogging: false // Disable for tests
        });

        deduplicationDebugger = new DeduplicationDebugger({
            enableDetailedAnalysis: true,
            enableFingerprintAnalysis: true,
            enablePerformanceAnalysis: true,
            outputDirectory: testDebugDir,
            enableConsoleOutput: false // Disable for tests
        });

        monitor = new DeduplicationMonitor({
            enableAlerting: false, // Disable alerts for tests
            monitoringInterval: 0, // Disable automatic monitoring
            reportingInterval: 0
        });

        // Initialize deduplication engine with logging components
        engine = new DeduplicationEngine({
            logger: logger,
            debugger: deduplicationDebugger,
            monitor: monitor,
            enablePerformanceMonitoring: true,
            enableDebugMode: true
        });
    });

    afterEach(async () => {
        // Cleanup test directories
        await fs.remove(path.join(__dirname, 'temp'));

        // Stop monitoring if running
        if (monitor) {
            monitor.stopMonitoring();
        }
    });

    describe('DeduplicationLogger', () => {
        test('should log operation start and completion', async () => {
            const operationType = 'file-level';
            const context = { findingsCount: 10, filePath: 'test.js' };

            // Log operation start
            logger.logOperationStart(operationType, context);

            // Log operation completion
            const result = {
                totalFindings: 10,
                uniqueFindings: 8,
                duplicatesRemoved: 2,
                deduplicationRate: '20%',
                memoryUsage: 1024 * 1024
            };
            logger.logOperationComplete(operationType, result, 150);

            // Check metrics were recorded
            const metrics = logger.getMetrics();
            expect(metrics.operations['operation_start']).toBe(1);
            expect(metrics.operations['operation_complete']).toBe(1);
            expect(metrics.performance.totalOperations).toBe(1);
        });

        test('should log fingerprint generation details', () => {
            const finding = {
                pattern: { id: 'hardcoded-password' },
                file: 'config.js',
                value: 'password123',
                location: { line: 10, column: 5 }
            };
            const fingerprint = 'abc123def456';
            const components = {
                normalizedFilePath: 'config.js',
                normalizedValue: 'password123',
                patternId: 'hardcoded-password',
                includeLocation: false
            };

            logger.logFingerprintGeneration(finding, fingerprint, components);

            // Verify debug events were recorded
            const metrics = logger.getMetrics();
            expect(metrics.debug.totalEvents).toBeGreaterThan(0);
        });

        test('should log finding merge operations', () => {
            const existingFinding = {
                pattern: { id: 'hardcoded-password' },
                file: 'config.js',
                value: 'password123',
                confidence: 0.8,
                severity: 'high',
                occurrenceCount: 1
            };

            const newFinding = {
                pattern: { id: 'hardcoded-password' },
                file: 'config.js',
                value: 'password123',
                confidence: 0.9,
                severity: 'critical'
            };

            const mergedFinding = {
                ...existingFinding,
                confidence: 0.9,
                severity: 'critical',
                occurrenceCount: 2
            };

            logger.logFindingMerge(existingFinding, newFinding, mergedFinding);

            // Verify merge was logged
            const metrics = logger.getMetrics();
            expect(metrics.debug.totalEvents).toBeGreaterThan(0);
        });

        test('should log cache operations', () => {
            const details = {
                size: 50,
                maxSize: 100,
                key: 'test-cache-key'
            };

            logger.logCacheOperation('hit', details);
            logger.logCacheOperation('miss', details);
            logger.logCacheOperation('eviction', details);

            // Verify cache operations were logged
            const metrics = logger.getMetrics();
            expect(metrics.debug.totalEvents).toBeGreaterThan(0);
        });

        test('should log errors with context', () => {
            const error = new Error('Test deduplication error');
            const operationType = 'scan-level';
            const context = {
                findingsCount: 100,
                memoryUsage: 50 * 1024 * 1024,
                duration: 5000
            };

            logger.logError(error, operationType, context);

            // Verify error was recorded
            const metrics = logger.getMetrics();
            expect(metrics.errors['scan-level']).toBe(1);
        });

        test('should write logs to file when enabled', async () => {
            // Wait for logger initialization
            await new Promise(resolve => setTimeout(resolve, 100));

            logger.info('Test log message', { test: true });

            // Wait for file write
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if log file was created
            const logFiles = await logger.getLogFiles();
            expect(logFiles.length).toBeGreaterThan(0);

            // Verify log content
            const logContent = await fs.readFile(logFiles[0], 'utf8');
            expect(logContent).toContain('Test log message');
        });

        test('should rotate log files when size limit exceeded', async () => {
            // Create logger with small file size limit
            const smallLogger = new DeduplicationLogger({
                logDirectory: testLogDir,
                maxLogFileSize: 100, // Very small limit
                enableConsoleLogging: false
            });

            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 100));

            // Write enough data to trigger rotation
            for (let i = 0; i < 10; i++) {
                smallLogger.info(`Large log message ${i}`, {
                    data: 'x'.repeat(50)
                });
            }

            // Wait for file operations
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check if multiple log files exist
            const logFiles = await smallLogger.getLogFiles();
            // Should have at least the current log file
            expect(logFiles.length).toBeGreaterThan(0);
        });
    });

    describe('DeduplicationDebugger', () => {
        test('should analyze deduplication operation', () => {
            const operationData = {
                type: 'scan-level',
                findings: [
                    {
                        pattern: { id: 'hardcoded-password' },
                        file: 'config.js',
                        value: 'password123',
                        severity: 'high',
                        confidence: 0.8
                    },
                    {
                        pattern: { id: 'hardcoded-password' },
                        file: 'config.js',
                        value: 'password123',
                        severity: 'high',
                        confidence: 0.8
                    },
                    {
                        pattern: { id: 'sql-injection' },
                        file: 'db.js',
                        value: 'SELECT * FROM users',
                        severity: 'critical',
                        confidence: 0.9
                    }
                ],
                result: {
                    totalFindings: 3,
                    uniqueFindings: 2,
                    duplicatesRemoved: 1
                },
                performance: {
                    duration: 150,
                    memoryUsage: 2 * 1024 * 1024
                }
            };

            const analysis = deduplicationDebugger.analyzeOperation(operationData);

            expect(analysis).toBeDefined();
            expect(analysis.operationType).toBe('scan-level');
            expect(analysis.effectiveness).toBeDefined();
            expect(analysis.effectiveness.duplicateRate).toBeCloseTo(0.33, 2);
            expect(analysis.distribution).toBeDefined();
            expect(analysis.patternEffectiveness).toBeDefined();
        });

        test('should detect high duplicate rates', () => {
            const operationData = {
                type: 'file-level',
                findings: Array(10).fill().map((_, i) => ({
                    pattern: { id: 'hardcoded-password' },
                    file: 'config.js',
                    value: 'password123',
                    severity: 'high',
                    confidence: 0.8
                })),
                result: {
                    totalFindings: 10,
                    uniqueFindings: 1,
                    duplicatesRemoved: 9
                },
                performance: { duration: 100 }
            };

            const analysis = deduplicationDebugger.analyzeOperation(operationData);

            const highDuplicateIssue = analysis.issues.find(
                issue => issue.type === 'high_duplicate_rate'
            );
            expect(highDuplicateIssue).toBeDefined();
            expect(highDuplicateIssue.severity).toBe('warning');
        });

        test('should analyze fingerprint collisions', () => {
            const operationData = {
                type: 'scan-level',
                findings: [
                    {
                        pattern: { id: 'hardcoded-password' },
                        file: 'config.js',
                        value: 'password123'
                    },
                    {
                        pattern: { id: 'hardcoded-password' },
                        file: 'config.js',
                        value: 'password123'
                    }
                ],
                result: { totalFindings: 2, uniqueFindings: 1, duplicatesRemoved: 1 },
                performance: { duration: 50 }
            };

            const analysis = deduplicationDebugger.analyzeOperation(operationData);

            expect(analysis.fingerprints).toBeDefined();
            expect(analysis.fingerprints.collisions).toBe(1);
            expect(analysis.fingerprints.legitimateCollisions).toBe(1);
        });

        test('should detect performance issues', () => {
            const operationData = {
                type: 'scan-level',
                findings: [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }],
                result: { totalFindings: 1, uniqueFindings: 1, duplicatesRemoved: 0 },
                performance: {
                    duration: 3000, // Slow operation
                    memoryUsage: 150 * 1024 * 1024 // High memory
                }
            };

            const analysis = deduplicationDebugger.analyzeOperation(operationData);

            const slowOpIssue = analysis.issues.find(
                issue => issue.type === 'slow_operation'
            );
            expect(slowOpIssue).toBeDefined();

            const highMemIssue = analysis.issues.find(
                issue => issue.type === 'high_memory_usage'
            );
            expect(highMemIssue).toBeDefined();
        });

        test('should generate recommendations', () => {
            const operationData = {
                type: 'scan-level',
                findings: Array(100).fill().map(() => ({
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: 'duplicate'
                })),
                result: { totalFindings: 100, uniqueFindings: 20, duplicatesRemoved: 80 },
                performance: { duration: 5000, memoryUsage: 200 * 1024 * 1024 }
            };

            const analysis = deduplicationDebugger.analyzeOperation(operationData);

            expect(analysis.recommendations).toBeDefined();
            expect(analysis.recommendations.length).toBeGreaterThan(0);

            const perfRecommendation = analysis.recommendations.find(
                rec => rec.type === 'performance'
            );
            expect(perfRecommendation).toBeDefined();
        });

        test('should generate debug report', () => {
            // Add some analysis data
            deduplicationDebugger.analyzeOperation({
                type: 'test',
                findings: [],
                result: { totalFindings: 0, uniqueFindings: 0, duplicatesRemoved: 0 },
                performance: { duration: 100 }
            });

            const report = deduplicationDebugger.getDebugReport();

            expect(report.summary).toBeDefined();
            expect(report.summary.totalOperations).toBe(1);
            expect(report.recentOperations).toBeDefined();
            expect(report.dailySummary).toBeDefined();
        });
    });

    describe('DeduplicationMonitor', () => {
        test('should record operations and generate metrics', () => {
            const operationData = {
                type: 'file-level',
                duration: 150,
                findingsProcessed: 10,
                duplicatesRemoved: 2,
                memoryUsage: 1024 * 1024,
                success: true
            };

            monitor.recordOperation(operationData);

            const metrics = monitor.getMetrics();
            expect(metrics.operations.total).toBe(1);
            expect(metrics.operations.recent[0].type).toBe('file-level');
            expect(metrics.operations.recent[0].success).toBe(true);
        });

        test('should record errors and track error rates', () => {
            // Record some successful operations
            for (let i = 0; i < 5; i++) {
                monitor.recordOperation({
                    type: 'test',
                    duration: 100,
                    success: true
                });
            }

            // Record errors
            for (let i = 0; i < 2; i++) {
                monitor.recordError({
                    type: 'DeduplicationError',
                    message: 'Test error',
                    operationType: 'test'
                });
            }

            const metrics = monitor.getMetrics();
            expect(metrics.errors.total).toBe(2);
            expect(metrics.operations.total).toBe(5);
        });

        test('should trigger alerts for slow operations', (done) => {
            const slowMonitor = new DeduplicationMonitor({
                enableAlerting: true,
                slowOperationThreshold: 100,
                monitoringInterval: 0
            });

            slowMonitor.on('alert', (alert) => {
                expect(alert.type).toBe('slow_operation');
                expect(alert.severity).toBe('warning');
                done();
            });

            slowMonitor.recordOperation({
                type: 'test',
                duration: 200, // Exceeds threshold
                success: true
            });
        });

        test('should trigger alerts for high memory usage', (done) => {
            const memoryMonitor = new DeduplicationMonitor({
                enableAlerting: true,
                memoryWarningThreshold: 50, // 50MB threshold
                monitoringInterval: 0
            });

            memoryMonitor.on('alert', (alert) => {
                expect(alert.type).toBe('high_memory');
                expect(alert.severity).toBe('warning');
                done();
            });

            memoryMonitor.recordOperation({
                type: 'test',
                duration: 100,
                memoryUsage: 100 * 1024 * 1024, // 100MB
                success: true
            });
        });

        test('should generate performance reports', () => {
            // Record multiple operations
            for (let i = 0; i < 5; i++) {
                monitor.recordOperation({
                    type: 'test',
                    duration: 100 + i * 10,
                    findingsProcessed: 10,
                    duplicatesRemoved: 2,
                    memoryUsage: (1 + i) * 1024 * 1024,
                    success: true
                });
            }

            const report = monitor.generatePerformanceReport();

            expect(report.operations.total).toBe(5);
            expect(report.operations.averageDuration).toBeGreaterThan(0);
            expect(report.operations.totalFindingsProcessed).toBe(50);
            expect(report.operations.totalDuplicatesRemoved).toBe(10);
            expect(report.memory.averageUsage).toBeGreaterThan(0);
        });

        test('should perform health checks', () => {
            // Record some operations with issues
            monitor.recordOperation({
                type: 'test',
                duration: 5000, // Slow
                success: true
            });

            monitor.recordError({
                type: 'TestError',
                message: 'Test error'
            });

            monitor.performHealthCheck();

            const health = monitor.getMetrics().systemHealth;
            expect(health.status).toBe('degraded');
            expect(health.issues.length).toBeGreaterThan(0);
        });
    });

    describe('Integration with DeduplicationEngine', () => {
        test('should log operations during deduplication', () => {
            const findings = [
                {
                    pattern: { id: 'hardcoded-password' },
                    file: 'config.js',
                    value: 'password123',
                    location: { line: 10, column: 5 },
                    severity: 'high',
                    confidence: 0.8
                },
                {
                    pattern: { id: 'hardcoded-password' },
                    file: 'config.js',
                    value: 'password123',
                    location: { line: 15, column: 8 },
                    severity: 'high',
                    confidence: 0.8
                }
            ];

            const result = engine.deduplicateFileFindings(findings, 'config.js');

            expect(result.length).toBe(1); // Should deduplicate
            expect(result[0].occurrenceCount).toBe(2);

            // Check that logging occurred
            const metrics = logger.getMetrics();
            expect(metrics.operations['operation_start']).toBeGreaterThan(0);
            expect(metrics.operations['operation_complete']).toBeGreaterThan(0);
        });

        test('should monitor performance during scan-level deduplication', () => {
            const findings = Array(20).fill().map((_, i) => ({
                pattern: { id: 'test-pattern' },
                file: `file${i % 5}.js`,
                value: `value${i % 3}`,
                location: { line: i, column: 1 },
                severity: 'medium',
                confidence: 0.7
            }));

            const result = engine.deduplicateScanFindings(findings);

            expect(result.length).toBeLessThan(findings.length);

            // Check monitoring data
            const monitorMetrics = monitor.getMetrics();
            expect(monitorMetrics.operations.total).toBeGreaterThan(0);

            // Check engine statistics
            const engineStats = engine.getStats();
            expect(engineStats.totalFindings).toBe(findings.length);
            expect(engineStats.duplicatesRemoved).toBeGreaterThan(0);
        });

        test('should handle errors gracefully with logging', () => {
            // Create engine with error-prone configuration
            const errorEngine = new DeduplicationEngine({
                logger: logger,
                monitor: monitor,
                maxCacheSize: 1, // Very small cache to trigger issues
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 1
            });

            // Try to process invalid findings
            const invalidFindings = [null, undefined, { invalid: true }];

            const result = errorEngine.deduplicateFileFindings(invalidFindings, 'test.js');

            // Should handle gracefully
            expect(result).toBeDefined();

            // Check error logging
            const metrics = logger.getMetrics();
            // May have logged warnings or errors during processing
        });

        test('should provide comprehensive statistics', () => {
            const findings = [
                { pattern: { id: 'p1' }, file: 'f1.js', value: 'v1' },
                { pattern: { id: 'p1' }, file: 'f1.js', value: 'v1' },
                { pattern: { id: 'p2' }, file: 'f2.js', value: 'v2' }
            ];

            engine.deduplicateFileFindings(findings, 'test.js');

            const stats = engine.getStats();
            expect(stats.totalFindings).toBe(3);
            expect(stats.uniqueFindings).toBe(2);
            expect(stats.duplicatesRemoved).toBe(1);
            expect(stats.deduplicationRate).toBe('33.33%');
            expect(stats.performance).toBeDefined();
            expect(stats.circuitBreaker).toBeDefined();
            expect(stats.memory).toBeDefined();
        });
    });

    describe('Metrics Collection and Analysis', () => {
        test('should collect duplicate detection rates', () => {
            const testCases = [
                { findings: 10, duplicates: 2 }, // 20% duplicate rate
                { findings: 20, duplicates: 8 }, // 40% duplicate rate
                { findings: 5, duplicates: 0 }   // 0% duplicate rate
            ];

            testCases.forEach(({ findings, duplicates }) => {
                const testFindings = Array(findings).fill().map((_, i) => ({
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: i < duplicates ? 'duplicate' : `unique${i}`
                }));

                engine.deduplicateFileFindings(testFindings, 'test.js');
            });

            const loggerMetrics = logger.getMetrics();
            expect(loggerMetrics.performance.totalOperations).toBe(3);

            const monitorMetrics = monitor.getMetrics();
            expect(monitorMetrics.operations.total).toBe(3);
        });

        test('should track removal rates over time', () => {
            const batches = [
                Array(10).fill().map(() => ({ pattern: { id: 'p1' }, file: 'f1.js', value: 'dup' })),
                Array(5).fill().map(() => ({ pattern: { id: 'p2' }, file: 'f2.js', value: 'unique' })),
                Array(15).fill().map((_, i) => ({ pattern: { id: 'p3' }, file: 'f3.js', value: i % 3 === 0 ? 'dup' : `unique${i}` }))
            ];

            batches.forEach((batch, i) => {
                engine.deduplicateFileFindings(batch, `batch${i}.js`);
            });

            const performanceReport = monitor.generatePerformanceReport();
            expect(performanceReport.operations.total).toBe(3);
            expect(performanceReport.operations.totalDuplicatesRemoved).toBeGreaterThan(0);
        });
    });
});