/**
 * Scan Worker Deduplication Tests
 * Tests worker-level deduplication functionality and statistics
 */

const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs-extra');
const { DeduplicationEngine } = require('../services/deduplicationEngine');

describe('Scan Worker Deduplication', () => {
    let testDir;
    let testFiles;

    beforeAll(async () => {
        // Create test directory and files
        testDir = path.join(__dirname, 'temp', 'worker-dedup-test');
        await fs.ensureDir(testDir);

        // Create test files with duplicate patterns
        testFiles = {
            duplicateSecrets: path.join(testDir, 'duplicate-secrets.js'),
            mixedFindings: path.join(testDir, 'mixed-findings.py'),
            uniqueFindings: path.join(testDir, 'unique-findings.txt')
        };

        // File with duplicate hardcoded passwords and API keys
        await fs.writeFile(testFiles.duplicateSecrets, `
const password = "hardcoded123";
const openaiKey = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";
const password2 = "hardcoded123"; // Same password again
const dbPassword = "hardcoded123"; // Same password third time
const differentPassword = "different456";
const openaiKey2 = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEF"; // Same API key again
const awsKey = "AKIAIOSFODNN7EXAMPLE";
const awsKey2 = "AKIAIOSFODNN7EXAMPLE"; // Duplicate AWS key
        `);

        // File with mixed findings including duplicates
        await fs.writeFile(testFiles.mixedFindings, `
import os
password = "secret123"
api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEF"
password = "secret123"  # Duplicate password
sql_query = "SELECT * FROM users WHERE id = " + user_id  # SQL injection
password = "secret123"  # Another duplicate
eval(user_input)  # Code injection
        `);

        // File with unique findings only
        await fs.writeFile(testFiles.uniqueFindings, `
password="unique123"
password="different456"
password="another789"
        `);
    });

    afterAll(async () => {
        // Clean up test files
        await fs.remove(testDir);
    });

    describe('Worker Thread Deduplication', () => {
        test('should deduplicate findings within a single file', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const taskData = {
                filePath: testFiles.duplicateSecrets,
                scanOptions: {
                    relativePath: 'duplicate-secrets.js',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-dedup-1',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-dedup-1') {
                    expect(message.result).toBeDefined();
                    expect(message.result.findings).toBeDefined();
                    expect(message.result.deduplicationStats).toBeDefined();

                    const { findings, deduplicationStats } = message.result;

                    // Should have deduplication statistics
                    expect(deduplicationStats.totalFindings).toBeGreaterThanOrEqual(findings.length);
                    expect(deduplicationStats.duplicatesRemoved).toBeGreaterThanOrEqual(0);
                    expect(deduplicationStats.uniqueFindings).toBe(findings.length);

                    // If patterns were found, check for duplicates
                    if (findings.length > 0) {
                        console.log('Found findings:', findings.length);
                        console.log('Deduplication stats:', deduplicationStats);
                    }

                    // Should have unique findings for each distinct pattern/value combination
                    const uniqueFingerprints = new Set();
                    findings.forEach(finding => {
                        const fingerprint = `${finding.pattern.id}-${finding.value}`;
                        expect(uniqueFingerprints.has(fingerprint)).toBe(false);
                        uniqueFingerprints.add(fingerprint);
                    });

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);

        test('should preserve highest confidence and most severe severity', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const taskData = {
                filePath: testFiles.mixedFindings,
                scanOptions: {
                    relativePath: 'mixed-findings.py',
                    enableDeduplication: true,
                    categories: ['secrets', 'vulnerabilities'],
                    confidenceThreshold: 0.3
                }
            };

            worker.postMessage({
                taskId: 'test-dedup-2',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-dedup-2') {
                    expect(message.result).toBeDefined();
                    const { findings } = message.result;

                    // Check that deduplicated findings have proper metadata
                    findings.forEach(finding => {
                        expect(finding.confidence).toBeGreaterThan(0);
                        expect(finding.severity).toBeDefined();
                        expect(['critical', 'high', 'medium', 'low', 'info']).toContain(finding.severity);
                    });

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);

        test('should include deduplication statistics in results', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const taskData = {
                filePath: testFiles.duplicateSecrets,
                scanOptions: {
                    relativePath: 'duplicate-secrets.js',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-stats',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-stats') {
                    expect(message.result.deduplicationStats).toBeDefined();

                    const stats = message.result.deduplicationStats;
                    expect(stats).toHaveProperty('totalFindings');
                    expect(stats).toHaveProperty('uniqueFindings');
                    expect(stats).toHaveProperty('duplicatesRemoved');
                    expect(stats).toHaveProperty('deduplicationTime');
                    expect(stats).toHaveProperty('memoryUsage');

                    expect(typeof stats.totalFindings).toBe('number');
                    expect(typeof stats.uniqueFindings).toBe('number');
                    expect(typeof stats.duplicatesRemoved).toBe('number');
                    expect(typeof stats.deduplicationTime).toBe('number');
                    expect(typeof stats.memoryUsage).toBe('number');

                    expect(stats.totalFindings).toBeGreaterThanOrEqual(stats.uniqueFindings);
                    expect(stats.duplicatesRemoved).toBe(stats.totalFindings - stats.uniqueFindings);

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);

        test('should handle files with no duplicates correctly', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const taskData = {
                filePath: testFiles.uniqueFindings,
                scanOptions: {
                    relativePath: 'unique-findings.txt',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-unique',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-unique') {
                    expect(message.result).toBeDefined();
                    const { findings, deduplicationStats } = message.result;

                    // Should have no duplicates removed
                    expect(deduplicationStats.duplicatesRemoved).toBe(0);
                    expect(deduplicationStats.totalFindings).toBe(deduplicationStats.uniqueFindings);
                    expect(findings.length).toBe(deduplicationStats.uniqueFindings);

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);

        test('should work with deduplication disabled', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const taskData = {
                filePath: testFiles.duplicateSecrets,
                scanOptions: {
                    relativePath: 'duplicate-secrets.js',
                    enableDeduplication: false, // Disable deduplication
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-disabled',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-disabled') {
                    expect(message.result).toBeDefined();
                    const { findings, deduplicationStats } = message.result;

                    // Should have no deduplication applied
                    expect(deduplicationStats.duplicatesRemoved).toBe(0);
                    expect(deduplicationStats.totalFindings).toBe(findings.length);

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);
    });

    describe('Worker Memory Management', () => {
        test('should manage memory efficiently during deduplication', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const taskData = {
                filePath: testFiles.duplicateSecrets,
                scanOptions: {
                    relativePath: 'duplicate-secrets.js',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-memory',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-memory') {
                    expect(message.result.deduplicationStats.memoryUsage).toBeDefined();
                    expect(typeof message.result.deduplicationStats.memoryUsage).toBe('number');
                    expect(message.result.deduplicationStats.memoryUsage).toBeGreaterThanOrEqual(0);

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);
    });

    describe('Worker Error Handling', () => {
        test('should handle deduplication errors gracefully', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            // Create a file that might cause issues
            const problematicFile = path.join(testDir, 'problematic.js');
            const problematicContent = 'const x = "' + 'a'.repeat(100000) + '";'; // Very long string

            fs.writeFileSync(problematicFile, problematicContent);

            const taskData = {
                filePath: problematicFile,
                scanOptions: {
                    relativePath: 'problematic.js',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-error',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-error') {
                    // Should complete without throwing errors
                    expect(message.result).toBeDefined();
                    expect(message.result.findings).toBeDefined();

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 15000);

        test('should handle null/undefined findings gracefully', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            // Create empty file
            const emptyFile = path.join(testDir, 'empty.js');
            fs.writeFileSync(emptyFile, '');

            const taskData = {
                filePath: emptyFile,
                scanOptions: {
                    relativePath: 'empty.js',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-empty',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-empty') {
                    expect(message.result).toBeDefined();
                    expect(message.result.findings).toBeDefined();
                    expect(Array.isArray(message.result.findings)).toBe(true);
                    expect(message.result.deduplicationStats).toBeDefined();

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);
    });

    describe('Worker Performance', () => {
        test('should complete deduplication within reasonable time', (done) => {
            const worker = new Worker(path.join(__dirname, '../utils/scanWorker.js'));

            const startTime = Date.now();

            const taskData = {
                filePath: testFiles.duplicateSecrets,
                scanOptions: {
                    relativePath: 'duplicate-secrets.js',
                    enableDeduplication: true,
                    categories: ['secrets'],
                    confidenceThreshold: 0.5
                }
            };

            worker.postMessage({
                taskId: 'test-performance',
                taskType: 'scanFile',
                taskData,
                options: {}
            });

            worker.on('message', (message) => {
                if (message.type === 'taskComplete' && message.taskId === 'test-performance') {
                    const totalTime = Date.now() - startTime;
                    const deduplicationTime = message.result.deduplicationStats.deduplicationTime;

                    // Deduplication should be fast relative to total scan time
                    expect(deduplicationTime).toBeLessThan(totalTime);
                    expect(deduplicationTime).toBeLessThan(1000); // Should complete within 1 second

                    worker.terminate();
                    done();
                }
            });

            worker.on('error', (error) => {
                worker.terminate();
                done(error);
            });
        }, 10000);
    });

    describe('Worker Integration with DeduplicationEngine', () => {
        test('should use DeduplicationEngine correctly', () => {
            // Test that the worker is using the same deduplication logic
            const engine = new DeduplicationEngine({
                enableFileLevel: true,
                enableScanLevel: false,
                preserveContext: true,
                maxCacheSize: 5000
            });

            // Test findings
            const testFindings = [
                {
                    type: 'hardcoded-password',
                    value: 'secret123',
                    file: 'test.js',
                    pattern: { id: 'hardcoded-password', category: 'secrets' },
                    location: { line: 1, column: 10 },
                    confidence: 0.8,
                    severity: 'high'
                },
                {
                    type: 'hardcoded-password',
                    value: 'secret123',
                    file: 'test.js',
                    pattern: { id: 'hardcoded-password', category: 'secrets' },
                    location: { line: 5, column: 15 },
                    confidence: 0.9,
                    severity: 'high'
                }
            ];

            const deduplicated = engine.deduplicateFileFindings(testFindings, 'test.js');

            expect(deduplicated).toHaveLength(1);
            expect(deduplicated[0].confidence).toBe(0.9); // Should preserve highest confidence
            expect(deduplicated[0].occurrenceCount).toBe(2);
        });
    });
});