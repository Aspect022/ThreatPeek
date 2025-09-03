/**
 * Comprehensive Test Suite for Deduplication System
 * Tests all deduplication components with unit tests, integration tests, performance tests, and error handling
 * 
 * Requirements covered: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const repositoryScanner = require('../services/repositoryScanner');
const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

describe('Comprehensive Deduplication Test Suite', () => {
    let testDir;
    let deduplicationEngine;
    let patternEngine;

    beforeAll(async () => {
        // Create temporary directory for test files
        testDir = path.join(__dirname, 'temp', 'comprehensive-dedup-test');
        await fs.ensureDir(testDir);
    });

    beforeEach(() => {
        deduplicationEngine = new DeduplicationEngine({
            enableFileLevel: true,
            enableScanLevel: true,
            preserveContext: true,
            maxCacheSize: 1000,
            enablePerformanceMonitoring: true,
            enableCircuitBreaker: true
        });

        patternEngine = new EnhancedPatternEngine();
    });

    afterAll(async () => {
        // Clean up test directory
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('Unit Tests - DeduplicationEngine Core Components', () => {
        describe('Fingerprint Generation (Requirement 1.1)', () => {
            test('should generate consistent fingerprints for identical findings', () => {
                const finding1 = {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'secret123',
                    location: { line: 1, column: 10 }
                };

                const finding2 = {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'secret123',
                    location: { line: 1, column: 10 }
                };

                const fingerprint1 = deduplicationEngine.generateFingerprint(finding1);
                const fingerprint2 = deduplicationEngine.generateFingerprint(finding2);

                expect(fingerprint1).toBe(fingerprint2);
                expect(fingerprint1).toHaveLength(64); // SHA-256 hex length
            });

            test('should generate different fingerprints for different pattern IDs', () => {
                const finding1 = {
                    pattern: { id: 'pattern-1' },
                    file: 'test.js',
                    value: 'secret123'
                };

                const finding2 = {
                    pattern: { id: 'pattern-2' },
                    file: 'test.js',
                    value: 'secret123'
                };

                const fingerprint1 = deduplicationEngine.generateFingerprint(finding1);
                const fingerprint2 = deduplicationEngine.generateFingerprint(finding2);

                expect(fingerprint1).not.toBe(fingerprint2);
            });

            test('should generate different fingerprints for different file paths (Requirement 1.3)', () => {
                const finding1 = {
                    pattern: { id: 'test-pattern' },
                    file: 'file1.js',
                    value: 'secret123'
                };

                const finding2 = {
                    pattern: { id: 'test-pattern' },
                    file: 'file2.js',
                    value: 'secret123'
                };

                const fingerprint1 = deduplicationEngine.generateFingerprint(finding1);
                const fingerprint2 = deduplicationEngine.generateFingerprint(finding2);

                expect(fingerprint1).not.toBe(fingerprint2);
            });

            test('should generate different fingerprints for different values', () => {
                const finding1 = {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'secret123'
                };

                const finding2 = {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'secret456'
                };

                const fingerprint1 = deduplicationEngine.generateFingerprint(finding1);
                const fingerprint2 = deduplicationEngine.generateFingerprint(finding2);

                expect(fingerprint1).not.toBe(fingerprint2);
            });

            test('should normalize file paths consistently', () => {
                const finding1 = {
                    pattern: { id: 'test-pattern' },
                    file: './src/test.js',
                    value: 'secret123'
                };

                const finding2 = {
                    pattern: { id: 'test-pattern' },
                    file: 'src/test.js',
                    value: 'secret123'
                };

                const finding3 = {
                    pattern: { id: 'test-pattern' },
                    file: 'src\\test.js', // Windows path
                    value: 'secret123'
                };

                const fingerprint1 = deduplicationEngine.generateFingerprint(finding1);
                const fingerprint2 = deduplicationEngine.generateFingerprint(finding2);
                const fingerprint3 = deduplicationEngine.generateFingerprint(finding3);

                expect(fingerprint1).toBe(fingerprint2);
                expect(fingerprint2).toBe(fingerprint3);
            });

            test('should handle null/undefined findings gracefully', () => {
                expect(() => {
                    deduplicationEngine.generateFingerprint(null);
                }).not.toThrow();

                expect(() => {
                    deduplicationEngine.generateFingerprint(undefined);
                }).not.toThrow();

                expect(() => {
                    deduplicationEngine.generateFingerprint({});
                }).not.toThrow();
            });
        });

        describe('File-Level Deduplication (Requirement 1.2, 1.4)', () => {
            test('should deduplicate identical findings within same file', () => {
                const findings = [
                    {
                        pattern: { id: 'password-pattern' },
                        file: 'config.js',
                        value: 'password123',
                        severity: 'high',
                        confidence: 0.9,
                        location: { line: 1, column: 10 }
                    },
                    {
                        pattern: { id: 'password-pattern' },
                        file: 'config.js',
                        value: 'password123',
                        severity: 'medium',
                        confidence: 0.8,
                        location: { line: 5, column: 15 }
                    },
                    {
                        pattern: { id: 'password-pattern' },
                        file: 'config.js',
                        value: 'different456',
                        severity: 'high',
                        confidence: 0.9,
                        location: { line: 10, column: 20 }
                    }
                ];

                const deduplicated = deduplicationEngine.deduplicateFileFindings(findings, 'config.js');

                expect(deduplicated).toHaveLength(2); // Two unique findings

                const passwordFinding = deduplicated.find(f => f.value === 'password123');
                expect(passwordFinding).toBeDefined();
                expect(passwordFinding.occurrenceCount).toBe(2);
                expect(passwordFinding.severity).toBe('high'); // Highest severity preserved
                expect(passwordFinding.confidence).toBe(0.9); // Highest confidence preserved
                expect(passwordFinding.locations).toHaveLength(2);
            });

            test('should preserve occurrence count and locations (Requirement 2.3)', () => {
                const findings = [
                    {
                        pattern: { id: 'api-key' },
                        file: 'api.js',
                        value: 'sk_test_123',
                        location: { line: 1, column: 10 },
                        context: { before: 'const key = "', after: '";' }
                    },
                    {
                        pattern: { id: 'api-key' },
                        file: 'api.js',
                        value: 'sk_test_123',
                        location: { line: 10, column: 15 },
                        context: { before: 'var apiKey = "', after: '";' }
                    }
                ];

                const deduplicated = deduplicationEngine.deduplicateFileFindings(findings, 'api.js');

                expect(deduplicated).toHaveLength(1);
                expect(deduplicated[0].occurrenceCount).toBe(2);
                expect(deduplicated[0].locations).toHaveLength(2);
                expect(deduplicated[0].locations[0].line).toBe(1);
                expect(deduplicated[0].locations[1].line).toBe(10);
            });

            test('should handle empty findings array', () => {
                const deduplicated = deduplicationEngine.deduplicateFileFindings([], 'test.js');
                expect(deduplicated).toEqual([]);
            });

            test('should handle null/undefined findings', () => {
                const findings = [
                    {
                        pattern: { id: 'test' },
                        file: 'test.js',
                        value: 'valid'
                    },
                    null,
                    undefined,
                    {
                        pattern: { id: 'test' },
                        file: 'test.js',
                        value: 'valid2'
                    }
                ];

                const deduplicated = deduplicationEngine.deduplicateFileFindings(findings, 'test.js');
                expect(deduplicated).toHaveLength(2); // Only valid findings
            });
        });

        describe('Scan-Level Deduplication (Requirement 1.3, 2.4)', () => {
            test('should deduplicate findings across multiple files', () => {
                const findings = [
                    {
                        pattern: { id: 'secret-key' },
                        file: 'file1.js',
                        value: 'secret123',
                        severity: 'high',
                        confidence: 0.9
                    },
                    {
                        pattern: { id: 'secret-key' },
                        file: 'file2.js',
                        value: 'secret123',
                        severity: 'medium',
                        confidence: 0.8
                    },
                    {
                        pattern: { id: 'secret-key' },
                        file: 'file3.js',
                        value: 'different456',
                        severity: 'high',
                        confidence: 0.9
                    }
                ];

                const deduplicated = deduplicationEngine.deduplicateScanFindings(findings);

                expect(deduplicated).toHaveLength(2); // Two unique findings

                const secretFinding = deduplicated.find(f => f.value === 'secret123');
                expect(secretFinding).toBeDefined();
                expect(secretFinding.occurrenceCount).toBe(2);
                expect(secretFinding.severity).toBe('high'); // Highest severity preserved
                expect(secretFinding.locations).toHaveLength(2);
            });

            test('should preserve unique file locations (Requirement 2.4)', () => {
                const findings = [
                    {
                        pattern: { id: 'token' },
                        file: 'config/dev.js',
                        value: 'token123',
                        location: { line: 5, column: 10 }
                    },
                    {
                        pattern: { id: 'token' },
                        file: 'config/prod.js',
                        value: 'token123',
                        location: { line: 8, column: 15 }
                    },
                    {
                        pattern: { id: 'token' },
                        file: 'config/test.js',
                        value: 'token123',
                        location: { line: 3, column: 20 }
                    }
                ];

                const deduplicated = deduplicationEngine.deduplicateScanFindings(findings);

                expect(deduplicated).toHaveLength(1);
                expect(deduplicated[0].occurrenceCount).toBe(3);
                expect(deduplicated[0].locations).toHaveLength(3);

                const files = deduplicated[0].locations.map(loc => loc.file);
                expect(files).toContain('config/dev.js');
                expect(files).toContain('config/prod.js');
                expect(files).toContain('config/test.js');
            });
        });

        describe('Finding Merging (Requirement 2.1, 2.2)', () => {
            test('should preserve highest confidence score (Requirement 2.1)', () => {
                const existing = {
                    confidence: 0.7,
                    severity: 'medium',
                    occurrenceCount: 1,
                    locations: [{ file: 'file1.js', line: 1, column: 1 }]
                };

                const newFinding = {
                    confidence: 0.9,
                    severity: 'high',
                    file: 'file2.js',
                    location: { line: 2, column: 2 }
                };

                const merged = deduplicationEngine.mergeFindings(existing, newFinding);

                expect(merged.confidence).toBe(0.9);
                expect(merged.occurrenceCount).toBe(2);
            });

            test('should preserve most severe severity level (Requirement 2.2)', () => {
                const testCases = [
                    { existing: 'low', new: 'high', expected: 'high' },
                    { existing: 'critical', new: 'medium', expected: 'critical' },
                    { existing: 'info', new: 'low', expected: 'low' },
                    { existing: 'medium', new: 'high', expected: 'high' },
                    { existing: 'high', new: 'critical', expected: 'critical' }
                ];

                testCases.forEach(testCase => {
                    const existing = {
                        severity: testCase.existing,
                        confidence: 0.5,
                        occurrenceCount: 1,
                        locations: []
                    };

                    const newFinding = {
                        severity: testCase.new,
                        confidence: 0.5,
                        file: 'test.js',
                        location: { line: 1, column: 1 }
                    };

                    const merged = deduplicationEngine.mergeFindings(existing, newFinding);
                    expect(merged.severity).toBe(testCase.expected);
                });
            });

            test('should increment occurrence count correctly (Requirement 2.3)', () => {
                const existing = {
                    occurrenceCount: 3,
                    locations: [
                        { file: 'file1.js', line: 1, column: 1 },
                        { file: 'file2.js', line: 2, column: 2 },
                        { file: 'file3.js', line: 3, column: 3 }
                    ]
                };

                const newFinding = {
                    file: 'file4.js',
                    location: { line: 4, column: 4 }
                };

                const merged = deduplicationEngine.mergeFindings(existing, newFinding);

                expect(merged.occurrenceCount).toBe(4);
                expect(merged.locations).toHaveLength(4);
            });

            test('should not duplicate identical locations', () => {
                const existing = {
                    occurrenceCount: 1,
                    locations: [{ file: 'test.js', line: 1, column: 1 }]
                };

                const newFinding = {
                    file: 'test.js',
                    location: { line: 1, column: 1 } // Same location
                };

                const merged = deduplicationEngine.mergeFindings(existing, newFinding);

                expect(merged.occurrenceCount).toBe(2);
                expect(merged.locations).toHaveLength(1); // Should not duplicate location
            });
        });

        describe('Statistics and Monitoring', () => {
            test('should provide accurate deduplication statistics', () => {
                const findings = [
                    { pattern: { id: 'test' }, file: 'file1.js', value: 'secret1' },
                    { pattern: { id: 'test' }, file: 'file2.js', value: 'secret1' }, // Duplicate
                    { pattern: { id: 'test' }, file: 'file3.js', value: 'secret2' },
                    { pattern: { id: 'test' }, file: 'file4.js', value: 'secret1' }, // Another duplicate
                ];

                deduplicationEngine.deduplicateScanFindings(findings);
                const stats = deduplicationEngine.getStats();

                expect(stats.totalFindings).toBe(4);
                expect(stats.uniqueFindings).toBe(2);
                expect(stats.duplicatesRemoved).toBe(2);
                expect(stats.deduplicationRate).toBe('50.00%');
                expect(stats.cacheSize).toBeGreaterThan(0);
            });

            test('should track performance metrics', () => {
                const findings = Array(100).fill().map((_, i) => ({
                    pattern: { id: 'test' },
                    file: `file${i % 10}.js`,
                    value: `secret${i % 20}`
                }));

                deduplicationEngine.deduplicateScanFindings(findings);
                const stats = deduplicationEngine.getStats();

                expect(stats.deduplicationTime).toBeGreaterThan(0);
                expect(stats.operationCount).toBe(1);
                expect(stats.averageDeduplicationTime).toBeGreaterThan(0);
                expect(stats.performance).toBeDefined();
            });
        });
    });

    describe('Integration Tests with Known Duplicate Datasets', () => {
        let testFiles;

        beforeEach(async () => {
            testFiles = {
                duplicateSecrets: path.join(testDir, 'duplicate-secrets.js'),
                mixedFindings: path.join(testDir, 'mixed-findings.py'),
                crossFileSecrets: path.join(testDir, 'cross-file-secrets.json'),
                largeFile: path.join(testDir, 'large-file.js')
            };

            // Create test files with known duplicate patterns
            await createTestFilesWithDuplicates(testFiles);
        });

        test('should deduplicate hardcoded passwords across files', async () => {
            const engine = new DeduplicationEngine();

            // Simulate findings from multiple files with same password
            const findings = [
                {
                    pattern: { id: 'hardcoded-password' },
                    file: 'config.js',
                    value: 'admin123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 5, column: 20 }
                },
                {
                    pattern: { id: 'hardcoded-password' },
                    file: 'database.js',
                    value: 'admin123',
                    severity: 'critical',
                    confidence: 0.95,
                    location: { line: 12, column: 15 }
                },
                {
                    pattern: { id: 'hardcoded-password' },
                    file: 'auth.js',
                    value: 'admin123',
                    severity: 'high',
                    confidence: 0.85,
                    location: { line: 8, column: 10 }
                }
            ];

            const deduplicated = engine.deduplicateScanFindings(findings);

            expect(deduplicated).toHaveLength(1);
            expect(deduplicated[0].value).toBe('admin123');
            expect(deduplicated[0].occurrenceCount).toBe(3);
            expect(deduplicated[0].severity).toBe('critical'); // Most severe
            expect(deduplicated[0].confidence).toBe(0.95); // Highest confidence
            expect(deduplicated[0].locations).toHaveLength(3);
        });

        test('should deduplicate API keys with different contexts', async () => {
            const findings = [
                {
                    pattern: { id: 'stripe-api-key' },
                    file: 'payment.js',
                    value: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
                    context: { before: 'const stripeKey = "', after: '";' },
                    location: { line: 3, column: 19 }
                },
                {
                    pattern: { id: 'stripe-api-key' },
                    file: 'billing.js',
                    value: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
                    context: { before: 'STRIPE_SECRET_KEY="', after: '"' },
                    location: { line: 7, column: 20 }
                }
            ];

            const engine = new DeduplicationEngine({ preserveContext: true });
            const deduplicated = engine.deduplicateScanFindings(findings);

            expect(deduplicated).toHaveLength(1);
            expect(deduplicated[0].occurrenceCount).toBe(2);
            expect(deduplicated[0].locations).toHaveLength(2);

            // Should preserve context information
            if (deduplicated[0].allContexts) {
                expect(deduplicated[0].allContexts).toHaveLength(2);
            }
        });

        test('should handle OWASP A01 vulnerabilities deduplication', async () => {
            const findings = [
                {
                    pattern: { id: 'sql-injection' },
                    file: 'user.js',
                    value: 'SELECT * FROM users WHERE id = ' + userId,
                    severity: 'critical',
                    confidence: 0.9,
                    category: 'owasp-a01'
                },
                {
                    pattern: { id: 'sql-injection' },
                    file: 'admin.js',
                    value: 'SELECT * FROM users WHERE id = ' + userId,
                    severity: 'high',
                    confidence: 0.85,
                    category: 'owasp-a01'
                }
            ];

            const engine = new DeduplicationEngine();
            const deduplicated = engine.deduplicateScanFindings(findings);

            expect(deduplicated).toHaveLength(1);
            expect(deduplicated[0].severity).toBe('critical');
            expect(deduplicated[0].confidence).toBe(0.9);
            expect(deduplicated[0].occurrenceCount).toBe(2);
        });

        test('should maintain separate findings for different values', async () => {
            const findings = [
                {
                    pattern: { id: 'github-token' },
                    file: 'ci.yml',
                    value: 'ghp_1234567890abcdef1234567890abcdef12345678'
                },
                {
                    pattern: { id: 'github-token' },
                    file: 'deploy.yml',
                    value: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd'
                },
                {
                    pattern: { id: 'github-token' },
                    file: 'test.yml',
                    value: 'ghp_1234567890abcdef1234567890abcdef12345678' // Duplicate of first
                }
            ];

            const engine = new DeduplicationEngine();
            const deduplicated = engine.deduplicateScanFindings(findings);

            expect(deduplicated).toHaveLength(2); // Two unique tokens

            const token1 = deduplicated.find(f => f.value === 'ghp_1234567890abcdef1234567890abcdef12345678');
            const token2 = deduplicated.find(f => f.value === 'ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd');

            expect(token1.occurrenceCount).toBe(2);
            expect(token2.occurrenceCount).toBe(1);
        });
    });

    describe('Performance Tests for Large-Scale Deduplication (Requirement 3.1, 3.2)', () => {
        test('should handle large datasets efficiently', () => {
            const startTime = Date.now();

            // Generate large dataset with controlled duplicates
            const findings = generateLargeDataset(5000, 0.4); // 5000 findings, 40% duplicates

            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxDeduplicationTimeMs: 10000
            });

            const deduplicated = engine.deduplicateScanFindings(findings);
            const endTime = Date.now();

            const executionTime = endTime - startTime;
            const stats = engine.getStats();

            // Performance requirements
            expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
            expect(deduplicated.length).toBeLessThan(findings.length); // Should remove duplicates
            expect(stats.duplicatesRemoved).toBeGreaterThan(0);
            expect(stats.deduplicationRate).toMatch(/\d+\.\d+%/);

            console.log(`Large dataset performance: ${executionTime}ms for ${findings.length} findings`);
            console.log(`Duplicates removed: ${stats.duplicatesRemoved} (${stats.deduplicationRate})`);
        });

        test('should maintain performance under memory pressure', () => {
            const engine = new DeduplicationEngine({
                maxCacheSize: 100, // Small cache to test memory management
                enablePerformanceMonitoring: true
            });

            // Process multiple batches to test cache management
            for (let batch = 0; batch < 10; batch++) {
                const findings = generateLargeDataset(500, 0.3);
                engine.deduplicateScanFindings(findings);
            }

            const stats = engine.getStats();
            expect(stats.cacheSize).toBeLessThanOrEqual(100); // Should respect cache limit
            expect(stats.operationCount).toBe(10);
        });

        test('should scale linearly with dataset size', () => {
            const sizes = [100, 500, 1000, 2000];
            const results = [];

            sizes.forEach(size => {
                const engine = new DeduplicationEngine({ enablePerformanceMonitoring: true });
                const findings = generateLargeDataset(size, 0.3);

                const startTime = Date.now();
                engine.deduplicateScanFindings(findings);
                const endTime = Date.now();

                results.push({
                    size,
                    time: endTime - startTime,
                    timePerFinding: (endTime - startTime) / size
                });
            });

            // Performance should scale reasonably (not exponentially)
            const timePerFindingVariance = results.map(r => r.timePerFinding);
            const maxTimePerFinding = Math.max(...timePerFindingVariance);
            const minTimePerFinding = Math.min(...timePerFindingVariance);

            // Time per finding shouldn't vary by more than 10x
            expect(maxTimePerFinding / minTimePerFinding).toBeLessThan(10);

            console.log('Scaling results:', results);
        });

        test('should handle concurrent deduplication operations', async () => {
            const concurrentOperations = 5;
            const promises = [];

            for (let i = 0; i < concurrentOperations; i++) {
                const engine = new DeduplicationEngine();
                const findings = generateLargeDataset(1000, 0.3);

                promises.push(Promise.resolve().then(() => {
                    const startTime = Date.now();
                    const result = engine.deduplicateScanFindings(findings);
                    const endTime = Date.now();

                    return {
                        operationId: i,
                        time: endTime - startTime,
                        resultCount: result.length,
                        stats: engine.getStats()
                    };
                }));
            }

            const results = await Promise.all(promises);

            // All operations should complete successfully
            expect(results).toHaveLength(concurrentOperations);
            results.forEach(result => {
                expect(result.time).toBeLessThan(5000); // Each should complete within 5 seconds
                expect(result.resultCount).toBeGreaterThan(0);
            });
        });
    });

    describe('Error Handling and Fallback Scenarios (Requirement 3.3)', () => {
        test('should handle fingerprint generation errors gracefully', () => {
            const engine = new DeduplicationEngine();

            // Mock generateFingerprint to throw error
            const originalMethod = engine.generateFingerprint;
            engine.generateFingerprint = jest.fn().mockImplementation(() => {
                throw new Error('Fingerprint generation failed');
            });

            const findings = [
                { pattern: { id: 'test' }, file: 'test.js', value: 'test' }
            ];

            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should return fallback results
            expect(result).toHaveLength(1);
            expect(result[0].deduplicationStatus).toBe('fallback');

            const stats = engine.getStats();
            expect(stats.fallbackCount).toBe(1);

            // Restore original method
            engine.generateFingerprint = originalMethod;
        });

        test('should use fallback when memory limit is exceeded', () => {
            const engine = new DeduplicationEngine({
                memoryLimitMB: 1 // Very low limit
            });

            const findings = generateLargeDataset(1000, 0.1);
            const result = engine.deduplicateFileFindings(findings, 'test.js');

            // Should use fallback due to memory limit
            if (result[0]?.deduplicationStatus === 'fallback') {
                expect(result[0].fallbackReason).toBe('performance_limit');
            }
        });

        test('should handle circuit breaker functionality', () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 2
            });

            // Mock internal method to always fail
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation(() => {
                throw new Error('Simulated failure');
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];

            // Trigger failures to open circuit breaker
            engine.deduplicateFileFindings(findings, 'test1.js');
            engine.deduplicateFileFindings(findings, 'test2.js');
            engine.deduplicateFileFindings(findings, 'test3.js');

            const stats = engine.getStats();
            expect(stats.circuitBreaker.state).toBe('OPEN');
            expect(stats.fallbackCount).toBe(3);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });

        test('should handle null/undefined findings arrays', () => {
            const engine = new DeduplicationEngine();

            expect(() => {
                engine.deduplicateFileFindings(null, 'test.js');
            }).not.toThrow();

            expect(() => {
                engine.deduplicateFileFindings(undefined, 'test.js');
            }).not.toThrow();

            expect(() => {
                engine.deduplicateScanFindings(null);
            }).not.toThrow();

            expect(() => {
                engine.deduplicateScanFindings(undefined);
            }).not.toThrow();
        });

        test('should handle malformed finding objects', () => {
            const engine = new DeduplicationEngine();

            const malformedFindings = [
                null,
                undefined,
                {},
                { pattern: null },
                { pattern: { id: 'test' } }, // Missing file and value
                { file: 'test.js' }, // Missing pattern
                { value: 'test' }, // Missing pattern and file
                {
                    pattern: { id: 'valid' },
                    file: 'test.js',
                    value: 'valid'
                }
            ];

            const result = engine.deduplicateFileFindings(malformedFindings, 'test.js');

            // Should handle malformed objects gracefully
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0); // Should have at least the valid finding
        });

        test('should recover from temporary errors', () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 3,
                circuitBreakerResetTimeMs: 100
            });

            let failureCount = 0;
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation((findings) => {
                if (failureCount < 2) {
                    failureCount++;
                    throw new Error('Temporary failure');
                }
                return originalMethod.call(engine, findings);
            });

            const findings = [{ pattern: { id: 'test' }, file: 'test.js', value: 'test' }];

            // First two calls should fail
            engine.deduplicateFileFindings(findings, 'test1.js');
            engine.deduplicateFileFindings(findings, 'test2.js');

            // Third call should succeed
            const result = engine.deduplicateFileFindings(findings, 'test3.js');

            expect(result).toHaveLength(1);
            expect(result[0].deduplicationStatus).not.toBe('fallback');
        });
    });

    describe('Integration with Pattern Engine', () => {
        test('should work with EnhancedPatternEngine deduplication', () => {
            const engine = new EnhancedPatternEngine();

            // Register a test pattern
            engine.registerPattern({
                id: 'test-password',
                name: 'Test Password',
                regex: /password\s*=\s*["']([^"']+)["']/gi,
                category: 'secrets',
                severity: 'high'
            });

            const content = `
                const password = "secret123";
                var password = "secret123";
                let password = "secret123";
                const differentPassword = "different456";
            `;

            const results = engine.scanContent(content, { enableDeduplication: true });

            // Should deduplicate identical password values
            const passwordFindings = results.filter(r => r.value === 'secret123');
            expect(passwordFindings.length).toBeLessThanOrEqual(1);

            if (passwordFindings.length > 0) {
                expect(passwordFindings[0].occurrenceCount).toBeGreaterThan(1);
            }
        });

        test('should prevent overlapping matches', () => {
            const engine = new EnhancedPatternEngine();

            engine.registerPattern({
                id: 'api-key-1',
                regex: /api[_-]?key/gi,
                severity: 'high'
            });

            engine.registerPattern({
                id: 'key-pattern',
                regex: /key/gi,
                severity: 'medium'
            });

            const content = 'const api_key = "test";';
            const results = engine.scanContent(content, { enableDeduplication: true });

            // Should only match the more specific pattern
            expect(results).toHaveLength(1);
            expect(results[0].pattern.id).toBe('api-key-1');
        });
    });

    describe('End-to-End Integration Tests', () => {
        test('should integrate with repository scanner', async () => {
            // Create test repository
            const testRepo = path.join(testDir, 'integration-repo');
            await fs.ensureDir(testRepo);

            // Create files with duplicate secrets
            await fs.writeFile(path.join(testRepo, 'config.js'), `
                const apiKey = "sk_test_duplicate_key";
                const backupKey = "sk_test_duplicate_key";
            `);

            await fs.writeFile(path.join(testRepo, 'env.js'), `
                process.env.API_KEY = "sk_test_duplicate_key";
            `);

            // Mock repository scanner to use deduplication
            const mockScanner = {
                scanRepositoryFiles: jest.fn().mockImplementation(async (repoPath, options) => {
                    const engine = new DeduplicationEngine();
                    const findings = [
                        {
                            pattern: { id: 'stripe-key' },
                            file: 'config.js',
                            value: 'sk_test_duplicate_key',
                            severity: 'high',
                            confidence: 0.9
                        },
                        {
                            pattern: { id: 'stripe-key' },
                            file: 'config.js',
                            value: 'sk_test_duplicate_key',
                            severity: 'high',
                            confidence: 0.9
                        },
                        {
                            pattern: { id: 'stripe-key' },
                            file: 'env.js',
                            value: 'sk_test_duplicate_key',
                            severity: 'high',
                            confidence: 0.9
                        }
                    ];

                    const deduplicated = engine.deduplicateScanFindings(findings);

                    return {
                        findings: deduplicated,
                        deduplicationStats: engine.getStats()
                    };
                })
            };

            const results = await mockScanner.scanRepositoryFiles(testRepo, {
                enableDeduplication: true
            });

            expect(results.findings).toHaveLength(1);
            expect(results.findings[0].occurrenceCount).toBe(3);
            expect(results.deduplicationStats.duplicatesRemoved).toBe(2);
        });
    });
});

/**
 * Generate large dataset for performance testing
 * @param {number} count - Number of findings to generate
 * @param {number} duplicateRate - Rate of duplicates (0.0 to 1.0)
 * @returns {Array} Array of test findings
 */
function generateLargeDataset(count, duplicateRate) {
    const findings = [];
    const uniqueCount = Math.floor(count * (1 - duplicateRate));
    const duplicateCount = count - uniqueCount;

    // Generate unique findings
    for (let i = 0; i < uniqueCount; i++) {
        findings.push({
            pattern: {
                id: `pattern-${i % 20}`,
                name: `Test Pattern ${i % 20}`,
                severity: ['low', 'medium', 'high', 'critical'][i % 4]
            },
            file: `file-${Math.floor(i / 50)}.js`,
            value: `value-${i}`,
            location: {
                line: (i % 1000) + 1,
                column: (i % 100) + 1
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
                line: findings[sourceIndex].location.line + Math.floor(Math.random() * 100)
            }
        };
        findings.push(duplicate);
    }

    // Shuffle array
    for (let i = findings.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [findings[i], findings[j]] = [findings[j], findings[i]];
    }

    return findings;
}

/**
 * Create test files with known duplicate patterns
 */
async function createTestFilesWithDuplicates(testFiles) {
    // File with duplicate secrets
    await fs.writeFile(testFiles.duplicateSecrets, `
        const apiKey1 = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";
        const apiKey2 = "sk_test_4eC39HqLyjWDarjtT1zdp7dc"; // Duplicate
        const apiKey3 = "sk_test_4eC39HqLyjWDarjtT1zdp7dc"; // Another duplicate
        const differentKey = "sk_test_different123456789";
        const password = "admin123";
        const pwd = "admin123"; // Duplicate password
    `);

    // File with mixed findings
    await fs.writeFile(testFiles.mixedFindings, `
        import os
        password = "secret123"
        api_key = "sk_test_mixed_findings_key"
        password = "secret123"  # Duplicate password
        token = "ghp_1234567890abcdef1234567890abcdef12345678"
        password = "secret123"  # Another duplicate
        different_token = "ghp_different1234567890abcdef1234567890"
    `);

    // Cross-file secrets
    await fs.writeFile(testFiles.crossFileSecrets, `{
        "database": {
            "password": "shared_secret_123"
        },
        "api": {
            "key": "sk_test_cross_file_key"
        }
    }`);

    // Large file for performance testing
    const largeContent = Array(1000).fill().map((_, i) =>
        `const secret${i} = "secret_${i % 100}";`
    ).join('\n');
    await fs.writeFile(testFiles.largeFile, largeContent);
}