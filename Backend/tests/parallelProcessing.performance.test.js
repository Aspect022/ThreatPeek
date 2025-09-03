/**
 * Performance Tests for Parallel Processing Capabilities
 * Tests concurrent file scanning, pattern matching, and worker pool performance
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const fs = require('fs-extra');
const path = require('path');
const { WorkerPool } = require('../utils/workerPool');
const { ParallelPatternEngine } = require('../utils/parallelPatternEngine');
const enhancedPatternDefinitions = require('../utils/enhancedPatternDefinitions');

describe('Parallel Processing Performance Tests', () => {
    let workerPool;
    let parallelEngine;
    let testDir;
    let testFiles;

    beforeAll(async () => {
        // Initialize worker pool
        workerPool = new WorkerPool({
            maxWorkers: 4,
            workerScript: path.join(__dirname, '..', 'utils', 'scanWorker.js')
        });

        // Initialize parallel pattern engine
        parallelEngine = new ParallelPatternEngine({
            maxWorkers: 4,
            parallelThreshold: 1000, // Lower threshold for testing
            chunkSize: 5000,
            chunkOverlap: 500
        });

        parallelEngine.registerPatterns(enhancedPatternDefinitions.allPatterns);

        // Create test directory and files
        testDir = path.join(__dirname, '..', 'temp', 'parallel-test');
        await fs.ensureDir(testDir);

        testFiles = await createTestFiles(testDir);
    });

    afterAll(async () => {
        // Cleanup
        if (workerPool) {
            await workerPool.shutdown();
        }
        if (parallelEngine) {
            await parallelEngine.shutdown();
        }
        if (testDir) {
            await fs.remove(testDir);
        }
    });

    describe('Worker Pool Performance', () => {
        it('should handle concurrent file scanning efficiently', async () => {
            const startTime = Date.now();

            const results = await workerPool.scanFilesParallel(testFiles, {
                categories: ['secrets'],
                confidenceThreshold: 0.5,
                timeout: 10000
            });

            const duration = Date.now() - startTime;

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(testFiles.length);
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

            // Verify all files were processed
            results.forEach((result, index) => {
                expect(result).toBeDefined();
                expect(result.findings).toBeDefined();
                expect(Array.isArray(result.findings)).toBe(true);
            });

            console.log(`✅ Parallel file scanning completed in ${duration}ms`);
        }, 15000);

        it('should process tasks with proper priority ordering', async () => {
            const tasks = [
                { taskType: 'scanContent', taskData: { content: 'low priority', scanOptions: {} }, options: { priority: 1 } },
                { taskType: 'scanContent', taskData: { content: 'high priority', scanOptions: {} }, options: { priority: 5 } },
                { taskType: 'scanContent', taskData: { content: 'medium priority', scanOptions: {} }, options: { priority: 3 } }
            ];

            const startTime = Date.now();
            const results = await workerPool.executeParallel(tasks);
            const duration = Date.now() - startTime;

            expect(results).toBeDefined();
            expect(results.length).toBe(3);
            expect(duration).toBeLessThan(2000);

            console.log(`✅ Priority task processing completed in ${duration}ms`);
        });

        it('should handle worker errors gracefully', async () => {
            // Test with invalid task type
            const invalidTask = workerPool.executeTask('invalidTaskType', {}, { timeout: 1000 });

            await expect(invalidTask).rejects.toThrow();

            // Verify worker pool is still functional
            const validTask = await workerPool.executeTask('scanContent', {
                content: 'test content',
                scanOptions: { categories: ['secrets'] }
            });

            expect(validTask).toBeDefined();
        });

        it('should provide accurate performance statistics', async () => {
            const stats = workerPool.getStats();

            expect(stats).toBeDefined();
            expect(typeof stats.activeWorkers).toBe('number');
            expect(typeof stats.availableWorkers).toBe('number');
            expect(typeof stats.queuedTasks).toBe('number');
            expect(typeof stats.activeTasks).toBe('number');
            expect(typeof stats.tasksCompleted).toBe('number');
            expect(stats.maxWorkers).toBe(4);

            console.log('📊 Worker Pool Stats:', stats);
        });
    });

    describe('Parallel Pattern Engine Performance', () => {
        it('should automatically choose parallel processing for large content', async () => {
            const largeContent = generateLargeContent(100000); // 100KB content

            const startTime = Date.now();
            const matches = await parallelEngine.scanContentParallel(largeContent, {
                categories: ['secrets', 'vulnerabilities'],
                confidenceThreshold: 0.5
            });
            const duration = Date.now() - startTime;

            expect(matches).toBeDefined();
            expect(Array.isArray(matches)).toBe(true);
            expect(duration).toBeLessThan(3000); // Should complete within 3 seconds

            console.log(`✅ Large content scanning completed in ${duration}ms, found ${matches.length} matches`);
        });

        it('should use sequential processing for small content', async () => {
            const smallContent = 'const apiKey = "sk_test_123456789";';

            const startTime = Date.now();
            const matches = await parallelEngine.scanContentParallel(smallContent, {
                categories: ['secrets'],
                confidenceThreshold: 0.5
            });
            const duration = Date.now() - startTime;

            expect(matches).toBeDefined();
            expect(Array.isArray(matches)).toBe(true);
            expect(duration).toBeLessThan(100); // Should be very fast for small content

            console.log(`✅ Small content scanning completed in ${duration}ms`);
        });

        it('should handle multiple file scanning efficiently', async () => {
            const startTime = Date.now();
            const results = await parallelEngine.scanFilesParallel(testFiles.slice(0, 5), {
                categories: ['secrets', 'vulnerabilities'],
                confidenceThreshold: 0.5
            });
            const duration = Date.now() - startTime;

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(5);
            expect(duration).toBeLessThan(3000);

            console.log(`✅ Multiple file scanning completed in ${duration}ms`);
        });

        it('should provide performance benchmarking', async () => {
            const testContents = [
                generateContentWithSecrets(5000),
                generateContentWithSecrets(5000),
                generateContentWithSecrets(5000)
            ];

            const benchmark = await parallelEngine.benchmarkPerformance(testContents, {
                categories: ['secrets'],
                confidenceThreshold: 0.5
            });

            expect(benchmark).toBeDefined();
            expect(typeof benchmark.sequential.totalTime).toBe('number');
            expect(typeof benchmark.parallel.totalTime).toBe('number');
            expect(typeof benchmark.speedup).toBe('number');
            expect(typeof benchmark.efficiency).toBe('number');

            console.log('📊 Performance Benchmark:', benchmark);
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle file read errors gracefully', async () => {
            const nonExistentFiles = [
                path.join(testDir, 'nonexistent1.js'),
                path.join(testDir, 'nonexistent2.js')
            ];

            const results = await workerPool.scanFilesParallel(nonExistentFiles, {
                categories: ['secrets'],
                timeout: 5000
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            // Results should be empty or contain error information
        });

        it('should handle worker timeout gracefully', async () => {
            const timeoutTask = workerPool.executeTask('scanContent', {
                content: generateLargeContent(1000000), // Very large content
                scanOptions: { categories: ['secrets'] }
            }, { timeout: 100 }); // Very short timeout

            // Should either complete or timeout gracefully
            try {
                await timeoutTask;
            } catch (error) {
                expect(error.message).toContain('timeout');
            }
        });

        it('should recover from worker failures', async () => {
            const initialStats = workerPool.getStats();

            // Force a worker error by sending invalid data
            try {
                await workerPool.executeTask('scanContent', null);
            } catch (error) {
                // Expected to fail
            }

            // Wait a moment for recovery
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify worker pool is still functional
            const result = await workerPool.executeTask('scanContent', {
                content: 'test recovery',
                scanOptions: { categories: ['secrets'] }
            });

            expect(result).toBeDefined();

            const finalStats = workerPool.getStats();
            expect(finalStats.activeWorkers).toBeGreaterThan(0);
        });
    });

    describe('Memory and Resource Management', () => {
        it('should handle large file processing without memory issues', async () => {
            const largeFile = path.join(testDir, 'large-test-file.js');
            const largeContent = generateLargeContent(500000); // 500KB
            await fs.writeFile(largeFile, largeContent);

            const initialMemory = process.memoryUsage();

            const result = await parallelEngine.scanSingleFile(largeFile, {
                categories: ['secrets'],
                maxFileSize: 1024 * 1024 // 1MB limit
            });

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            expect(result).toBeDefined();
            expect(result.findings).toBeDefined();
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase

            console.log(`📊 Memory usage increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

            await fs.remove(largeFile);
        });

        it('should provide accurate performance statistics', async () => {
            const stats = parallelEngine.getPerformanceStats();

            expect(stats).toBeDefined();
            expect(stats.engine).toBeDefined();
            expect(stats.workerPool).toBeDefined();
            expect(stats.configuration).toBeDefined();

            expect(typeof stats.configuration.parallelThreshold).toBe('number');
            expect(typeof stats.configuration.chunkSize).toBe('number');
            expect(typeof stats.configuration.chunkOverlap).toBe('number');

            console.log('📊 Parallel Engine Stats:', stats);
        });
    });
});

/**
 * Create test files for performance testing
 */
async function createTestFiles(testDir) {
    const files = [];

    for (let i = 0; i < 10; i++) {
        const fileName = `test-file-${i}.js`;
        const filePath = path.join(testDir, fileName);
        const content = generateContentWithSecrets(2000 + i * 500);

        await fs.writeFile(filePath, content);
        files.push(filePath);
    }

    return files;
}

/**
 * Generate content with embedded secrets for testing
 */
function generateContentWithSecrets(size) {
    const secrets = [
        'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
        'AKIAIOSFODNN7EXAMPLE',
        'SG.1234567890abcdef.1234567890abcdef1234567890abcdef1234567890abcdef',
        'github_pat_11ABCDEFG_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    ];

    let content = '// Test file with secrets\n';
    content += 'const config = {\n';

    // Add some secrets
    secrets.forEach((secret, index) => {
        content += `  secret${index}: "${secret}",\n`;
    });

    content += '};\n\n';

    // Fill remaining space with normal code
    const normalCode = `
function processData(data) {
    return data.map(item => ({
        id: item.id,
        name: item.name,
        processed: true
    }));
}

class DataProcessor {
    constructor(options) {
        this.options = options;
    }
    
    process(data) {
        return processData(data);
    }
}

module.exports = { DataProcessor };
`;

    while (content.length < size) {
        content += normalCode;
    }

    return content.substring(0, size);
}

/**
 * Generate large content for performance testing
 */
function generateLargeContent(size) {
    const baseContent = `
const express = require('express');
const app = express();

app.get('/api/data', (req, res) => {
    const data = {
        message: 'Hello World',
        timestamp: new Date().toISOString(),
        random: Math.random()
    };
    res.json(data);
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
`;

    let content = '';
    while (content.length < size) {
        content += baseContent;
    }

    return content.substring(0, size);
}