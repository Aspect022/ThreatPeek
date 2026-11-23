/**
 * Performance Tests for Large-Scale Deduplication
 * Comprehensive performance benchmarks and stress tests
 * 
 * Requirements covered: 3.1, 3.2
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const fs = require('fs-extra');
const path = require('path');

describe('Deduplication Performance and Stress Tests', () => {
    let testDir;

    beforeAll(async () => {
        testDir = path.join(__dirname, 'temp', 'performance-test');
        await fs.ensureDir(testDir);
    });

    afterAll(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('Large Dataset Performance (Requirement 3.1)', () => {
        test('should handle 10,000 findings efficiently', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxDeduplicationTimeMs: 30000 // 30 seconds max
            });

            const startTime = Date.now();
            const findings = generatePerformanceDataset(10000, 0.3); // 30% duplicates
            const generationTime = Date.now() - startTime;

            const deduplicationStart = Date.now();
            const result = engine.deduplicateScanFindings(findings);
            const deduplicationTime = Date.now() - deduplicationStart;

            const stats = engine.getStats();

            // Performance requirements (Requirement 3.1)
            expect(deduplicationTime).toBeLessThan(30000); // Should complete within 30 seconds
            expect(deduplicationTime).toBeLessThan(findings.length * 5); // Less than 5ms per finding
            expect(result.length).toBeLessThan(findings.length); // Should remove duplicates
            expect(stats.duplicatesRemoved).toBeGreaterThan(0);

            console.log(`Performance Test - 10K findings:`);
            console.log(`  Generation time: ${generationTime}ms`);
            console.log(`  Deduplication time: ${deduplicationTime}ms`);
            console.log(`  Time per finding: ${(deduplicationTime / findings.length).toFixed(2)}ms`);
            console.log(`  Duplicates removed: ${stats.duplicatesRemoved} (${stats.deduplicationRate})`);
            console.log(`  Memory usage: ${Math.round(stats.memoryUsage / 1024 / 1024)}MB`);
        });

        test('should scale linearly with dataset size', () => {
            const sizes = [1000, 2000, 5000, 10000];
            const results = [];

            sizes.forEach(size => {
                const engine = new DeduplicationEngine({
                    enablePerformanceMonitoring: true
                });

                const findings = generatePerformanceDataset(size, 0.25);

                const startTime = Date.now();
                const result = engine.deduplicateScanFindings(findings);
                const endTime = Date.now();

                const stats = engine.getStats();

                results.push({
                    size,
                    time: endTime - startTime,
                    timePerFinding: (endTime - startTime) / size,
                    duplicatesRemoved: stats.duplicatesRemoved,
                    memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024)
                });
            });

            // Verify linear scaling (time per finding should be relatively consistent)
            const timePerFindingValues = results.map(r => r.timePerFinding);
            const maxTime = Math.max(...timePerFindingValues);
            const minTime = Math.min(...timePerFindingValues);

            // Time per finding shouldn't vary by more than 5x
            expect(maxTime / minTime).toBeLessThan(5);

            console.log('\nScaling Performance Results:');
            results.forEach(result => {
                console.log(`  ${result.size} findings: ${result.time}ms (${result.timePerFinding.toFixed(2)}ms/finding, ${result.memoryUsage}MB)`);
            });
        });

        test('should handle high duplicate ratios efficiently', () => {
            const duplicateRates = [0.1, 0.3, 0.5, 0.7, 0.9];
            const results = [];

            duplicateRates.forEach(rate => {
                const engine = new DeduplicationEngine({
                    enablePerformanceMonitoring: true
                });

                const findings = generatePerformanceDataset(5000, rate);

                const startTime = Date.now();
                const result = engine.deduplicateScanFindings(findings);
                const endTime = Date.now();

                const stats = engine.getStats();

                results.push({
                    duplicateRate: rate,
                    originalCount: findings.length,
                    finalCount: result.length,
                    duplicatesRemoved: stats.duplicatesRemoved,
                    time: endTime - startTime,
                    deduplicationRate: stats.deduplicationRate
                });
            });

            // Higher duplicate rates should result in more duplicates removed
            for (let i = 1; i < results.length; i++) {
                expect(results[i].duplicatesRemoved).toBeGreaterThanOrEqual(results[i - 1].duplicatesRemoved);
            }

            console.log('\nDuplicate Rate Performance Results:');
            results.forEach(result => {
                console.log(`  ${(result.duplicateRate * 100).toFixed(0)}% duplicates: ${result.time}ms, removed ${result.duplicatesRemoved}/${result.originalCount} (${result.deduplicationRate})`);
            });
        });

        test('should maintain performance with large cache sizes', () => {
            const cacheSizes = [1000, 5000, 10000, 20000];
            const results = [];

            cacheSizes.forEach(cacheSize => {
                const engine = new DeduplicationEngine({
                    maxCacheSize: cacheSize,
                    enablePerformanceMonitoring: true
                });

                const findings = generatePerformanceDataset(5000, 0.4);

                const startTime = Date.now();
                engine.deduplicateScanFindings(findings);
                const endTime = Date.now();

                const stats = engine.getStats();

                results.push({
                    cacheSize,
                    time: endTime - startTime,
                    actualCacheSize: stats.cacheSize,
                    memoryUsage: Math.round(stats.memoryUsage / 1024 / 1024)
                });
            });

            // Performance shouldn't degrade significantly with larger caches
            const times = results.map(r => r.time);
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);

            expect(maxTime / minTime).toBeLessThan(3); // Less than 3x variation

            console.log('\nCache Size Performance Results:');
            results.forEach(result => {
                console.log(`  Cache ${result.cacheSize}: ${result.time}ms, actual size ${result.actualCacheSize}, memory ${result.memoryUsage}MB`);
            });
        });
    });

    describe('Memory Efficiency Tests (Requirement 3.2)', () => {
        test('should use memory efficiently with large datasets', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxCacheSize: 5000
            });

            const initialMemory = process.memoryUsage().heapUsed;
            const findings = generatePerformanceDataset(10000, 0.5);

            const result = engine.deduplicateScanFindings(findings);

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            const stats = engine.getStats();

            // Memory usage should be reasonable (less than 100MB for 10K findings)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
            expect(stats.memoryUsage).toBeGreaterThan(0);

            // Memory per finding should be reasonable
            const memoryPerFinding = memoryIncrease / findings.length;
            expect(memoryPerFinding).toBeLessThan(10 * 1024); // Less than 10KB per finding

            console.log(`Memory Efficiency Test:`);
            console.log(`  Initial memory: ${Math.round(initialMemory / 1024 / 1024)}MB`);
            console.log(`  Final memory: ${Math.round(finalMemory / 1024 / 1024)}MB`);
            console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
            console.log(`  Memory per finding: ${Math.round(memoryPerFinding)}bytes`);
        });

        test('should manage cache memory efficiently', () => {
            const engine = new DeduplicationEngine({
                maxCacheSize: 1000,
                enablePerformanceMonitoring: true
            });

            // Process multiple batches to test cache eviction
            const batchSize = 2000;
            const batches = 5;

            for (let i = 0; i < batches; i++) {
                const findings = generatePerformanceDataset(batchSize, 0.2);
                engine.deduplicateFileFindings(findings, `batch-${i}.js`);
            }

            const stats = engine.getStats();

            // Cache should not exceed maximum size
            expect(stats.cacheSize).toBeLessThanOrEqual(1000);
            expect(stats.operationCount).toBe(batches);

            console.log(`Cache Management Test:`);
            console.log(`  Processed ${batches} batches of ${batchSize} findings each`);
            console.log(`  Final cache size: ${stats.cacheSize}/1000`);
            console.log(`  Memory usage: ${Math.round(stats.memoryUsage / 1024 / 1024)}MB`);
        });

        test('should handle memory pressure gracefully', () => {
            const engine = new DeduplicationEngine({
                memoryLimitMB: 50, // Low memory limit
                enablePerformanceMonitoring: true
            });

            const findings = generatePerformanceDataset(5000, 0.3);
            const result = engine.deduplicateFileFindings(findings, 'memory-pressure-test.js');

            expect(result).toHaveLength(5000);

            const stats = engine.getStats();

            // Should either complete successfully or use fallback
            if (stats.fallbackCount > 0) {
                expect(result[0].deduplicationStatus).toBe('fallback');
                expect(result[0].fallbackReason).toBe('performance_limit');
            }

            console.log(`Memory Pressure Test:`);
            console.log(`  Fallback count: ${stats.fallbackCount}`);
            console.log(`  Memory usage: ${Math.round(stats.memoryUsage / 1024 / 1024)}MB`);
        });
    });

    describe('Concurrent Performance Tests', () => {
        test('should handle concurrent deduplication operations', async () => {
            const concurrentOperations = 10;
            const findingsPerOperation = 1000;

            const startTime = Date.now();

            const promises = Array(concurrentOperations).fill().map(async (_, index) => {
                const engine = new DeduplicationEngine({
                    enablePerformanceMonitoring: true
                });

                const findings = generatePerformanceDataset(findingsPerOperation, 0.3);

                const operationStart = Date.now();
                const result = engine.deduplicateScanFindings(findings);
                const operationEnd = Date.now();

                return {
                    operationId: index,
                    time: operationEnd - operationStart,
                    resultCount: result.length,
                    stats: engine.getStats()
                };
            });

            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            // All operations should complete successfully
            expect(results).toHaveLength(concurrentOperations);

            const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
            const maxTime = Math.max(...results.map(r => r.time));
            const minTime = Math.min(...results.map(r => r.time));

            // Concurrent operations shouldn't be significantly slower than sequential
            expect(maxTime / minTime).toBeLessThan(5);

            console.log(`Concurrent Performance Test:`);
            console.log(`  ${concurrentOperations} operations with ${findingsPerOperation} findings each`);
            console.log(`  Total time: ${totalTime}ms`);
            console.log(`  Average operation time: ${avgTime.toFixed(2)}ms`);
            console.log(`  Min/Max operation time: ${minTime}ms / ${maxTime}ms`);
        });

        test('should maintain performance under thread contention', async () => {
            const sharedEngine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxCacheSize: 10000
            });

            const operations = 20;
            const promises = [];

            for (let i = 0; i < operations; i++) {
                promises.push(Promise.resolve().then(() => {
                    const findings = generatePerformanceDataset(500, 0.4);
                    const startTime = Date.now();
                    const result = sharedEngine.deduplicateFileFindings(findings, `concurrent-${i}.js`);
                    const endTime = Date.now();

                    return {
                        operationId: i,
                        time: endTime - startTime,
                        resultCount: result.length
                    };
                }));
            }

            const results = await Promise.all(promises);
            const stats = sharedEngine.getStats();

            expect(results).toHaveLength(operations);
            expect(stats.operationCount).toBe(operations);

            const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

            console.log(`Thread Contention Test:`);
            console.log(`  ${operations} operations on shared engine`);
            console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
            console.log(`  Cache size: ${stats.cacheSize}`);
            console.log(`  Total duplicates removed: ${stats.duplicatesRemoved}`);
        });
    });

    describe('Real-World Performance Scenarios', () => {
        test('should handle typical repository scan performance', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true
            });

            // Simulate findings from a typical repository scan
            const findings = [
                // API keys (many duplicates)
                ...Array(50).fill().map(() => ({
                    pattern: { id: 'stripe-api-key' },
                    file: 'config/stripe.js',
                    value: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
                    severity: 'critical',
                    confidence: 0.95
                })),
                // Passwords (some duplicates)
                ...Array(30).fill().map((_, i) => ({
                    pattern: { id: 'hardcoded-password' },
                    file: `file${i % 10}.js`,
                    value: i % 5 === 0 ? 'admin123' : `password${i}`,
                    severity: 'high',
                    confidence: 0.8
                })),
                // GitHub tokens (few duplicates)
                ...Array(20).fill().map((_, i) => ({
                    pattern: { id: 'github-token' },
                    file: `ci/deploy${i}.yml`,
                    value: i % 3 === 0 ? 'ghp_duplicate_token' : `ghp_unique_token_${i}`,
                    severity: 'high',
                    confidence: 0.9
                })),
                // Unique findings
                ...Array(100).fill().map((_, i) => ({
                    pattern: { id: 'aws-access-key' },
                    file: `aws/config${i}.js`,
                    value: `AKIA${i.toString().padStart(16, '0')}`,
                    severity: 'critical',
                    confidence: 0.95
                }))
            ];

            const startTime = Date.now();
            const result = engine.deduplicateScanFindings(findings);
            const endTime = Date.now();

            const stats = engine.getStats();
            const processingTime = endTime - startTime;

            // Should complete quickly for typical repository size
            expect(processingTime).toBeLessThan(5000); // 5 seconds
            expect(result.length).toBeLessThan(findings.length);
            expect(stats.duplicatesRemoved).toBeGreaterThan(0);

            console.log(`Repository Scan Simulation:`);
            console.log(`  Original findings: ${findings.length}`);
            console.log(`  Deduplicated findings: ${result.length}`);
            console.log(`  Processing time: ${processingTime}ms`);
            console.log(`  Duplicates removed: ${stats.duplicatesRemoved} (${stats.deduplicationRate})`);
        });

        test('should handle continuous scanning performance', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxCacheSize: 5000
            });

            const scanRounds = 10;
            const findingsPerRound = 500;
            const times = [];

            for (let round = 0; round < scanRounds; round++) {
                const findings = generatePerformanceDataset(findingsPerRound, 0.3);

                const startTime = Date.now();
                engine.deduplicateFileFindings(findings, `continuous-scan-${round}.js`);
                const endTime = Date.now();

                times.push(endTime - startTime);
            }

            const stats = engine.getStats();
            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);

            // Performance should remain consistent across rounds
            expect(maxTime / minTime).toBeLessThan(3);
            expect(avgTime).toBeLessThan(1000); // Average under 1 second

            console.log(`Continuous Scanning Test:`);
            console.log(`  ${scanRounds} rounds of ${findingsPerRound} findings each`);
            console.log(`  Average time per round: ${avgTime.toFixed(2)}ms`);
            console.log(`  Min/Max time: ${minTime}ms / ${maxTime}ms`);
            console.log(`  Total operations: ${stats.operationCount}`);
            console.log(`  Cache efficiency: ${stats.cacheSize}/${engine.options.maxCacheSize}`);
        });
    });

    describe('Performance Monitoring and Metrics', () => {
        test('should provide detailed performance metrics', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true
            });

            // Perform multiple operations of varying sizes
            const operations = [
                { size: 100, duplicateRate: 0.1 },
                { size: 500, duplicateRate: 0.3 },
                { size: 1000, duplicateRate: 0.5 },
                { size: 200, duplicateRate: 0.7 }
            ];

            operations.forEach((op, index) => {
                const findings = generatePerformanceDataset(op.size, op.duplicateRate);
                engine.deduplicateFileFindings(findings, `metrics-test-${index}.js`);
            });

            const stats = engine.getStats();
            const performanceReport = engine.getPerformanceReport();

            // Should have comprehensive performance data
            expect(stats.performance).toBeDefined();
            expect(stats.performance.totalOperations).toBe(4);
            expect(stats.performance.maxOperationTime).toBeGreaterThan(0);
            expect(stats.averageDeduplicationTime).toBeGreaterThan(0);

            expect(performanceReport.enabled).toBe(true);
            expect(performanceReport.summary.totalOperations).toBe(4);
            expect(performanceReport.recentOperations).toHaveLength(4);
            expect(performanceReport.memoryTrend).toHaveLength(4);

            console.log(`Performance Metrics Test:`);
            console.log(`  Total operations: ${stats.performance.totalOperations}`);
            console.log(`  Average time: ${stats.averageDeduplicationTime.toFixed(2)}ms`);
            console.log(`  Max operation time: ${stats.performance.maxOperationTime}ms`);
            console.log(`  Peak memory: ${Math.round(stats.peakMemoryUsage / 1024 / 1024)}MB`);
        });

        test('should track performance trends over time', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true
            });

            const measurements = [];

            // Perform operations with increasing complexity
            for (let i = 1; i <= 10; i++) {
                const findings = generatePerformanceDataset(i * 100, 0.3);

                const startTime = Date.now();
                engine.deduplicateFileFindings(findings, `trend-test-${i}.js`);
                const endTime = Date.now();

                measurements.push({
                    operation: i,
                    size: i * 100,
                    time: endTime - startTime
                });
            }

            const performanceReport = engine.getPerformanceReport();

            // Should show performance trend
            expect(performanceReport.recentOperations).toHaveLength(10);
            expect(performanceReport.memoryTrend).toHaveLength(10);

            // Performance should scale reasonably
            const firstTime = measurements[0].time;
            const lastTime = measurements[measurements.length - 1].time;
            const sizeRatio = measurements[measurements.length - 1].size / measurements[0].size;
            const timeRatio = lastTime / firstTime;

            // Time ratio should not be much larger than size ratio (indicating good scaling)
            expect(timeRatio).toBeLessThan(sizeRatio * 2);

            console.log(`Performance Trend Test:`);
            console.log(`  Size ratio: ${sizeRatio}x`);
            console.log(`  Time ratio: ${timeRatio.toFixed(2)}x`);
            console.log(`  Scaling efficiency: ${(sizeRatio / timeRatio).toFixed(2)}`);
        });
    });
});

/**
 * Generate performance test dataset with controlled characteristics
 * @param {number} count - Number of findings to generate
 * @param {number} duplicateRate - Rate of duplicates (0.0 to 1.0)
 * @returns {Array} Array of test findings
 */
function generatePerformanceDataset(count, duplicateRate) {
    const findings = [];
    const uniqueCount = Math.floor(count * (1 - duplicateRate));
    const duplicateCount = count - uniqueCount;

    // Pattern types for realistic distribution
    const patternTypes = [
        { id: 'api-key', weight: 0.3, severity: 'critical' },
        { id: 'password', weight: 0.25, severity: 'high' },
        { id: 'token', weight: 0.2, severity: 'high' },
        { id: 'secret', weight: 0.15, severity: 'medium' },
        { id: 'credential', weight: 0.1, severity: 'low' }
    ];

    // Generate unique findings
    for (let i = 0; i < uniqueCount; i++) {
        const patternType = selectWeightedPattern(patternTypes);

        findings.push({
            pattern: {
                id: patternType.id,
                name: `${patternType.id.charAt(0).toUpperCase() + patternType.id.slice(1)} Pattern`,
                severity: patternType.severity
            },
            file: `file-${Math.floor(i / 50)}.js`,
            value: `${patternType.id}-value-${i}`,
            location: {
                line: (i % 1000) + 1,
                column: (i % 100) + 1
            },
            context: {
                before: `context_before_${i}`,
                after: `context_after_${i}`,
                full: `full_context_line_${i}`
            },
            confidence: 0.5 + (Math.random() * 0.5), // 0.5 to 1.0
            severity: patternType.severity,
            timestamp: Date.now() - (Math.random() * 86400000) // Random time in last 24h
        });
    }

    // Generate duplicates by copying existing findings with variations
    for (let i = 0; i < duplicateCount; i++) {
        const sourceIndex = Math.floor(Math.random() * uniqueCount);
        const source = findings[sourceIndex];

        const duplicate = {
            ...source,
            file: `duplicate-file-${Math.floor(i / 10)}.js`,
            location: {
                line: source.location.line + Math.floor(Math.random() * 100),
                column: source.location.column + Math.floor(Math.random() * 50)
            },
            context: {
                before: `duplicate_context_before_${i}`,
                after: `duplicate_context_after_${i}`,
                full: `duplicate_full_context_line_${i}`
            },
            confidence: source.confidence + (Math.random() * 0.2 - 0.1), // Slight variation
            timestamp: Date.now() - (Math.random() * 86400000)
        };

        findings.push(duplicate);
    }

    // Shuffle array to mix duplicates with originals
    for (let i = findings.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [findings[i], findings[j]] = [findings[j], findings[i]];
    }

    return findings;
}

/**
 * Select pattern type based on weights
 * @param {Array} patterns - Array of pattern types with weights
 * @returns {Object} Selected pattern type
 */
function selectWeightedPattern(patterns) {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const pattern of patterns) {
        cumulativeWeight += pattern.weight;
        if (random <= cumulativeWeight) {
            return pattern;
        }
    }

    return patterns[patterns.length - 1]; // Fallback
}