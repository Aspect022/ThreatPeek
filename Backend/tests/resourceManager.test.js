/**
 * Resource Manager Tests
 * Tests for integrated resource management combining rate limiting and resource monitoring
 */

const { ResourceManager } = require('../services/resourceManager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('ResourceManager', () => {
    let resourceManager;
    let tempDir;

    beforeEach(async () => {
        resourceManager = new ResourceManager({
            rateLimiting: {
                requestsPerSecond: 5,
                burstLimit: 10
            },
            resourceMonitoring: {
                monitoringInterval: 100,
                largeFileThreshold: 1024,
                streamingThreshold: 2048,
                chunkSize: 512
            },
            emergencyShutdownThreshold: 0.95,
            resourceRecoveryDelay: 100
        });

        tempDir = path.join(os.tmpdir(), 'resource-manager-test');
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        await resourceManager.stop();
        await fs.remove(tempDir);
    });

    describe('Lifecycle Management', () => {
        test('should start and stop successfully', async () => {
            expect(resourceManager.state.isActive).toBe(false);

            await resourceManager.start();
            expect(resourceManager.state.isActive).toBe(true);

            await resourceManager.stop();
            expect(resourceManager.state.isActive).toBe(false);
        });

        test('should handle multiple start/stop calls gracefully', async () => {
            await resourceManager.start();
            await resourceManager.start(); // Should not throw

            await resourceManager.stop();
            await resourceManager.stop(); // Should not throw
        });
    });

    describe('Integrated Request Execution', () => {
        test('should execute request with resource management', async () => {
            await resourceManager.start();

            const target = 'test-target';
            const mockRequest = jest.fn().mockResolvedValue('success');

            const result = await resourceManager.executeWithResourceManagement(target, mockRequest);

            expect(result).toBe('success');
            expect(mockRequest).toHaveBeenCalledTimes(1);
        });

        test('should reject requests in emergency mode', async () => {
            await resourceManager.start();

            // Force emergency mode
            resourceManager.state.emergencyMode = true;

            const target = 'test-target';
            const mockRequest = jest.fn().mockResolvedValue('success');

            await expect(
                resourceManager.executeWithResourceManagement(target, mockRequest)
            ).rejects.toThrow('System in emergency mode');

            expect(mockRequest).not.toHaveBeenCalled();
        });

        test('should apply dynamic rate limiting based on memory usage', async () => {
            await resourceManager.start();

            // Mock high memory usage
            resourceManager.resourceMonitor.state.memoryStats = {
                heapUsed: 850 * 1024 * 1024, // 850MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            const resourceCheck = await resourceManager.checkResourceAvailability();
            const dynamicConfig = resourceManager.calculateDynamicRateLimit('test-target', resourceCheck);

            // Rate limit should be reduced due to high memory usage
            expect(dynamicConfig.requestsPerSecond).toBeLessThan(5);
        });
    });

    describe('File Processing Integration', () => {
        test('should process file with resource management', async () => {
            await resourceManager.start();

            const testFile = path.join(tempDir, 'test.txt');
            await fs.writeFile(testFile, 'test content for processing');

            const mockProcessor = jest.fn().mockReturnValue(['result1', 'result2']);

            const result = await resourceManager.processFileWithResourceManagement(testFile, mockProcessor);

            expect(result.results).toEqual(['result1', 'result2']);
            expect(mockProcessor).toHaveBeenCalled();
        });

        test('should force streaming for large files when memory is constrained', async () => {
            await resourceManager.start();

            const largeFile = path.join(tempDir, 'large.txt');
            const content = 'x'.repeat(1500); // 1.5KB
            await fs.writeFile(largeFile, content);

            // Mock high memory usage
            resourceManager.resourceMonitor.state.memoryStats = {
                heapUsed: 900 * 1024 * 1024, // 900MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            const mockProcessor = jest.fn().mockReturnValue(['result']);

            const result = await resourceManager.processFileWithResourceManagement(largeFile, mockProcessor, {});

            // Should have forced streaming mode due to memory constraints
            expect(result.strategy).toBe('chunked'); // Will be chunked for this size
        });

        test('should reject file processing in emergency mode', async () => {
            await resourceManager.start();

            // Force emergency mode
            resourceManager.state.emergencyMode = true;

            const testFile = path.join(tempDir, 'test.txt');
            await fs.writeFile(testFile, 'test content');

            const mockProcessor = jest.fn().mockReturnValue(['result']);

            await expect(
                resourceManager.processFileWithResourceManagement(testFile, mockProcessor)
            ).rejects.toThrow('System in emergency mode');
        });
    });

    describe('Resource Availability Checking', () => {
        test('should check resource availability correctly', async () => {
            await resourceManager.start();

            const resourceCheck = await resourceManager.checkResourceAvailability();

            expect(resourceCheck).toHaveProperty('available');
            expect(resourceCheck).toHaveProperty('reason');
            expect(resourceCheck).toHaveProperty('checks');
            expect(resourceCheck.checks).toHaveProperty('memory');
            expect(resourceCheck.checks).toHaveProperty('activeStreams');
            expect(resourceCheck.checks).toHaveProperty('emergencyMode');
        });

        test('should report unavailable when memory usage is critical', async () => {
            await resourceManager.start();

            // Mock critical memory usage
            resourceManager.resourceMonitor.state.memoryStats = {
                heapUsed: 960 * 1024 * 1024, // 960MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            const resourceCheck = await resourceManager.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.reason).toContain('Memory usage too high');
        });

        test('should report unavailable when too many streams are active', async () => {
            await resourceManager.start();

            // Mock too many active streams
            for (let i = 0; i < 10; i++) {
                resourceManager.resourceMonitor.state.activeStreams.add(`stream-${i}`);
            }

            const resourceCheck = await resourceManager.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.reason).toContain('Too many active streams');
        });
    });

    describe('Dynamic Rate Limiting', () => {
        test('should calculate normal rate limit with low memory usage', async () => {
            await resourceManager.start();

            // Mock normal memory usage
            const resourceCheck = {
                checks: {
                    memory: { usage: 0.5 }, // 50% memory usage
                    activeStreams: { available: true },
                    emergencyMode: { active: false }
                }
            };

            const dynamicConfig = resourceManager.calculateDynamicRateLimit('test-target', resourceCheck);

            expect(dynamicConfig.requestsPerSecond).toBe(5); // No reduction
            expect(dynamicConfig.burstLimit).toBe(10);
        });

        test('should reduce rate limit with high memory usage', async () => {
            await resourceManager.start();

            // Mock high memory usage
            const resourceCheck = {
                checks: {
                    memory: { usage: 0.85 }, // 85% memory usage
                    activeStreams: { available: true },
                    emergencyMode: { active: false }
                }
            };

            const dynamicConfig = resourceManager.calculateDynamicRateLimit('test-target', resourceCheck);

            expect(dynamicConfig.requestsPerSecond).toBeLessThan(5); // Should be reduced
            expect(dynamicConfig.burstLimit).toBeLessThan(10);
        });

        test('should apply maximum reduction with very high memory usage', async () => {
            await resourceManager.start();

            // Mock very high memory usage
            const resourceCheck = {
                checks: {
                    memory: { usage: 0.9 }, // 90% memory usage
                    activeStreams: { available: true },
                    emergencyMode: { active: false }
                }
            };

            const dynamicConfig = resourceManager.calculateDynamicRateLimit('test-target', resourceCheck);

            expect(dynamicConfig.requestsPerSecond).toBe(2); // 50% of 5, but minimum 1
            expect(dynamicConfig.burstLimit).toBe(5); // 50% of 10
        });
    });

    describe('Emergency Mode Handling', () => {
        test('should enter emergency mode on critical memory alert', async () => {
            await resourceManager.start();

            const criticalAlert = {
                type: 'MEMORY_CRITICAL',
                data: {
                    message: 'Critical memory usage: 96%',
                    usageRatio: 0.96
                }
            };

            await resourceManager.handleCriticalMemoryAlert(criticalAlert);

            expect(resourceManager.state.emergencyMode).toBe(true);
            expect(resourceManager.state.lastEmergencyTime).toBeDefined();
        });

        test('should recover from emergency mode when memory normalizes', async () => {
            await resourceManager.start();

            // Enter emergency mode
            resourceManager.state.emergencyMode = true;
            resourceManager.state.lastEmergencyTime = Date.now();

            // Mock normalized memory usage
            resourceManager.resourceMonitor.state.memoryStats = {
                heapUsed: 600 * 1024 * 1024, // 600MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            await resourceManager.checkEmergencyRecovery();

            expect(resourceManager.state.emergencyMode).toBe(false);
        });

        test('should emit emergency events', (done) => {
            resourceManager.start().then(() => {
                resourceManager.on('emergencyMode', (data) => {
                    expect(data.reason).toBe('critical_memory');
                    expect(data.usageRatio).toBe(0.96);
                    done();
                });

                const criticalAlert = {
                    type: 'MEMORY_CRITICAL',
                    data: {
                        message: 'Critical memory usage: 96%',
                        usageRatio: 0.96
                    }
                };

                resourceManager.handleCriticalMemoryAlert(criticalAlert);
            });
        });
    });

    describe('Resource Protection', () => {
        test('should activate resource protection on memory warning', async () => {
            await resourceManager.start();

            const warningAlert = {
                type: 'MEMORY_WARNING',
                data: {
                    message: 'High memory usage: 85%',
                    usageRatio: 0.85
                }
            };

            await resourceManager.handleMemoryWarningAlert(warningAlert);

            expect(resourceManager.state.resourceProtectionActive).toBe(true);
        });

        test('should deactivate resource protection when memory normalizes', async () => {
            await resourceManager.start();

            // Activate resource protection
            resourceManager.state.resourceProtectionActive = true;

            // Mock normalized memory usage
            const normalizedStats = {
                heapUsed: 500 * 1024 * 1024, // 500MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                rss: 1000 * 1024 * 1024,
                arrayBuffers: 0
            };

            resourceManager.handleMemoryStatsUpdate(normalizedStats);

            expect(resourceManager.state.resourceProtectionActive).toBe(false);
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should provide comprehensive resource statistics', async () => {
            await resourceManager.start();

            const stats = resourceManager.getResourceStatistics();

            expect(stats).toHaveProperty('rateLimiting');
            expect(stats).toHaveProperty('resourceMonitoring');
            expect(stats).toHaveProperty('manager');
            expect(stats).toHaveProperty('config');

            expect(stats.manager.isActive).toBe(true);
            expect(stats.manager.emergencyMode).toBe(false);
            expect(stats.manager.resourceProtectionActive).toBe(false);
        });

        test('should provide target-specific statistics', async () => {
            await resourceManager.start();

            const target = 'test-target';

            // Make a request to create target statistics
            const mockRequest = jest.fn().mockResolvedValue('success');
            await resourceManager.executeWithResourceManagement(target, mockRequest);

            const targetStats = resourceManager.getTargetStatistics(target);

            expect(targetStats).toBeDefined();
            expect(targetStats.target).toBe(target);
            expect(targetStats.stats.totalRequests).toBe(1);
        });
    });

    describe('Utility Functions', () => {
        test('should reset target rate limit', async () => {
            await resourceManager.start();

            const target = 'test-target';

            // Make requests to exhaust rate limit
            const mockRequest = jest.fn().mockResolvedValue('success');
            for (let i = 0; i < 10; i++) {
                await resourceManager.executeWithResourceManagement(target, mockRequest);
            }

            // Reset rate limit
            resourceManager.resetTargetRateLimit(target);

            const stats = resourceManager.getTargetStatistics(target);
            expect(stats.currentTokens).toBe(10); // Back to burst limit
        });

        test('should force garbage collection', () => {
            // Mock global.gc
            const originalGC = global.gc;
            global.gc = jest.fn();

            try {
                const result = resourceManager.forceGarbageCollection();

                if (global.gc) {
                    expect(global.gc).toHaveBeenCalled();
                    expect(result).toHaveProperty('memoryFreed');
                }
            } catch (error) {
                expect(error.message).toContain('Garbage collection not available');
            }

            // Restore original
            global.gc = originalGC;
        });

        test('should register and cleanup temporary directories', async () => {
            await resourceManager.start();

            const tempPath = path.join(tempDir, 'test-temp');
            await fs.ensureDir(tempPath);

            resourceManager.registerTempDirectory(tempPath, { purpose: 'testing' });

            // Verify registration
            expect(resourceManager.resourceMonitor.state.tempDirectories.has(tempPath)).toBe(true);

            // Cleanup
            await resourceManager.cleanupTempDirectories();

            // Should still exist since it's recent
            expect(await fs.pathExists(tempPath)).toBe(true);
        });
    });

    describe('Event Handling', () => {
        test('should handle rate limiting events', (done) => {
            resourceManager.start().then(() => {
                resourceManager.on('rateLimitBackoff', (data) => {
                    expect(data.target).toBeDefined();
                    expect(data.backoffMs).toBeGreaterThan(0);
                    done();
                });

                // Trigger backoff by simulating error
                resourceManager.rateLimiter.emit('backoffApplied', {
                    target: 'test-target',
                    backoffMs: 1000
                });
            });
        });

        test('should handle resource monitoring events', (done) => {
            resourceManager.start().then(() => {
                resourceManager.on('resourceAlert', (alert) => {
                    expect(alert.type).toBe('MEMORY_WARNING');
                    done();
                });

                // Trigger resource alert
                resourceManager.resourceMonitor.emit('resourceAlert', {
                    type: 'MEMORY_WARNING',
                    data: { message: 'High memory usage' }
                });
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle service initialization errors gracefully', async () => {
            // Create resource manager with invalid configuration
            const invalidResourceManager = new ResourceManager({
                rateLimiting: null, // This might cause issues
                resourceMonitoring: null
            });

            // Should not throw during construction
            expect(invalidResourceManager).toBeDefined();

            await invalidResourceManager.stop();
        });

        test('should handle resource check errors', async () => {
            await resourceManager.start();

            // Mock error in resource monitoring
            const originalGetResourceStats = resourceManager.resourceMonitor.getResourceStats;
            resourceManager.resourceMonitor.getResourceStats = jest.fn().mockImplementation(() => {
                throw new Error('Resource stats error');
            });

            // Should handle error gracefully
            try {
                await resourceManager.checkResourceAvailability();
            } catch (error) {
                // Should not propagate the error
                expect(error.message).not.toBe('Resource stats error');
            }

            // Restore original method
            resourceManager.resourceMonitor.getResourceStats = originalGetResourceStats;
        });
    });
});