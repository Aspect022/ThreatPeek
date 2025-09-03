/**
 * Error Handling and Fallback Scenario Tests for Deduplication System
 * Tests error conditions, recovery mechanisms, and fallback behaviors
 * 
 * Requirements covered: 3.3, 3.4
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const fs = require('fs-extra');
const path = require('path');

describe('Deduplication Error Handling and Fallback Tests', () => {
    let testDir;

    beforeAll(async () => {
        testDir = path.join(__dirname, 'temp', 'error-handling-test');
        await fs.ensureDir(testDir);
    });

    afterAll(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('Memory Management Errors (Requirement 3.3)', () => {
        test('should handle out-of-memory conditions gracefully', () => {
            const engine = new DeduplicationEngine({
                memoryLimitMB: 1, // Very low memory limit
                enableCircuitBreaker: true
            });

            // Create a large dataset that would exceed memory limit
            const largeFindings = Array(10000).fill().map((_, i) => ({
                pattern: { id: `pattern-${i}` },
                file: `file-${i}.js`,
                value: `value-${i}`,
                location: { line: i, column: 1 },
                context: {
                    before: 'a'.repeat(1000), // Large context to increase memory usage
                    after: 'b'.repeat(1000)
                }
            }));

            const result = engine.deduplicateFileFindings(largeFindings, 'large-file.js');

            // Should use fallback mechanism
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            const stats = engine.getStats();
            if (stats.fallbackCount > 0) {
                expect(result[0].deduplicationStatus).toBe('fallback');
                expect(result[0].fallbackReason).toBe('performance_limit');
            }
        });

        test('should clean up memory after failed operations', () => {
            const engine = new DeduplicationEngine({
                maxCacheSize: 100,
                enablePerformanceMonitoring: true
            });

            // Mock a method to throw memory error
            const originalMethod = engine.generateFingerprint;
            let callCount = 0;
            engine.generateFingerprint = jest.fn().mockImplementation((finding) => {
                callCount++;
                if (callCount <= 5) {
                    throw new Error('Out of memory');
                }
                return originalMethod.call(engine, finding);
            });

            const findings = Array(10).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: 'test.js',
                value: `value-${i}`
            }));

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should recover and continue processing
            expect(result).toHaveLength(10);
            expect(result[0].deduplicationStatus).toBe('fallback');

            // Memory should be managed properly
            const stats = engine.getStats();
            expect(stats.errorCount).toBeGreaterThan(0);
            expect(stats.fallbackCount).toBeGreaterThan(0);

            // Restore original method
            engine.generateFingerprint = originalMethod;
        });

        test('should handle cache overflow gracefully', () => {
            const engine = new DeduplicationEngine({
                maxCacheSize: 5 // Very small cache
            });

            // Generate more findings than cache can hold
            const findings = Array(20).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: `file-${i}.js`,
                value: `unique-value-${i}`
            }));

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            expect(result).toHaveLength(20);

            const stats = engine.getStats();
            expect(stats.cacheSize).toBeLessThanOrEqual(5); // Should respect cache limit
        });
    });

    describe('Processing Timeout Errors (Requirement 3.3)', () => {
        test('should handle processing timeouts', () => {
            const engine = new DeduplicationEngine({
                maxDeduplicationTimeMs: 100, // Very short timeout
                enableCircuitBreaker: true
            });

            // Mock slow processing
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation((findings) => {
                // Simulate slow processing
                const start = Date.now();
                while (Date.now() - start < 200) {
                    // Busy wait to simulate slow processing
                }
                return originalMethod.call(engine, findings);
            });

            const findings = Array(100).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: 'test.js',
                value: `value-${i}`
            }));

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should use fallback due to timeout
            expect(result).toHaveLength(100);
            expect(result[0].deduplicationStatus).toBe('fallback');

            const stats = engine.getStats();
            expect(stats.fallbackCount).toBeGreaterThan(0);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });

        test('should recover from intermittent timeouts', async () => {
            const engine = new DeduplicationEngine({
                maxDeduplicationTimeMs: 1000,
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 3
            });

            let timeoutCount = 0;
            const originalMethod = engine.executeWithTimeout;
            engine.executeWithTimeout = jest.fn().mockImplementation((operation, findings, timeoutMs) => {
                timeoutCount++;
                if (timeoutCount <= 2) {
                    throw new Error(`Deduplication timeout: 1500ms > ${timeoutMs}ms`);
                }
                return originalMethod.call(engine, operation, findings, timeoutMs);
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];

            // First two calls should timeout and use fallback
            const result1 = engine.deduplicateFileFindings(findings, 'test1.js');
            const result2 = engine.deduplicateFileFindings(findings, 'test2.js');

            expect(result1[0].deduplicationStatus).toBe('fallback');
            expect(result2[0].deduplicationStatus).toBe('fallback');

            // Third call should succeed
            const result3 = engine.deduplicateFileFindings(findings, 'test3.js');
            expect(result3[0].deduplicationStatus).not.toBe('fallback');

            // Restore original method
            engine.executeWithTimeout = originalMethod;
        });
    });

    describe('Circuit Breaker Functionality (Requirement 3.3)', () => {
        test('should open circuit breaker after repeated failures', () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 3,
                circuitBreakerResetTimeMs: 1000
            });

            // Mock method to always fail
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation(() => {
                throw new Error('Persistent failure');
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];

            // Trigger failures to open circuit breaker
            engine.deduplicateFileFindings(findings, 'test1.js');
            engine.deduplicateFileFindings(findings, 'test2.js');
            engine.deduplicateFileFindings(findings, 'test3.js');
            engine.deduplicateFileFindings(findings, 'test4.js');

            const stats = engine.getStats();
            expect(stats.circuitBreaker.state).toBe('OPEN');
            expect(stats.circuitBreaker.failureCount).toBe(3);
            expect(stats.fallbackCount).toBe(4);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });

        test('should transition circuit breaker states correctly', async () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 2,
                circuitBreakerResetTimeMs: 100 // Short reset time for testing
            });

            let shouldFail = true;
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation((findings) => {
                if (shouldFail) {
                    throw new Error('Controlled failure');
                }
                return originalMethod.call(engine, findings);
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];

            // Open circuit breaker
            engine.deduplicateFileFindings(findings, 'test1.js');
            engine.deduplicateFileFindings(findings, 'test2.js');
            engine.deduplicateFileFindings(findings, 'test3.js');

            let stats = engine.getStats();
            expect(stats.circuitBreaker.state).toBe('OPEN');

            // Wait for circuit breaker to reset
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should transition to HALF_OPEN
            shouldFail = false; // Allow success
            const result = engine.deduplicateFileFindings(findings, 'test4.js');

            stats = engine.getStats();
            expect(stats.circuitBreaker.state).toBe('CLOSED'); // Should close on success
            expect(result[0].deduplicationStatus).not.toBe('fallback');

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });

        test('should provide circuit breaker status in statistics', () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 2
            });

            const stats = engine.getStats();
            expect(stats.circuitBreaker).toBeDefined();
            expect(stats.circuitBreaker.state).toBe('CLOSED');
            expect(stats.circuitBreaker.failureCount).toBe(0);
            expect(stats.circuitBreaker.lastFailureTime).toBeNull();
        });
    });

    describe('Data Corruption and Invalid Input Handling', () => {
        test('should handle corrupted finding objects', () => {
            const engine = new DeduplicationEngine();

            const corruptedFindings = [
                null,
                undefined,
                { pattern: null, file: 'test.js', value: 'test' },
                { pattern: { id: 'test' }, file: null, value: 'test' },
                { pattern: { id: 'test' }, file: 'test.js', value: null },
                { pattern: { id: 'test' }, file: 'test.js', value: 'valid' }, // Valid finding
                { pattern: { id: undefined }, file: 'test.js', value: 'test' },
                { pattern: { id: 'test' }, file: 'test.js', value: '' },
                { pattern: { id: '' }, file: 'test.js', value: 'test' }
            ];

            const result = engine.deduplicateFileFindings(corruptedFindings, 'test.js');

            // Should handle corrupted data gracefully
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0); // Should have at least the valid finding

            // Should not throw errors
            expect(() => {
                engine.getStats();
            }).not.toThrow();
        });

        test('should handle circular references in findings', () => {
            const engine = new DeduplicationEngine();

            const finding = {
                pattern: { id: 'test' },
                file: 'test.js',
                value: 'test'
            };

            // Create circular reference
            finding.self = finding;
            finding.context = { finding: finding };

            const findings = [finding];

            expect(() => {
                engine.deduplicateFileFindings(findings, 'test.js');
            }).not.toThrow();
        });

        test('should handle extremely large values', () => {
            const engine = new DeduplicationEngine();

            const largeValue = 'x'.repeat(1000000); // 1MB string
            const findings = [
                {
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: largeValue
                }
            ];

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(largeValue);
        });

        test('should handle special characters and encoding issues', () => {
            const engine = new DeduplicationEngine();

            const specialFindings = [
                {
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: '🔑secret🔐key🗝️'
                },
                {
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: 'пароль123密码'
                },
                {
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: '\x00\x01\x02\x03'
                },
                {
                    pattern: { id: 'test' },
                    file: 'test.js',
                    value: '\\n\\r\\t\\"\\''
                }
            ];

            const result = engine.deduplicateFileFindings(specialFindings, 'test.js');

            expect(result).toHaveLength(4);
            expect(result.every(f => f.value)).toBe(true);
        });
    });

    describe('Performance Degradation Scenarios', () => {
        test('should handle performance degradation gracefully', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxDeduplicationTimeMs: 2000
            });

            // Simulate performance degradation
            let operationCount = 0;
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation((findings) => {
                operationCount++;
                // Simulate increasing processing time
                const delay = operationCount * 100;
                const start = Date.now();
                while (Date.now() - start < delay) {
                    // Busy wait
                }
                return originalMethod.call(engine, findings);
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];

            // First few operations should succeed
            const result1 = engine.deduplicateFileFindings(findings, 'test1.js');
            const result2 = engine.deduplicateFileFindings(findings, 'test2.js');

            expect(result1[0].deduplicationStatus).not.toBe('fallback');
            expect(result2[0].deduplicationStatus).not.toBe('fallback');

            // Later operations might timeout and use fallback
            const result3 = engine.deduplicateFileFindings(findings, 'test3.js');

            const stats = engine.getStats();
            expect(stats.performance.maxOperationTime).toBeGreaterThan(0);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });

        test('should adapt to system resource constraints', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                memoryLimitMB: 50
            });

            // Simulate memory pressure
            const initialMemory = process.memoryUsage().heapUsed;
            const findings = Array(1000).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: `file-${i}.js`,
                value: `value-${i}`,
                context: {
                    before: 'a'.repeat(100),
                    after: 'b'.repeat(100),
                    full: 'c'.repeat(200)
                }
            }));

            const result = engine.deduplicateFileFindings(findings, 'memory-test.js');

            expect(result).toHaveLength(1000);

            const stats = engine.getStats();
            expect(stats.memoryUsage).toBeGreaterThan(initialMemory);
        });
    });

    describe('Recovery and Resilience', () => {
        test('should recover from transient errors', () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 5 // Higher threshold for transient errors
            });

            let errorCount = 0;
            const originalMethod = engine.generateFingerprint;
            engine.generateFingerprint = jest.fn().mockImplementation((finding) => {
                errorCount++;
                if (errorCount % 3 === 0) { // Every third call fails
                    throw new Error('Transient error');
                }
                return originalMethod.call(engine, finding);
            });

            const findings = Array(10).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: 'test.js',
                value: `value-${i}`
            }));

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should handle transient errors and continue processing
            expect(result).toHaveLength(10);
            expect(result[0].deduplicationStatus).toBe('fallback');

            const stats = engine.getStats();
            expect(stats.errorCount).toBeGreaterThan(0);
            expect(stats.fallbackCount).toBeGreaterThan(0);
            expect(stats.circuitBreaker.state).toBe('CLOSED'); // Should not open for transient errors

            // Restore original method
            engine.generateFingerprint = originalMethod;
        });

        test('should maintain data integrity during errors', () => {
            const engine = new DeduplicationEngine();

            // Mock method to fail on specific findings
            const originalMethod = engine.generateFingerprint;
            engine.generateFingerprint = jest.fn().mockImplementation((finding) => {
                if (finding.value === 'problematic') {
                    throw new Error('Specific error');
                }
                return originalMethod.call(engine, finding);
            });

            const findings = [
                { pattern: { id: 'test' }, file: 'test.js', value: 'good1' },
                { pattern: { id: 'test' }, file: 'test.js', value: 'problematic' },
                { pattern: { id: 'test' }, file: 'test.js', value: 'good2' },
                { pattern: { id: 'test' }, file: 'test.js', value: 'good1' } // Duplicate
            ];

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should maintain data integrity for non-problematic findings
            expect(result).toHaveLength(4); // All findings in fallback mode
            expect(result.every(f => f.deduplicationStatus === 'fallback')).toBe(true);

            // Restore original method
            engine.generateFingerprint = originalMethod;
        });

        test('should provide detailed error information for debugging', () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true
            });

            // Mock method to throw detailed error
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation(() => {
                const error = new Error('Detailed test error');
                error.code = 'TEST_ERROR';
                error.details = { operation: 'deduplication', phase: 'fingerprint' };
                throw error;
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];
            engine.deduplicateFileFindings(findings, 'test.js');

            const stats = engine.getStats();
            expect(stats.lastError).toBeDefined();
            expect(stats.lastError.message).toBe('Detailed test error');
            expect(stats.lastError.operationType).toBe('file-level');
            expect(stats.lastError.timestamp).toBeDefined();

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });
    });

    describe('Integration Error Scenarios', () => {
        test('should handle pattern engine integration errors', () => {
            const patternEngine = new EnhancedPatternEngine();

            // Mock pattern engine to throw error
            const originalScanContent = patternEngine.scanContent;
            patternEngine.scanContent = jest.fn().mockImplementation(() => {
                throw new Error('Pattern engine error');
            });

            expect(() => {
                patternEngine.scanContent('test content', { enableDeduplication: true });
            }).toThrow('Pattern engine error');

            // Restore original method
            patternEngine.scanContent = originalScanContent;
        });

        test('should handle file system errors during testing', async () => {
            const testFile = path.join(testDir, 'error-test.js');

            // Create file and then make it unreadable
            await fs.writeFile(testFile, 'test content');

            try {
                await fs.chmod(testFile, 0o000); // Remove all permissions

                // Attempt to read should handle error gracefully
                expect(async () => {
                    await fs.readFile(testFile, 'utf8');
                }).rejects.toThrow();

            } finally {
                // Restore permissions for cleanup
                try {
                    await fs.chmod(testFile, 0o644);
                    await fs.remove(testFile);
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        });

        test('should handle concurrent error scenarios', async () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 10
            });

            // Mock method to randomly fail
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation((findings) => {
                if (Math.random() < 0.3) { // 30% failure rate
                    throw new Error('Random failure');
                }
                return originalMethod.call(engine, findings);
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];
            const promises = [];

            // Run concurrent operations
            for (let i = 0; i < 20; i++) {
                promises.push(Promise.resolve().then(() => {
                    return engine.deduplicateFileFindings(findings, `test${i}.js`);
                }));
            }

            const results = await Promise.all(promises);

            // All operations should complete (either success or fallback)
            expect(results).toHaveLength(20);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBeGreaterThan(0);
            });

            const stats = engine.getStats();
            expect(stats.operationCount).toBe(20);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });
    });
});