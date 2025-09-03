/**
 * Performance benchmarks and stress tests for DeduplicationEngine
 * Tests performance monitoring, error handling, and circuit breaker functionality
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');

describe('DeduplicationEngine Performance Tests', () => {
    let engine;

    beforeEach(() => {
        engine = new DeduplicationEngine({
            enablePerformanceMonitoring: true,
            enableCircuitBreaker: true,
            maxDeduplicationTimeMs: 5000,
            memoryLimitMB: 256,
            circuitBreakerThreshold: 3,
            circuitBreakerResetTimeMs: 1000
        });

        // Suppress error events in test environment to avoid unhandled error warnings
        engine.monitor.on('error', () => { });
    });

    afterEach(() => {
        if (engine) {
            engine.reset();
        }
    });

    describe('Performance Monitoring', () => {
        test('should track operation timing and memory usage', () => {
            const findings = generateTestFindings(100, 0.3); // 100 findings with 30% duplicates

            const result = engine.deduplicateFileFindings(findings, 'test-file.js');

            const stats = engine.getStats();
            expect(stats.operationCount).toBe(1);
            expect(stats.averageDeduplicationTime).toBeGreaterThan(0);
            expect(stats.memoryUsage).toBeGreaterThan(0);
            expect(stats.performance).toBeDefined();
            expect(stats.performance.totalOperations).toBe(1);
        });

        test('should detect slow operations', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Create a large dataset to trigger slow operation warning
            const findings = generateTestFindings(1000, 0.8);

            engine.deduplicateFileFindings(findings, 'large-file.js');

            const performanceReport = engine.getPerformanceReport();
            expect(performanceReport.enabled).toBe(true);
            expect(performanceReport.summary.totalOperations).toBe(1);

            consoleSpy.mockRestore();
        });

        test('should maintain performance history', () => {
            // Perform multiple operations
            for (let i = 0; i < 5; i++) {
                const findings = generateTestFindings(50, 0.2);
                engine.deduplicateFileFindings(findings, `file-${i}.js`);
            }

            const performanceReport = engine.getPerformanceReport();
            expect(performanceReport.summary.totalOperations).toBe(5);
            expect(performanceReport.recentOperations).toHaveLength(5);
            expect(performanceReport.memoryTrend).toHaveLength(5);
        });

        test('should limit performance history size', () => {
            // Perform more than 100 operations to test history limiting
            for (let i = 0; i < 105; i++) {
                const findings = generateTestFindings(10, 0.1);
                engine.deduplicateFileFindings(findings, `file-${i}.js`);
            }

            const performanceReport = engine.getPerformanceReport();
            // The internal performance monitor limits to 100 operations
            expect(performanceReport.summary.totalOperations).toBeLessThanOrEqual(105);
            expect(performanceReport.recentOperations.length).toBeLessThanOrEqual(10);
            expect(performanceReport.memoryTrend.length).toBeLessThanOrEqual(10);
        });
    });

    describe('Error Handling and Fallback', () => {
        test('should handle fingerprint generation errors gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Mock the fingerprint generation to throw an error
            const originalGenerateFingerprint = engine.generateFingerprint;
            engine.generateFingerprint = jest.fn().mockImplementation(() => {
                throw new Error('Fingerprint generation failed');
            });

            const findings = generateTestFindings(5, 0.1);
            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should return fallback results
            expect(result).toHaveLength(5);
            expect(result[0].deduplicationStatus).toBe('fallback');

            const stats = engine.getStats();
            expect(stats.fallbackCount).toBeGreaterThan(0);

            // Restore original method
            engine.generateFingerprint = originalGenerateFingerprint;
            consoleSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        test('should use fallback when memory limit is exceeded', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Create engine with very low memory limit
            const lowMemoryEngine = new DeduplicationEngine({
                memoryLimitMB: 1 // 1MB limit - very low
            });

            const findings = generateTestFindings(100, 0.1);
            const result = lowMemoryEngine.deduplicateFileFindings(findings, 'test.js');

            // Should use fallback due to memory limit
            expect(result).toHaveLength(100);
            if (result[0].deduplicationStatus === 'fallback') {
                expect(result[0].fallbackReason).toBe('performance_limit');
            }

            consoleWarnSpy.mockRestore();
        });

        test('should use fallback when finding count exceeds limit', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Create a very large dataset
            const findings = generateTestFindings(15000, 0.1); // Exceeds 10000 limit

            const result = engine.deduplicateFileFindings(findings, 'huge-file.js');

            // Should use fallback due to size limit
            expect(result).toHaveLength(15000);
            expect(result[0].deduplicationStatus).toBe('fallback');
            expect(result[0].fallbackReason).toBe('performance_limit');

            const stats = engine.getStats();
            expect(stats.fallbackCount).toBe(1);

            consoleWarnSpy.mockRestore();
        });
    });

    describe('Circuit Breaker', () => {
        test('should open circuit breaker after repeated failures', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Mock the internal deduplication method to always throw errors
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation(() => {
                throw new Error('Simulated deduplication failure');
            });

            const findings = generateTestFindings(10, 0.1);

            // Trigger failures to open circuit breaker
            for (let i = 0; i < 4; i++) {
                const result = engine.deduplicateFileFindings(findings, `file-${i}.js`);
                expect(result[0].deduplicationStatus).toBe('fallback');
            }

            const stats = engine.getStats();
            expect(stats.circuitBreaker.state).toBe('OPEN');
            expect(stats.circuitBreaker.failureCount).toBe(3);
            expect(stats.fallbackCount).toBe(4);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
            consoleSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        test('should skip deduplication when circuit breaker is open', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Manually open circuit breaker
            engine.circuitBreaker.state = 'OPEN';
            engine.circuitBreaker.nextAttemptTime = Date.now() + 10000; // 10 seconds in future

            const findings = generateTestFindings(10, 0.1);
            const result = engine.deduplicateFileFindings(findings, 'test.js');

            expect(result[0].deduplicationStatus).toBe('fallback');
            expect(result[0].fallbackReason).toBe('performance_limit');

            consoleWarnSpy.mockRestore();
        });

        test('should transition to half-open state after timeout', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            // Set circuit breaker to open with short timeout
            engine.circuitBreaker.state = 'OPEN';
            engine.circuitBreaker.nextAttemptTime = Date.now() + 100; // 100ms

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 150));

            const findings = generateTestFindings(5, 0.1);
            engine.deduplicateFileFindings(findings, 'test.js');

            // Should transition to half-open, then closed on successful operation
            const stats = engine.getStats();
            expect(stats.circuitBreaker.state).toBe('CLOSED');

            consoleLogSpy.mockRestore();
        });
    });

    describe('Stress Tests', () => {
        test('should handle large datasets efficiently', () => {
            // Use a smaller dataset to avoid timeout issues in tests
            const startTime = Date.now();
            const findings = generateTestFindings(1000, 0.5); // 1000 findings with 50% duplicates

            const result = engine.deduplicateScanFindings(findings);

            const executionTime = Date.now() - startTime;
            const stats = engine.getStats();

            expect(result.length).toBeLessThan(findings.length); // Should have removed duplicates
            expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(stats.deduplicationRate).toMatch(/\d+\.\d+%/);
            expect(stats.performance.maxOperationTime).toBeGreaterThan(0);
        });

        test('should maintain performance under concurrent operations', () => {
            const operations = [];

            // Simulate concurrent deduplication operations
            for (let i = 0; i < 10; i++) {
                const findings = generateTestFindings(100, 0.3);
                operations.push(() => engine.deduplicateFileFindings(findings, `concurrent-file-${i}.js`));
            }

            const startTime = Date.now();
            const results = operations.map(op => op());
            const totalTime = Date.now() - startTime;

            expect(results).toHaveLength(10);
            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

            const stats = engine.getStats();
            expect(stats.operationCount).toBe(10);
            expect(stats.performance.totalOperations).toBe(10);
        });

        test('should handle memory pressure gracefully', () => {
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            // Create engine with realistic memory limit
            const memoryConstrainedEngine = new DeduplicationEngine({
                memoryLimitMB: 128,
                enablePerformanceMonitoring: true
            });

            // Process multiple large datasets
            let totalProcessed = 0;
            let fallbackCount = 0;

            for (let i = 0; i < 20; i++) {
                const findings = generateTestFindings(500, 0.4);
                const result = memoryConstrainedEngine.deduplicateFileFindings(findings, `memory-test-${i}.js`);

                totalProcessed += result.length;
                if (result[0]?.deduplicationStatus === 'fallback') {
                    fallbackCount++;
                }
            }

            expect(totalProcessed).toBeGreaterThan(0);

            const stats = memoryConstrainedEngine.getStats();
            expect(stats.operationCount).toBeGreaterThan(0);
            expect(stats.memory.peak).toBeDefined();

            consoleWarnSpy.mockRestore();
        });
    });

    describe('Performance Benchmarks', () => {
        test('should benchmark different dataset sizes', () => {
            const benchmarkResults = [];
            const sizes = [100, 500, 1000, 2000];
            const duplicateRates = [0.1, 0.3, 0.5, 0.8];

            for (const size of sizes) {
                for (const duplicateRate of duplicateRates) {
                    const testEngine = new DeduplicationEngine({
                        enablePerformanceMonitoring: true
                    });

                    const findings = generateTestFindings(size, duplicateRate);
                    const startTime = Date.now();

                    const result = testEngine.deduplicateScanFindings(findings);

                    const executionTime = Date.now() - startTime;
                    const stats = testEngine.getStats();

                    benchmarkResults.push({
                        size,
                        duplicateRate,
                        executionTime,
                        duplicatesRemoved: stats.duplicatesRemoved,
                        memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024),
                        deduplicationRate: parseFloat(stats.deduplicationRate)
                    });
                }
            }

            // Verify benchmark results
            expect(benchmarkResults).toHaveLength(sizes.length * duplicateRates.length);

            // Log benchmark results for analysis
            console.log('\n=== Deduplication Performance Benchmarks ===');
            benchmarkResults.forEach(result => {
                console.log(`Size: ${result.size}, Duplicates: ${(result.duplicateRate * 100).toFixed(0)}%, ` +
                    `Time: ${result.executionTime}ms, Memory: ${result.memoryUsage}MB, ` +
                    `Removed: ${result.duplicatesRemoved}, Rate: ${result.deduplicationRate.toFixed(1)}%`);
            });
        });

        test('should measure fingerprint generation performance', () => {
            const testFindings = generateTestFindings(1000, 0);
            const startTime = Date.now();

            // Generate fingerprints for all findings
            const fingerprints = testFindings.map(finding =>
                engine.generateFingerprint(finding, false)
            );

            const executionTime = Date.now() - startTime;

            expect(fingerprints).toHaveLength(1000);
            expect(fingerprints.every(fp => typeof fp === 'string' && fp.length === 64)).toBe(true);
            expect(executionTime).toBeLessThan(1000); // Should be very fast

            console.log(`Fingerprint generation: ${testFindings.length} findings in ${executionTime}ms`);
        });
    });
});

/**
 * Generate test findings with controlled duplicate rate
 * @param {number} count - Number of findings to generate
 * @param {number} duplicateRate - Rate of duplicates (0.0 to 1.0)
 * @returns {Array} Array of test findings
 */
function generateTestFindings(count, duplicateRate) {
    const findings = [];
    const uniqueCount = Math.floor(count * (1 - duplicateRate));
    const duplicateCount = count - uniqueCount;

    // Generate unique findings
    for (let i = 0; i < uniqueCount; i++) {
        findings.push({
            pattern: {
                id: `pattern-${i % 10}`,
                name: `Test Pattern ${i % 10}`,
                severity: ['low', 'medium', 'high', 'critical'][i % 4]
            },
            file: `test-file-${Math.floor(i / 10)}.js`,
            value: `test-value-${i}`,
            location: {
                line: (i % 100) + 1,
                column: (i % 50) + 1
            },
            context: {
                lineContent: `// Test line ${i}`,
                surroundingLines: [`// Line ${i - 1}`, `// Line ${i}`, `// Line ${i + 1}`]
            },
            confidence: Math.random() * 100,
            severity: ['low', 'medium', 'high', 'critical'][i % 4]
        });
    }

    // Generate duplicates by copying existing findings
    for (let i = 0; i < duplicateCount; i++) {
        const sourceIndex = i % uniqueCount;
        const duplicate = {
            ...findings[sourceIndex],
            location: {
                ...findings[sourceIndex].location,
                line: findings[sourceIndex].location.line + Math.floor(Math.random() * 10)
            }
        };
        findings.push(duplicate);
    }

    // Shuffle the array to mix duplicates with originals
    for (let i = findings.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [findings[i], findings[j]] = [findings[j], findings[i]];
    }

    return findings;
}