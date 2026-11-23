/**
 * Unit tests for DeduplicationEngine
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');

describe('DeduplicationEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new DeduplicationEngine();
    });

    describe('generateFingerprint', () => {
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

            const fingerprint1 = engine.generateFingerprint(finding1);
            const fingerprint2 = engine.generateFingerprint(finding2);

            expect(fingerprint1).toBe(fingerprint2);
        });

        test('should generate different fingerprints for different findings', () => {
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

            const fingerprint1 = engine.generateFingerprint(finding1);
            const fingerprint2 = engine.generateFingerprint(finding2);

            expect(fingerprint1).not.toBe(fingerprint2);
        });
    });

    describe('deduplicateFileFindings', () => {
        test('should deduplicate identical findings within a file', () => {
            const findings = [
                {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'secret123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 1, column: 10 },
                    context: { before: 'const secret = "', after: '";' }
                },
                {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'secret123',
                    severity: 'medium',
                    confidence: 0.8,
                    location: { line: 2, column: 10 },
                    context: { before: 'var secret = "', after: '";' }
                },
                {
                    pattern: { id: 'test-pattern' },
                    file: 'test.js',
                    value: 'different123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 3, column: 10 },
                    context: { before: 'let secret = "', after: '";' }
                }
            ];

            const deduplicated = engine.deduplicateFileFindings(findings, 'test.js');

            expect(deduplicated.length).toBe(2); // Two unique findings

            // Check that the duplicate was merged properly
            const secretFinding = deduplicated.find(f => f.value === 'secret123');
            expect(secretFinding).toBeDefined();
            expect(secretFinding.occurrenceCount).toBe(2);
            expect(secretFinding.severity).toBe('high'); // Should preserve highest severity
            expect(secretFinding.confidence).toBe(0.9); // Should preserve highest confidence
            expect(secretFinding.locations.length).toBe(2);
        });

        test('should handle empty findings array', () => {
            const deduplicated = engine.deduplicateFileFindings([], 'test.js');
            expect(deduplicated).toEqual([]);
        });
    });

    describe('deduplicateScanFindings', () => {
        test('should deduplicate findings across multiple files', () => {
            const findings = [
                {
                    pattern: { id: 'test-pattern' },
                    file: 'file1.js',
                    value: 'secret123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 1, column: 10 }
                },
                {
                    pattern: { id: 'test-pattern' },
                    file: 'file2.js',
                    value: 'secret123',
                    severity: 'medium',
                    confidence: 0.8,
                    location: { line: 1, column: 10 }
                },
                {
                    pattern: { id: 'test-pattern' },
                    file: 'file3.js',
                    value: 'different123',
                    severity: 'high',
                    confidence: 0.9,
                    location: { line: 1, column: 10 }
                }
            ];

            const deduplicated = engine.deduplicateScanFindings(findings);

            expect(deduplicated.length).toBe(2); // Two unique findings

            // Check that the duplicate was merged properly
            const secretFinding = deduplicated.find(f => f.value === 'secret123');
            expect(secretFinding).toBeDefined();
            expect(secretFinding.occurrenceCount).toBe(2);
            expect(secretFinding.severity).toBe('high'); // Should preserve highest severity
            expect(secretFinding.locations.length).toBe(2);
        });

        test('should provide accurate statistics', () => {
            const findings = [
                { pattern: { id: 'test' }, file: 'file1.js', value: 'secret1' },
                { pattern: { id: 'test' }, file: 'file2.js', value: 'secret1' }, // Duplicate
                { pattern: { id: 'test' }, file: 'file3.js', value: 'secret2' }
            ];

            engine.deduplicateScanFindings(findings);
            const stats = engine.getStats();

            expect(stats.totalFindings).toBe(3);
            expect(stats.uniqueFindings).toBe(2);
            expect(stats.duplicatesRemoved).toBe(1);
            expect(stats.deduplicationRate).toBe('33.33%');
        });
    });

    describe('mergeFindings', () => {
        test('should preserve highest confidence and most severe severity', () => {
            const existing = {
                severity: 'medium',
                confidence: 0.7,
                occurrenceCount: 1,
                locations: [{ file: 'file1.js', line: 1, column: 10 }]
            };

            const newFinding = {
                severity: 'high',
                confidence: 0.9,
                file: 'file2.js',
                location: { line: 2, column: 15 }
            };

            const merged = engine.mergeFindings(existing, newFinding);

            expect(merged.severity).toBe('high');
            expect(merged.confidence).toBe(0.9);
            expect(merged.occurrenceCount).toBe(2);
            expect(merged.locations.length).toBe(2);
        });

        test('should handle severity level comparison correctly', () => {
            const testCases = [
                { existing: 'low', new: 'high', expected: 'high' },
                { existing: 'critical', new: 'medium', expected: 'critical' },
                { existing: 'info', new: 'low', expected: 'low' }
            ];

            testCases.forEach(testCase => {
                const existing = { severity: testCase.existing, confidence: 0.5, occurrenceCount: 1, locations: [] };
                const newFinding = { severity: testCase.new, confidence: 0.5, file: 'test.js', location: { line: 1, column: 1 } };

                const merged = engine.mergeFindings(existing, newFinding);
                expect(merged.severity).toBe(testCase.expected);
            });
        });
    });

    describe('performance safeguards', () => {
        test('should skip deduplication for very large result sets', () => {
            const largeFindings = Array(15000).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: `file${i}.js`,
                value: `secret${i}`
            }));

            const shouldSkip = engine.shouldSkipDeduplication(largeFindings);
            expect(shouldSkip).toBe(true);
        });

        test('should not skip deduplication for normal result sets', () => {
            const normalFindings = Array(100).fill().map((_, i) => ({
                pattern: { id: 'test' },
                file: `file${i}.js`,
                value: `secret${i}`
            }));

            const shouldSkip = engine.shouldSkipDeduplication(normalFindings);
            expect(shouldSkip).toBe(false);
        });
    });

    describe('cache management', () => {
        test('should manage fingerprint cache size', () => {
            const smallEngine = new DeduplicationEngine({ maxCacheSize: 2 });

            // Generate more fingerprints than cache size
            smallEngine.generateFingerprint({ pattern: { id: '1' }, file: 'f1', value: 'v1' });
            smallEngine.generateFingerprint({ pattern: { id: '2' }, file: 'f2', value: 'v2' });
            smallEngine.generateFingerprint({ pattern: { id: '3' }, file: 'f3', value: 'v3' });

            // Cache should not exceed max size
            expect(smallEngine.fingerprintCache.size).toBeLessThanOrEqual(2);
        });
    });

    describe('reset functionality', () => {
        test('should reset all state and statistics', () => {
            // Generate some state
            engine.generateFingerprint({ pattern: { id: 'test' }, file: 'test.js', value: 'secret' });
            engine.deduplicateScanFindings([
                { pattern: { id: 'test' }, file: 'test.js', value: 'secret1' },
                { pattern: { id: 'test' }, file: 'test.js', value: 'secret1' }
            ]);

            // Reset
            engine.reset();

            // Check everything is cleared
            expect(engine.fingerprintCache.size).toBe(0);
            expect(engine.deduplicatedFindings.size).toBe(0);

            const stats = engine.getStats();
            expect(stats.totalFindings).toBe(0);
            expect(stats.duplicatesRemoved).toBe(0);
            expect(stats.uniqueFindings).toBe(0);
        });
    });
});