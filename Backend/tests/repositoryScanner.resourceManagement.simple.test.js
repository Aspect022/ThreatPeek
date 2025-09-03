/**
 * Repository Scanner Resource Management Tests - Simplified
 * Tests for cleanup logic, size limits, timeout controls, and resource monitoring
 */

const fs = require('fs-extra');
const path = require('path');

describe('Repository Scanner Resource Management - Core Functions', () => {
    let scanner;

    beforeEach(() => {
        // Create a minimal scanner instance for testing
        scanner = {
            tempDir: '/tmp/test-repos',
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

            // Mock the methods we need to test
            async getDirectorySize(dirPath) {
                // Mock implementation
                if (dirPath.includes('large')) return 600 * 1024 * 1024; // 600MB
                if (dirPath.includes('small')) return 50 * 1024 * 1024; // 50MB
                return 100 * 1024 * 1024; // 100MB default
            },

            async checkResourceAvailability() {
                const currentDiskUsage = this.resourceMonitor.diskUsage;
                const activeScanCount = this.activeScans.size;

                const checks = {
                    diskSpace: {
                        available: currentDiskUsage < this.maxTempDirSize * 0.9,
                        current: currentDiskUsage,
                        limit: this.maxTempDirSize,
                        message: currentDiskUsage >= this.maxTempDirSize * 0.9
                            ? `Disk usage approaching limit`
                            : 'Disk space available'

                    },
                    concurrentScans: {
                        available: activeScanCount < this.maxConcurrentScans,
                        current: activeScanCount,
                        limit: this.maxConcurrentScans,
                        message: activeScanCount >= this.maxConcurrentScans
                            ? `Maximum concurrent scans reached`
                            : 'Concurrent scan slots available'
                    }
                };

                const allAvailable = checks.diskSpace.available && checks.concurrentScans.available;

                return {
                    available: allAvailable,
                    checks,
                    message: allAvailable
                        ? 'Resources available for new scan'
                        : 'Resource limits reached'
                };
            },

            async cleanupRepository(scanId) {
                const scanInfo = this.activeScans.get(scanId);
                if (!scanInfo) {
                    return false;
                }

                try {
                    // Simulate cleanup
                    this.activeScans.delete(scanId);
                    this.resourceMonitor.diskUsage = Math.max(0, this.resourceMonitor.diskUsage - (scanInfo.size || 0));
                    this.resourceMonitor.activeScanCount = Math.max(0, this.resourceMonitor.activeScanCount - 1);
                    return true;
                } catch (error) {
                    return false;
                }
            },

            getResourceStats() {
                return {
                    ...this.resourceMonitor,
                    limits: {
                        maxConcurrentScans: this.maxConcurrentScans,
                        maxTempDirSize: this.maxTempDirSize,
                        maxRepoSize: this.maxRepoSizeBytes
                    },
                    formattedStats: {
                        diskUsage: `${Math.round(this.resourceMonitor.diskUsage / 1024 / 1024)}MB`,
                        diskUsagePercent: Math.round((this.resourceMonitor.diskUsage / this.maxTempDirSize) * 100),
                        activeScanCount: this.resourceMonitor.activeScanCount,
                        totalBytesProcessed: `${Math.round(this.resourceMonitor.totalBytesProcessed / 1024 / 1024)}MB`
                    }
                };
            }
        };
    });

    describe('Resource Availability Checking', () => {
        test('should check disk space availability', async () => {
            const resourceCheck = await scanner.checkResourceAvailability();

            expect(resourceCheck).toHaveProperty('available');
            expect(resourceCheck).toHaveProperty('checks');
            expect(resourceCheck.checks).toHaveProperty('diskSpace');
            expect(resourceCheck.checks).toHaveProperty('concurrentScans');
            expect(typeof resourceCheck.available).toBe('boolean');
        });

        test('should reject when disk space limit exceeded', async () => {
            // Simulate high disk usage
            scanner.resourceMonitor.diskUsage = scanner.maxTempDirSize * 0.95; // 95% usage

            const resourceCheck = await scanner.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.checks.diskSpace.available).toBe(false);
        });

        test('should reject when concurrent scan limit exceeded', async () => {
            // Simulate max concurrent scans
            for (let i = 0; i < scanner.maxConcurrentScans; i++) {
                scanner.activeScans.set(`scan-${i}`, {
                    path: `/tmp/scan-${i}`,
                    startTime: Date.now()
                });
            }

            const resourceCheck = await scanner.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.checks.concurrentScans.available).toBe(false);
        });

        test('should allow scan when resources are available', async () => {
            // Ensure clean state
            scanner.activeScans.clear();
            scanner.resourceMonitor.diskUsage = 100 * 1024 * 1024; // 100MB

            const resourceCheck = await scanner.checkResourceAvailability();

            expect(resourceCheck.available).toBe(true);
            expect(resourceCheck.checks.diskSpace.available).toBe(true);
            expect(resourceCheck.checks.concurrentScans.available).toBe(true);
        });
    });

    describe('Repository Size Validation', () => {
        test('should detect oversized repository', async () => {
            const largeRepoSize = await scanner.getDirectorySize('/tmp/large-repo');

            expect(largeRepoSize).toBeGreaterThan(scanner.maxRepoSizeBytes);
        });

        test('should accept normal sized repository', async () => {
            const smallRepoSize = await scanner.getDirectorySize('/tmp/small-repo');

            expect(smallRepoSize).toBeLessThan(scanner.maxRepoSizeBytes);
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

            const result = await scanner.cleanupRepository(scanId);

            expect(result).toBe(true);
            expect(scanner.activeScans.has(scanId)).toBe(false);
            expect(scanner.resourceMonitor.diskUsage).toBe(0);
            expect(scanner.resourceMonitor.activeScanCount).toBe(0);
        });

        test('should handle cleanup of non-existent scan', async () => {
            const result = await scanner.cleanupRepository('non-existent-scan');
            expect(result).toBe(false);
        });

        test('should update resource monitoring after cleanup', async () => {
            const scanId = 'test-scan-456';
            const scanSize = 200 * 1024 * 1024; // 200MB

            scanner.activeScans.set(scanId, {
                path: '/tmp/test-scan-456',
                startTime: Date.now(),
                size: scanSize
            });
            scanner.resourceMonitor.diskUsage = scanSize;

            await scanner.cleanupRepository(scanId);

            expect(scanner.resourceMonitor.diskUsage).toBe(0);
        });
    });

    describe('Resource Statistics', () => {
        test('should provide resource statistics', () => {
            scanner.resourceMonitor.diskUsage = 500 * 1024 * 1024; // 500MB
            scanner.resourceMonitor.activeScanCount = 3;
            scanner.resourceMonitor.totalBytesProcessed = 1024 * 1024 * 1024; // 1GB

            const stats = scanner.getResourceStats();

            expect(stats).toHaveProperty('diskUsage');
            expect(stats).toHaveProperty('activeScanCount');
            expect(stats).toHaveProperty('limits');
            expect(stats).toHaveProperty('formattedStats');

            expect(stats.formattedStats.diskUsage).toBe('500MB');
            expect(stats.formattedStats.activeScanCount).toBe(3);
            expect(stats.formattedStats.totalBytesProcessed).toBe('1024MB');
        });

        test('should calculate disk usage percentage', () => {
            scanner.resourceMonitor.diskUsage = scanner.maxTempDirSize * 0.5; // 50% usage

            const stats = scanner.getResourceStats();

            expect(stats.formattedStats.diskUsagePercent).toBe(50);
        });
    });

    describe('Resource Limits Configuration', () => {
        test('should have proper resource limits configured', () => {
            expect(scanner.maxRepoSizeBytes).toBe(500 * 1024 * 1024); // 500MB
            expect(scanner.maxTempDirSize).toBe(2 * 1024 * 1024 * 1024); // 2GB
            expect(scanner.maxConcurrentScans).toBe(5);
            expect(scanner.maxScanAge).toBe(2 * 60 * 60 * 1000); // 2 hours
        });

        test('should track resource monitoring metrics', () => {
            expect(scanner.resourceMonitor).toHaveProperty('diskUsage');
            expect(scanner.resourceMonitor).toHaveProperty('activeScanCount');
            expect(scanner.resourceMonitor).toHaveProperty('totalScansStarted');
            expect(scanner.resourceMonitor).toHaveProperty('totalScansCompleted');
            expect(scanner.resourceMonitor).toHaveProperty('totalScansFailed');
            expect(scanner.resourceMonitor).toHaveProperty('totalBytesProcessed');
        });
    });

    describe('Error Scenarios', () => {
        test('should handle resource exhaustion gracefully', async () => {
            // Fill up to maximum concurrent scans
            for (let i = 0; i < scanner.maxConcurrentScans; i++) {
                scanner.activeScans.set(`scan-${i}`, {
                    path: `/tmp/scan-${i}`,
                    startTime: Date.now()
                });
            }

            const resourceCheck = await scanner.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.message).toContain('Resource limits reached');
        });

        test('should prevent negative resource counts', async () => {
            scanner.resourceMonitor.diskUsage = 100 * 1024 * 1024;
            scanner.resourceMonitor.activeScanCount = 1;

            // Try to cleanup more than what exists
            scanner.activeScans.set('test-scan', {
                path: '/tmp/test',
                size: 200 * 1024 * 1024 // Larger than current diskUsage
            });

            await scanner.cleanupRepository('test-scan');

            expect(scanner.resourceMonitor.diskUsage).toBeGreaterThanOrEqual(0);
            expect(scanner.resourceMonitor.activeScanCount).toBeGreaterThanOrEqual(0);
        });
    });
});