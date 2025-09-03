/**
 * Repository Scanner Resource Management Unit Tests
 * Tests for the specific resource management methods
 */

describe('Repository Scanner Resource Management - Unit Tests', () => {
    let scanner;

    beforeEach(() => {
        // Create a test instance with the resource management methods
        scanner = {
            maxRepoSizeBytes: 500 * 1024 * 1024, // 500MB
            maxTempDirSize: 2 * 1024 * 1024 * 1024, // 2GB
            maxConcurrentScans: 5,
            maxScanAge: 2 * 60 * 60 * 1000, // 2 hours
            activeScans: new Map(),
            resourceMonitor: {
                diskUsage: 0,
                activeScanCount: 0,
                lastCleanup: Date.now(),
                totalScansStarted: 0,
                totalScansCompleted: 0,
                totalScansFailed: 0,
                totalBytesProcessed: 0
            },

            // Resource management methods
            async checkResourceAvailability() {
                const currentDiskUsage = this.resourceMonitor.diskUsage;
                const activeScanCount = this.activeScans.size;

                const checks = {
                    diskSpace: {
                        available: currentDiskUsage < this.maxTempDirSize * 0.9,
                        current: currentDiskUsage,
                        limit: this.maxTempDirSize,
                        message: currentDiskUsage >= this.maxTempDirSize * 0.9
                            ? `Disk usage (${Math.round(currentDiskUsage / 1024 / 1024)}MB) approaching limit (${Math.round(this.maxTempDirSize / 1024 / 1024)}MB)`
                            : 'Disk space available'
                    },
                    concurrentScans: {
                        available: activeScanCount < this.maxConcurrentScans,
                        current: activeScanCount,
                        limit: this.maxConcurrentScans,
                        message: activeScanCount >= this.maxConcurrentScans
                            ? `Maximum concurrent scans (${this.maxConcurrentScans}) reached`
                            : 'Concurrent scan slots available'
                    }
                };

                const allAvailable = checks.diskSpace.available && checks.concurrentScans.available;

                return {
                    available: allAvailable,
                    checks,
                    message: allAvailable
                        ? 'Resources available for new scan'
                        : 'Resource limits reached - scan may be queued or rejected'
                };
            },

            async cleanupRepository(scanId) {
                const scanInfo = this.activeScans.get(scanId);
                if (!scanInfo) {
                    return false;
                }

                try {
                    // Get directory size before cleanup for monitoring
                    const dirSize = scanInfo.size || 0;

                    // Simulate cleanup
                    this.activeScans.delete(scanId);

                    // Update resource monitoring
                    this.resourceMonitor.diskUsage = Math.max(0, this.resourceMonitor.diskUsage - dirSize);
                    this.resourceMonitor.activeScanCount = Math.max(0, this.resourceMonitor.activeScanCount - 1);

                    return true;
                } catch (error) {
                    return false;
                }
            },

            async getDirectorySize(dirPath) {
                // Mock implementation for testing
                if (dirPath.includes('large')) return 600 * 1024 * 1024; // 600MB
                if (dirPath.includes('small')) return 50 * 1024 * 1024; // 50MB
                if (dirPath.includes('empty')) return 0;
                return 100 * 1024 * 1024; // 100MB default
            },

            getResourceStats() {
                return {
                    ...this.resourceMonitor,
                    limits: {
                        maxConcurrentScans: this.maxConcurrentScans,
                        maxTempDirSize: this.maxTempDirSize,
                        maxRepoSize: this.maxRepoSizeBytes,
                        scanTimeout: 10 * 60 * 1000
                    },
                    formattedStats: {
                        diskUsage: `${Math.round(this.resourceMonitor.diskUsage / 1024 / 1024)}MB`,
                        diskUsagePercent: Math.round((this.resourceMonitor.diskUsage / this.maxTempDirSize) * 100),
                        activeScanCount: this.resourceMonitor.activeScanCount,
                        totalBytesProcessed: `${Math.round(this.resourceMonitor.totalBytesProcessed / 1024 / 1024)}MB`
                    }
                };
            },

            createError(code, message, details = {}) {
                const error = new Error(message);
                error.code = code;
                error.details = details;
                error.timestamp = new Date().toISOString();
                return error;
            }
        };
    });

    describe('Resource Availability Checking', () => {
        test('should check resource availability correctly', async () => {
            const result = await scanner.checkResourceAvailability();

            expect(result).toHaveProperty('available');
            expect(result).toHaveProperty('checks');
            expect(result).toHaveProperty('message');
            expect(typeof result.available).toBe('boolean');
            expect(result.checks).toHaveProperty('diskSpace');
            expect(result.checks).toHaveProperty('concurrentScans');
        });

        test('should detect disk space limit exceeded', async () => {
            // Set disk usage to 95% of limit
            scanner.resourceMonitor.diskUsage = scanner.maxTempDirSize * 0.95;

            const result = await scanner.checkResourceAvailability();

            expect(result.available).toBe(false);
            expect(result.checks.diskSpace.available).toBe(false);
            expect(result.message).toContain('Resource limits reached');
        });

        test('should detect concurrent scan limit exceeded', async () => {
            // Add maximum number of concurrent scans
            for (let i = 0; i < scanner.maxConcurrentScans; i++) {
                scanner.activeScans.set(`scan-${i}`, {
                    path: `/tmp/scan-${i}`,
                    startTime: Date.now(),
                    size: 10 * 1024 * 1024
                });
            }

            const result = await scanner.checkResourceAvailability();

            expect(result.available).toBe(false);
            expect(result.checks.concurrentScans.available).toBe(false);
            expect(result.checks.concurrentScans.current).toBe(scanner.maxConcurrentScans);
        });

        test('should allow scan when resources are available', async () => {
            // Ensure clean state
            scanner.activeScans.clear();
            scanner.resourceMonitor.diskUsage = 100 * 1024 * 1024; // 100MB

            const result = await scanner.checkResourceAvailability();

            expect(result.available).toBe(true);
            expect(result.checks.diskSpace.available).toBe(true);
            expect(result.checks.concurrentScans.available).toBe(true);
            expect(result.message).toBe('Resources available for new scan');
        });
    });

    describe('Repository Size Validation', () => {
        test('should detect oversized repository', async () => {
            const largeRepoSize = await scanner.getDirectorySize('/tmp/large-repo');

            expect(largeRepoSize).toBeGreaterThan(scanner.maxRepoSizeBytes);
            expect(largeRepoSize).toBe(600 * 1024 * 1024); // 600MB
        });

        test('should accept normal sized repository', async () => {
            const smallRepoSize = await scanner.getDirectorySize('/tmp/small-repo');

            expect(smallRepoSize).toBeLessThan(scanner.maxRepoSizeBytes);
            expect(smallRepoSize).toBe(50 * 1024 * 1024); // 50MB
        });

        test('should handle empty repository', async () => {
            const emptyRepoSize = await scanner.getDirectorySize('/tmp/empty-repo');

            expect(emptyRepoSize).toBe(0);
        });
    });

    describe('Cleanup Logic', () => {
        test('should cleanup repository successfully', async () => {
            const scanId = 'test-scan-123';
            const scanSize = 100 * 1024 * 1024; // 100MB

            // Add scan to active scans
            scanner.activeScans.set(scanId, {
                path: '/tmp/test-scan-123',
                startTime: Date.now(),
                size: scanSize
            });
            scanner.resourceMonitor.diskUsage = scanSize;
            scanner.resourceMonitor.activeScanCount = 1;

            const initialDiskUsage = scanner.resourceMonitor.diskUsage;
            const initialScanCount = scanner.resourceMonitor.activeScanCount;

            const result = await scanner.cleanupRepository(scanId);

            expect(result).toBe(true);
            expect(scanner.activeScans.has(scanId)).toBe(false);
            expect(scanner.resourceMonitor.diskUsage).toBe(initialDiskUsage - scanSize);
            expect(scanner.resourceMonitor.activeScanCount).toBe(initialScanCount - 1);
        });

        test('should handle cleanup of non-existent scan', async () => {
            const result = await scanner.cleanupRepository('non-existent-scan');
            expect(result).toBe(false);
        });

        test('should prevent negative resource counts', async () => {
            const scanId = 'test-scan-456';
            const scanSize = 200 * 1024 * 1024; // 200MB

            // Set initial values lower than scan size
            scanner.resourceMonitor.diskUsage = 100 * 1024 * 1024; // 100MB
            scanner.resourceMonitor.activeScanCount = 0;

            scanner.activeScans.set(scanId, {
                path: '/tmp/test-scan-456',
                startTime: Date.now(),
                size: scanSize
            });

            await scanner.cleanupRepository(scanId);

            // Should not go negative
            expect(scanner.resourceMonitor.diskUsage).toBeGreaterThanOrEqual(0);
            expect(scanner.resourceMonitor.activeScanCount).toBeGreaterThanOrEqual(0);
        });

        test('should handle multiple cleanup operations', async () => {
            const scans = [
                { id: 'scan-1', size: 50 * 1024 * 1024 },
                { id: 'scan-2', size: 75 * 1024 * 1024 },
                { id: 'scan-3', size: 25 * 1024 * 1024 }
            ];

            // Add all scans
            let totalSize = 0;
            scans.forEach(scan => {
                scanner.activeScans.set(scan.id, {
                    path: `/tmp/${scan.id}`,
                    startTime: Date.now(),
                    size: scan.size
                });
                totalSize += scan.size;
            });

            scanner.resourceMonitor.diskUsage = totalSize;
            scanner.resourceMonitor.activeScanCount = scans.length;

            // Cleanup all scans
            for (const scan of scans) {
                const result = await scanner.cleanupRepository(scan.id);
                expect(result).toBe(true);
            }

            expect(scanner.activeScans.size).toBe(0);
            expect(scanner.resourceMonitor.diskUsage).toBe(0);
            expect(scanner.resourceMonitor.activeScanCount).toBe(0);
        });
    });

    describe('Resource Statistics', () => {
        test('should provide comprehensive resource statistics', () => {
            scanner.resourceMonitor.diskUsage = 500 * 1024 * 1024; // 500MB
            scanner.resourceMonitor.activeScanCount = 3;
            scanner.resourceMonitor.totalBytesProcessed = 1024 * 1024 * 1024; // 1GB
            scanner.resourceMonitor.totalScansStarted = 10;
            scanner.resourceMonitor.totalScansCompleted = 8;
            scanner.resourceMonitor.totalScansFailed = 2;

            const stats = scanner.getResourceStats();

            expect(stats).toHaveProperty('diskUsage', 500 * 1024 * 1024);
            expect(stats).toHaveProperty('activeScanCount', 3);
            expect(stats).toHaveProperty('totalScansStarted', 10);
            expect(stats).toHaveProperty('totalScansCompleted', 8);
            expect(stats).toHaveProperty('totalScansFailed', 2);
            expect(stats).toHaveProperty('limits');
            expect(stats).toHaveProperty('formattedStats');
        });

        test('should format statistics correctly', () => {
            scanner.resourceMonitor.diskUsage = 1536 * 1024 * 1024; // 1.5GB
            scanner.resourceMonitor.totalBytesProcessed = 2048 * 1024 * 1024; // 2GB

            const stats = scanner.getResourceStats();

            expect(stats.formattedStats.diskUsage).toBe('1536MB');
            expect(stats.formattedStats.totalBytesProcessed).toBe('2048MB');
            expect(stats.formattedStats.diskUsagePercent).toBe(75); // 1.5GB / 2GB * 100
        });

        test('should include all required limits', () => {
            const stats = scanner.getResourceStats();

            expect(stats.limits).toHaveProperty('maxConcurrentScans', 5);
            expect(stats.limits).toHaveProperty('maxTempDirSize', 2 * 1024 * 1024 * 1024);
            expect(stats.limits).toHaveProperty('maxRepoSize', 500 * 1024 * 1024);
            expect(stats.limits).toHaveProperty('scanTimeout', 10 * 60 * 1000);
        });
    });

    describe('Error Creation', () => {
        test('should create structured errors', () => {
            const error = scanner.createError(
                'TEST_ERROR',
                'This is a test error',
                { testDetail: 'test value' }
            );

            expect(error).toBeInstanceOf(Error);
            expect(error.code).toBe('TEST_ERROR');
            expect(error.message).toBe('This is a test error');
            expect(error.details).toEqual({ testDetail: 'test value' });
            expect(error.timestamp).toBeDefined();
        });

        test('should create error without details', () => {
            const error = scanner.createError('SIMPLE_ERROR', 'Simple error message');

            expect(error.code).toBe('SIMPLE_ERROR');
            expect(error.message).toBe('Simple error message');
            expect(error.details).toEqual({});
        });
    });

    describe('Resource Limit Scenarios', () => {
        test('should handle edge case at exact limits', async () => {
            // Set disk usage to exactly 90% of limit
            scanner.resourceMonitor.diskUsage = scanner.maxTempDirSize * 0.9;

            const result = await scanner.checkResourceAvailability();

            expect(result.checks.diskSpace.available).toBe(false); // Should be unavailable at exactly 90%
        });

        test('should handle edge case just over limits', async () => {
            // Set disk usage to just over 90% of limit
            scanner.resourceMonitor.diskUsage = scanner.maxTempDirSize * 0.901;

            const result = await scanner.checkResourceAvailability();

            expect(result.checks.diskSpace.available).toBe(false);
        });

        test('should handle concurrent scans at exact limit', async () => {
            // Add exactly the maximum number of concurrent scans
            for (let i = 0; i < scanner.maxConcurrentScans; i++) {
                scanner.activeScans.set(`scan-${i}`, {
                    path: `/tmp/scan-${i}`,
                    startTime: Date.now()
                });
            }

            const result = await scanner.checkResourceAvailability();

            expect(result.checks.concurrentScans.available).toBe(false);
            expect(result.checks.concurrentScans.current).toBe(scanner.maxConcurrentScans);
        });
    });
});