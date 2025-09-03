/**
 * Repository Scanner Integration Tests
 * Tests for the enhanced resource management integration
 */

const fs = require('fs-extra');
const path = require('path');

// Mock dependencies
jest.mock('simple-git');
jest.mock('fs-extra');

const simpleGit = require('simple-git');

describe('Repository Scanner Integration - Resource Management', () => {
    let repositoryScanner;
    let mockGit;

    beforeEach(() => {
        // Clear module cache to get fresh instance
        jest.resetModules();

        // Mock console methods
        console.warn = jest.fn();
        console.error = jest.fn();

        // Setup git mocks
        mockGit = {
            clone: jest.fn(),
            status: jest.fn(),
            log: jest.fn(),
            getRemotes: jest.fn(),
            branch: jest.fn()
        };
        simpleGit.mockReturnValue(mockGit);

        // Mock fs operations
        fs.ensureDir.mockResolvedValue();
        fs.remove.mockResolvedValue();
        fs.pathExists.mockResolvedValue(true);
        fs.readdir.mockResolvedValue([]);
        fs.stat.mockResolvedValue({
            isDirectory: () => false,
            isFile: () => true,
            size: 1024,
            mtime: new Date()
        });

        // Import scanner after mocks are set up
        repositoryScanner = require('../services/repositoryScanner');

        // Stop any intervals to prevent test interference
        if (repositoryScanner.stopPeriodicTasks) {
            repositoryScanner.stopPeriodicTasks();
        }

        // Clear active scans
        repositoryScanner.activeScans.clear();
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (repositoryScanner.stopPeriodicTasks) {
            repositoryScanner.stopPeriodicTasks();
        }
    });

    describe('Enhanced Resource Management Methods', () => {
        test('should have resource management methods available', () => {
            expect(typeof repositoryScanner.checkResourceAvailability).toBe('function');
            expect(typeof repositoryScanner.getResourceStats).toBe('function');
            expect(typeof repositoryScanner.cleanupRepository).toBe('function');
            expect(typeof repositoryScanner.getDirectorySize).toBe('function');
        });

        test('should check resource availability', async () => {
            const result = await repositoryScanner.checkResourceAvailability();

            expect(result).toHaveProperty('available');
            expect(result).toHaveProperty('checks');
            expect(result).toHaveProperty('message');
            expect(typeof result.available).toBe('boolean');
        });

        test('should provide resource statistics', () => {
            const stats = repositoryScanner.getResourceStats();

            expect(stats).toHaveProperty('diskUsage');
            expect(stats).toHaveProperty('activeScanCount');
            expect(stats).toHaveProperty('limits');
            expect(stats).toHaveProperty('formattedStats');
            expect(stats.limits).toHaveProperty('maxConcurrentScans');
            expect(stats.limits).toHaveProperty('maxTempDirSize');
            expect(stats.limits).toHaveProperty('maxRepoSize');
        });

        test('should calculate directory size', async () => {
            // Mock directory with files
            fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 2048
            });

            const size = await repositoryScanner.getDirectorySize('/test/dir');
            expect(typeof size).toBe('number');
            expect(size).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Resource Limit Enforcement', () => {
        test('should reject clone when resources unavailable', async () => {
            // Fill up concurrent scans to maximum
            for (let i = 0; i < repositoryScanner.maxConcurrentScans; i++) {
                repositoryScanner.activeScans.set(`scan-${i}`, {
                    path: `/tmp/scan-${i}`,
                    startTime: Date.now()
                });
            }

            const repoInfo = {
                fullName: 'test/repo',
                cloneUrl: 'https://github.com/test/repo.git'
            };

            await expect(repositoryScanner.cloneRepository(repoInfo))
                .rejects
                .toMatchObject({
                    code: 'RESOURCE_LIMIT_EXCEEDED'
                });
        });

        test('should enforce repository size limits', async () => {
            const repoInfo = {
                fullName: 'test/large-repo',
                cloneUrl: 'https://github.com/test/large-repo.git'
            };

            // Mock successful clone
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });

            // Mock large repository size
            fs.readdir.mockResolvedValue(['large-file.bin']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 600 * 1024 * 1024 // 600MB > 500MB limit
            });

            await expect(repositoryScanner.cloneRepository(repoInfo))
                .rejects
                .toMatchObject({
                    code: 'REPOSITORY_TOO_LARGE'
                });

            // Verify cleanup was attempted
            expect(fs.remove).toHaveBeenCalled();
        });
    });

    describe('Cleanup and Resource Tracking', () => {
        test('should track resource usage during clone', async () => {
            const repoInfo = {
                fullName: 'test/small-repo',
                cloneUrl: 'https://github.com/test/small-repo.git'
            };

            // Mock successful clone with small size
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });
            fs.readdir.mockResolvedValue(['small-file.txt']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 50 * 1024 * 1024 // 50MB
            });

            const initialDiskUsage = repositoryScanner.resourceMonitor.diskUsage;
            const initialScanCount = repositoryScanner.resourceMonitor.activeScanCount;

            const result = await repositoryScanner.cloneRepository(repoInfo);

            expect(result).toHaveProperty('scanId');
            expect(result).toHaveProperty('clonePath');

            // Verify resource tracking
            expect(repositoryScanner.resourceMonitor.diskUsage).toBeGreaterThan(initialDiskUsage);
            expect(repositoryScanner.resourceMonitor.activeScanCount).toBeGreaterThan(initialScanCount);
            expect(repositoryScanner.activeScans.has(result.scanId)).toBe(true);
        });

        test('should cleanup resources properly', async () => {
            const scanId = 'test-cleanup-scan';
            const scanSize = 100 * 1024 * 1024; // 100MB

            // Add a scan to active scans
            repositoryScanner.activeScans.set(scanId, {
                path: '/tmp/test-cleanup',
                startTime: Date.now(),
                size: scanSize
            });
            repositoryScanner.resourceMonitor.diskUsage += scanSize;
            repositoryScanner.resourceMonitor.activeScanCount += 1;

            const initialDiskUsage = repositoryScanner.resourceMonitor.diskUsage;
            const initialScanCount = repositoryScanner.resourceMonitor.activeScanCount;

            const result = await repositoryScanner.cleanupRepository(scanId);

            expect(result).toBe(true);
            expect(repositoryScanner.activeScans.has(scanId)).toBe(false);
            expect(repositoryScanner.resourceMonitor.diskUsage).toBeLessThan(initialDiskUsage);
            expect(repositoryScanner.resourceMonitor.activeScanCount).toBeLessThan(initialScanCount);
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle clone failures and cleanup resources', async () => {
            const repoInfo = {
                fullName: 'test/failing-repo',
                cloneUrl: 'https://github.com/test/failing-repo.git'
            };

            // Mock clone failure
            mockGit.clone.mockRejectedValue(new Error('Clone failed'));

            const initialFailures = repositoryScanner.resourceMonitor.totalScansFailed;

            await expect(repositoryScanner.cloneRepository(repoInfo))
                .rejects
                .toThrow();

            // Verify failure tracking
            expect(repositoryScanner.resourceMonitor.totalScansFailed).toBe(initialFailures + 1);

            // Verify cleanup was attempted
            expect(fs.remove).toHaveBeenCalled();
        });

        test('should handle cleanup failures gracefully', async () => {
            const scanId = 'test-cleanup-failure';

            repositoryScanner.activeScans.set(scanId, {
                path: '/tmp/test-cleanup-failure',
                startTime: Date.now()
            });

            // Mock cleanup failure
            fs.remove.mockRejectedValue(new Error('Permission denied'));

            const result = await repositoryScanner.cleanupRepository(scanId);

            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to cleanup repository')
            );
        });
    });

    describe('Periodic Tasks Management', () => {
        test('should have periodic task management methods', () => {
            expect(typeof repositoryScanner.startPeriodicCleanup).toBe('function');
            expect(typeof repositoryScanner.startResourceMonitoring).toBe('function');
            expect(typeof repositoryScanner.stopPeriodicTasks).toBe('function');
        });

        test('should not start intervals in test environment', () => {
            // Verify intervals are not started automatically in test environment
            expect(repositoryScanner.cleanupIntervalRef).toBeNull();
            expect(repositoryScanner.monitoringIntervalRef).toBeNull();
        });
    });
});