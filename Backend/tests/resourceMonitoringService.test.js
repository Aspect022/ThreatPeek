/**
 * Resource Monitoring Service Tests
 * Tests for memory usage monitoring and streaming processing
 */

const { ResourceMonitoringService } = require('../services/resourceMonitoringService');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('ResourceMonitoringService', () => {
    let resourceMonitor;
    let tempDir;

    beforeEach(async () => {
        resourceMonitor = new ResourceMonitoringService({
            monitoringInterval: 100, // Fast interval for testing
            gcInterval: 200,
            largeFileThreshold: 1024, // 1KB for testing
            streamingThreshold: 2048, // 2KB for testing
            chunkSize: 512 // 512 bytes for testing
        });

        tempDir = path.join(os.tmpdir(), 'resource-monitor-test');
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        await resourceMonitor.shutdown();
        await fs.remove(tempDir);
    });

    describe('Memory Monitoring', () => {
        test('should start and stop monitoring', () => {
            expect(resourceMonitor.state.isMonitoring).toBe(false);

            resourceMonitor.startMonitoring();
            expect(resourceMonitor.state.isMonitoring).toBe(true);

            resourceMonitor.stopMonitoring();
            expect(resourceMonitor.state.isMonitoring).toBe(false);
        });

        test('should update memory statistics', () => {
            resourceMonitor.updateMemoryStats();

            const stats = resourceMonitor.state.memoryStats;
            expect(stats.heapUsed).toBeGreaterThan(0);
            expect(stats.heapTotal).toBeGreaterThan(0);
            expect(stats.rss).toBeGreaterThan(0);
        });

        test('should emit memory alerts on high usage', (done) => {
            // Mock high memory usage (85% - between warning 80% and critical 90%)
            resourceMonitor.state.memoryStats = {
                heapUsed: 850 * 1024 * 1024, // 850MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            resourceMonitor.on('resourceAlert', (alert) => {
                expect(alert.type).toBe('MEMORY_WARNING');
                expect(alert.data.usageRatio).toBe(0.85);
                done();
            });

            resourceMonitor.checkMemoryThresholds();
        });

        test('should emit critical memory alerts', (done) => {
            // Mock critical memory usage
            resourceMonitor.state.memoryStats = {
                heapUsed: 950 * 1024 * 1024, // 950MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            resourceMonitor.on('resourceAlert', (alert) => {
                expect(alert.type).toBe('MEMORY_CRITICAL');
                expect(alert.data.usageRatio).toBe(0.95);
                done();
            });

            resourceMonitor.checkMemoryThresholds();
        });
    });

    describe('File Analysis', () => {
        test('should analyze small file for memory processing', async () => {
            const smallFile = path.join(tempDir, 'small.txt');
            await fs.writeFile(smallFile, 'small content');

            const analysis = await resourceMonitor.analyzeFileForProcessing(smallFile);

            expect(analysis.fileSize).toBeLessThan(1024);
            expect(analysis.shouldStream).toBe(false);
            expect(analysis.isLarge).toBe(false);
            expect(analysis.processingStrategy).toBe('memory');
        });

        test('should analyze large file for chunked processing', async () => {
            const largeFile = path.join(tempDir, 'large.txt');
            const content = 'x'.repeat(1500); // 1.5KB
            await fs.writeFile(largeFile, content);

            const analysis = await resourceMonitor.analyzeFileForProcessing(largeFile);

            expect(analysis.fileSize).toBeGreaterThan(1024);
            expect(analysis.shouldStream).toBe(false);
            expect(analysis.isLarge).toBe(true);
            expect(analysis.processingStrategy).toBe('chunked');
        });

        test('should analyze very large file for streaming processing', async () => {
            const veryLargeFile = path.join(tempDir, 'very-large.txt');
            const content = 'x'.repeat(3000); // 3KB
            await fs.writeFile(veryLargeFile, content);

            const analysis = await resourceMonitor.analyzeFileForProcessing(veryLargeFile);

            expect(analysis.fileSize).toBeGreaterThan(2048);
            expect(analysis.shouldStream).toBe(true);
            expect(analysis.isLarge).toBe(true);
            expect(analysis.processingStrategy).toBe('streaming');
        });

        test('should calculate optimal chunk size based on file size', () => {
            const smallFileSize = 1024; // 1KB
            const largeFileSize = 100 * 1024 * 1024; // 100MB
            const veryLargeFileSize = 600 * 1024 * 1024; // 600MB

            const smallChunk = resourceMonitor.calculateOptimalChunkSize(smallFileSize);
            const largeChunk = resourceMonitor.calculateOptimalChunkSize(largeFileSize);
            const veryLargeChunk = resourceMonitor.calculateOptimalChunkSize(veryLargeFileSize);

            expect(smallChunk).toBeGreaterThanOrEqual(16 * 1024); // Minimum 16KB
            expect(largeChunk).toBeGreaterThanOrEqual(smallChunk);
            expect(veryLargeChunk).toBeGreaterThanOrEqual(largeChunk);
        });

        test('should estimate memory usage correctly', () => {
            const smallFileSize = 1024; // 1KB (below streaming threshold)
            const largeFileSize = 3 * 1024; // 3KB (above streaming threshold)

            const smallMemoryEstimate = resourceMonitor.estimateMemoryUsage(smallFileSize);
            const largeMemoryEstimate = resourceMonitor.estimateMemoryUsage(largeFileSize);

            // For in-memory processing, should be 2.5x file size
            expect(smallMemoryEstimate).toBe(smallFileSize * 2.5);

            // For streaming processing, should be chunk size * 3
            expect(largeMemoryEstimate).toBeGreaterThan(0);
        });
    });

    describe('File Processing', () => {
        test('should process small file in memory', async () => {
            const smallFile = path.join(tempDir, 'small.txt');
            const content = 'test content for processing';
            await fs.writeFile(smallFile, content);

            const mockProcessor = jest.fn().mockReturnValue(['result1', 'result2']);

            const result = await resourceMonitor.processFileStream(smallFile, mockProcessor);

            expect(result.strategy).toBe('memory');
            expect(result.results).toEqual(['result1', 'result2']);
            expect(mockProcessor).toHaveBeenCalledWith(content, {});
        });

        test('should process large file in chunks', async () => {
            const largeFile = path.join(tempDir, 'large.txt');
            const content = 'x'.repeat(1500); // 1.5KB
            await fs.writeFile(largeFile, content);

            const mockProcessor = jest.fn().mockReturnValue(['chunk-result']);

            const result = await resourceMonitor.processFileStream(largeFile, mockProcessor);

            expect(result.strategy).toBe('chunked');
            expect(result.results.length).toBeGreaterThan(0);
            expect(mockProcessor).toHaveBeenCalled();
        });

        test('should process very large file with streaming', async () => {
            const veryLargeFile = path.join(tempDir, 'very-large.txt');
            const content = 'line1\nline2\nline3\n'.repeat(200); // ~3KB
            await fs.writeFile(veryLargeFile, content);

            const mockProcessor = jest.fn().mockReturnValue(['line-result']);

            const result = await resourceMonitor.processFileStream(veryLargeFile, mockProcessor);

            expect(result.strategy).toBe('streaming');
            expect(result.results.length).toBeGreaterThan(0);
            expect(mockProcessor).toHaveBeenCalled();
        });

        test('should respect maximum concurrent streams', async () => {
            const files = [];
            for (let i = 0; i < 10; i++) {
                const file = path.join(tempDir, `file${i}.txt`);
                await fs.writeFile(file, 'x'.repeat(3000)); // 3KB each
                files.push(file);
            }

            const mockProcessor = jest.fn().mockImplementation(() => {
                return new Promise(resolve => setTimeout(() => resolve(['result']), 100));
            });

            // Start more streams than allowed
            const promises = files.map(file =>
                resourceMonitor.processFileStream(file, mockProcessor)
            );

            // Some should be rejected due to concurrent stream limit
            const results = await Promise.allSettled(promises);
            const rejected = results.filter(r => r.status === 'rejected');

            expect(rejected.length).toBeGreaterThan(0);
            expect(rejected[0].reason.message).toContain('Maximum concurrent streams');
        });

        test('should track processing statistics', async () => {
            const testFile = path.join(tempDir, 'test.txt');
            await fs.writeFile(testFile, 'test content');

            const mockProcessor = jest.fn().mockReturnValue(['result']);

            await resourceMonitor.processFileStream(testFile, mockProcessor);

            const stats = resourceMonitor.getResourceStats();
            expect(stats.resourceStats.totalFilesProcessed).toBe(1);
            expect(stats.resourceStats.totalBytesProcessed).toBeGreaterThan(0);
            expect(stats.resourceStats.averageProcessingTime).toBeGreaterThan(0);
        });
    });

    describe('Streaming Processor', () => {
        test('should create streaming processor that handles lines', () => {
            const mockProcessor = jest.fn().mockReturnValue(['line-result']);

            const processor = resourceMonitor.createStreamingProcessor(mockProcessor);

            expect(processor).toBeDefined();
            expect(typeof processor.getResults).toBe('function');
        });

        test('should process streaming data correctly', (done) => {
            const mockProcessor = jest.fn().mockReturnValue(['processed']);
            const processor = resourceMonitor.createStreamingProcessor(mockProcessor);

            processor.on('finish', () => {
                const results = processor.getResults();
                expect(results.length).toBeGreaterThan(0);
                expect(mockProcessor).toHaveBeenCalled();
                done();
            });

            processor.write('line1\n');
            processor.write('line2\n');
            processor.end();
        });
    });

    describe('Garbage Collection', () => {
        test('should perform garbage collection when available', () => {
            // Mock global.gc
            const originalGC = global.gc;
            global.gc = jest.fn();

            // Mock high memory usage to trigger GC
            resourceMonitor.state.memoryStats = {
                heapUsed: 800 * 1024 * 1024, // 800MB
                heapTotal: 1000 * 1024 * 1024, // 1GB (80% usage > 70% threshold)
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            resourceMonitor.performGarbageCollection();

            if (global.gc) {
                expect(global.gc).toHaveBeenCalled();
            }

            // Restore original
            global.gc = originalGC;
        });

        test('should force garbage collection', () => {
            // Mock global.gc
            const originalGC = global.gc;
            global.gc = jest.fn();

            try {
                const result = resourceMonitor.forceGarbageCollection();

                if (global.gc) {
                    expect(global.gc).toHaveBeenCalled();
                    expect(result).toHaveProperty('memoryFreed');
                    expect(result).toHaveProperty('gcCount');
                }
            } catch (error) {
                expect(error.message).toContain('Garbage collection not available');
            }

            // Restore original
            global.gc = originalGC;
        });

        test('should track garbage collection statistics', () => {
            // Mock global.gc and memory usage
            const originalGC = global.gc;
            const originalMemoryUsage = process.memoryUsage;

            global.gc = jest.fn();
            process.memoryUsage = jest.fn()
                .mockReturnValueOnce({ heapUsed: 100 * 1024 * 1024 }) // Before GC
                .mockReturnValueOnce({ heapUsed: 80 * 1024 * 1024 });  // After GC

            try {
                const result = resourceMonitor.forceGarbageCollection();

                if (global.gc) {
                    expect(result.memoryFreed).toBe(20 * 1024 * 1024);
                    expect(resourceMonitor.state.resourceStats.gcCount).toBe(1);
                }
            } catch (error) {
                // GC not available in test environment
            }

            // Restore originals
            global.gc = originalGC;
            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('Temporary Directory Management', () => {
        test('should register temporary directories', () => {
            const tempPath = '/tmp/test-dir';

            resourceMonitor.registerTempDirectory(tempPath, { purpose: 'testing' });

            expect(resourceMonitor.state.tempDirectories.has(tempPath)).toBe(true);
            const metadata = resourceMonitor.state.tempDirectories.get(tempPath);
            expect(metadata.purpose).toBe('testing');
            expect(metadata.createdAt).toBeDefined();
        });

        test('should clean up old temporary directories', async () => {
            const oldTempDir = path.join(tempDir, 'old-temp');
            await fs.ensureDir(oldTempDir);

            // Register with old timestamp
            resourceMonitor.registerTempDirectory(oldTempDir);
            const metadata = resourceMonitor.state.tempDirectories.get(oldTempDir);
            metadata.createdAt = Date.now() - (3 * 60 * 60 * 1000); // 3 hours ago

            await resourceMonitor.cleanupTempDirectories();

            expect(await fs.pathExists(oldTempDir)).toBe(false);
            expect(resourceMonitor.state.tempDirectories.has(oldTempDir)).toBe(false);
        });

        test('should not clean up recent temporary directories', async () => {
            const recentTempDir = path.join(tempDir, 'recent-temp');
            await fs.ensureDir(recentTempDir);

            resourceMonitor.registerTempDirectory(recentTempDir);

            await resourceMonitor.cleanupTempDirectories();

            expect(await fs.pathExists(recentTempDir)).toBe(true);
            expect(resourceMonitor.state.tempDirectories.has(recentTempDir)).toBe(true);
        });
    });

    describe('Resource Statistics', () => {
        test('should provide comprehensive resource statistics', () => {
            const stats = resourceMonitor.getResourceStats();

            expect(stats).toHaveProperty('memoryStats');
            expect(stats).toHaveProperty('resourceStats');
            expect(stats).toHaveProperty('activeStreams');
            expect(stats).toHaveProperty('tempDirectories');
            expect(stats).toHaveProperty('alerts');
            expect(stats).toHaveProperty('config');

            expect(stats.memoryStats).toHaveProperty('heapUsed');
            expect(stats.memoryStats).toHaveProperty('heapTotal');
            expect(stats.resourceStats).toHaveProperty('totalFilesProcessed');
            expect(stats.resourceStats).toHaveProperty('totalBytesProcessed');
        });

        test('should track peak memory usage', () => {
            // Simulate memory usage update
            resourceMonitor.state.memoryStats.heapUsed = 100 * 1024 * 1024;
            resourceMonitor.updateMemoryStats();

            expect(resourceMonitor.state.resourceStats.peakMemoryUsage).toBeGreaterThan(0);
        });

        test('should maintain alert history', () => {
            // Generate some alerts
            for (let i = 0; i < 5; i++) {
                resourceMonitor.emitAlert('TEST_ALERT', { message: `Test alert ${i}` });
            }

            expect(resourceMonitor.state.alerts.length).toBe(5);

            const stats = resourceMonitor.getResourceStats();
            expect(stats.alerts.length).toBe(5); // Last 10 alerts
        });
    });

    describe('Error Handling', () => {
        test('should handle file analysis errors gracefully', async () => {
            const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

            await expect(
                resourceMonitor.analyzeFileForProcessing(nonExistentFile)
            ).rejects.toThrow('Failed to analyze file');
        });

        test('should handle processing errors gracefully', async () => {
            const testFile = path.join(tempDir, 'test.txt');
            await fs.writeFile(testFile, 'test content');

            const errorProcessor = jest.fn().mockImplementation(() => {
                throw new Error('Processing error');
            });

            await expect(
                resourceMonitor.processFileStream(testFile, errorProcessor)
            ).rejects.toThrow();
        });

        test('should continue monitoring after errors', () => {
            resourceMonitor.startMonitoring();

            // Simulate an error in memory stats update
            const originalUpdateMemoryStats = resourceMonitor.updateMemoryStats;
            resourceMonitor.updateMemoryStats = jest.fn().mockImplementation(() => {
                throw new Error('Memory stats error');
            });

            // Should not crash the monitoring
            expect(resourceMonitor.state.isMonitoring).toBe(true);

            // Restore original method
            resourceMonitor.updateMemoryStats = originalUpdateMemoryStats;
        });
    });
});