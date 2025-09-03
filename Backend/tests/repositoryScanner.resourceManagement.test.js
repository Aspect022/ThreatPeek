/**
 * Repository Scanner Resource Management Tests
 * Tests for cleanup logic, size limits, timeout controls, and resource monitoring
 */

const fs = require('fs-extra');
const path = require('path');

// Mock dependencies
jest.mock('simple-git');
jest.mock('fs-extra');

const simpleGit = require('simple-git');

// Import the class directly to avoid singleton issues
const RepositoryScanner = require('../services/repositoryScanner').constructor || class {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'temp', 'repos');
        this.maxRepoSize = 500 * 1024 * 1024;
        this.cloneTimeout = 300000;
        this.scanTimeout = 600000;
        this.activeScans = new Map();
        this.maxConcurrentScans = 5;
        this.maxTempDirSize = 2 * 1024 * 1024 * 1024;
        this.cleanupInterval = 30 * 60 * 1000;
        this.maxScanAge = 2 * 60 * 60 * 1000;
        this.maxRepoSizeBytes = 500 * 1024 * 1024;
        this.scanTimeoutMs = 10 * 60 * 1000;
        this.resourceMonitor = {
            diskUsage: 0,
            activeScanCount: 0,
            lastCleanup: Date.now(),
            totalScansStarted: 0,
            totalScansCompleted: 0,
            totalScansFailed: 0,
            totalBytesProcessed: 0
        };
        this.cleanupIntervalRef = null;
        this.monitoringIntervalRef = null;
    }
};

describe('Repository Scanner Resource Management', () => {
    let mockGit;
    let testTempDir;
    let originalConsoleWarn;
    let originalConsoleError;

    beforeEach(() => {
        // Mock console methods to avoid noise in tests
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;
        console.warn = jest.fn();
        console.error = jest.fn();

        // Setup mocks
        mockGit = {
            clone: jest.fn(),
            status: jest.fn(),
            log: jest.fn(),
            getRemotes: jest.fn(),
            branch: jest.fn()
        };
        simpleGit.mockReturnValue(mockGit);

        testTempDir = '/tmp/test-repos';

        // Mock UUID generation
        uuidv4.mockReturnValue('test-scan-id-123');

        // Reset fs-extra mocks
        fs.ensureDir.mockResolvedValue();
        fs.remove.mockResolvedValue();
        fs.readdir.mockResolvedValue([]);
        fs.stat.mockResolvedValue({
            isDirectory: () => false,
            isFile: () => true,
            size: 1024,
            mtime: new Date()
        });
        fs.pathExists.mockResolvedValue(true);

        // Clear any existing intervals
        jest.clearAllTimers();
        jest.useFakeTimers();
    });

    afterEach(() => {
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('Resource Availability Checking', () => {
        test('should check disk space availability', async () => {
            // Mock directory size calculation
            fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 100 * 1024 * 1024 // 100MB
            });

            const resourceCheck = await repositoryScanner.checkResourceAvailability();

            expect(resourceCheck).toHaveProperty('available');
            expect(resourceCheck).toHaveProperty('checks');
            expect(resourceCheck.checks).toHaveProperty('diskSpace');
            expect(resourceCheck.checks).toHaveProperty('concurrentScans');
        });

        test('should reject scan when disk space limit exceeded', async () => {
            // Mock large directory size
            fs.readdir.mockResolvedValue(['large-file.bin']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 2.5 * 1024 * 1024 * 1024 // 2.5GB (exceeds 2GB limit)
            });

            const resourceCheck = await repositoryScanner.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.checks.diskSpace.available).toBe(false);
        });

        test('should reject scan when concurrent scan limit exceeded', async () => {
            // Simulate max concurrent scans
            for (let i = 0; i < 5; i++) {
                repositoryScanner.activeScans.set(`scan-${i}`, {
                    path: `/tmp/scan-${i}`,
                    startTime: Date.now()
                });
            }

            const resourceCheck = await repositoryScanner.checkResourceAvailability();

            expect(resourceCheck.available).toBe(false);
            expect(resourceCheck.checks.concurrentScans.available).toBe(false);
        });
    });

    describe('Repository Size Limits', () => {
        test('should reject repository that exceeds size limit', async () => {
            const repoInfo = {
                fullName: 'test/large-repo',
                cloneUrl: 'https://github.com/test/large-repo.git'
            };

            // Mock successful clone but large size
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });

            // Mock large repository size (600MB > 500MB limit)
            fs.readdir.mockResolvedValue(['large-file.bin']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 600 * 1024 * 1024
            });

            await expect(repositoryScanner.cloneRepository(repoInfo))
                .rejects
                .toMatchObject({
                    code: 'REPOSITORY_TOO_LARGE',
                    message: expect.stringContaining('too large')
                });

            // Verify cleanup was called
            expect(fs.remove).toHaveBeenCalled();
        });

        test('should accept repository within size limit', async () => {
            const repoInfo = {
                fullName: 'test/small-repo',
                cloneUrl: 'https://github.com/test/small-repo.git'
            };

            // Mock successful clone with acceptable size
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });

            // Mock small repository size (50MB < 500MB limit)
            fs.readdir.mockResolvedValue(['small-file.txt']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 50 * 1024 * 1024
            });

            const result = await repositoryScanner.cloneRepository(repoInfo);

            expect(result).toHaveProperty('scanId');
            expect(result).toHaveProperty('clonePath');
            expect(fs.remove).not.toHaveBeenCalled();
        });
    });

    describe('Timeout Controls', () => {
        test('should timeout scan after specified duration', async () => {
            const target = { value: 'https://github.com/test/slow-repo.git' };
            const options = { timeout: 1000 }; // 1 second timeout

            // Mock slow operations
            mockGit.clone.mockImplementation(() =>
                new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
            );

            const scanPromise = repositoryScanner.scan(target, options);

            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(1500);

            await expect(scanPromise)
                .rejects
                .toMatchObject({
                    code: 'SCAN_TIMEOUT',
                    message: expect.stringContaining('timed out')
                });
        });

        test('should complete scan within timeout', async () => {
            const target = { value: 'https://github.com/test/fast-repo.git' };
            const options = { timeout: 5000 }; // 5 second timeout

            // Mock fast operations
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });
            mockGit.log.mockResolvedValue({
                latest: {
                    hash: 'abc123',
                    date: new Date(),
                    message: 'Test commit',
                    author_name: 'Test Author'
                }
            });
            mockGit.getRemotes.mockResolvedValue([]);
            mockGit.branch.mockResolvedValue({ current: 'main' });

            // Mock small files for quick scanning
            fs.readdir.mockResolvedValue(['test.js']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 1024
            });
            fs.readFile.mockResolvedValue('console.log("test");');

            const result = await repositoryScanner.scan(target, options);

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('Cleanup Logic', () => {
        test('should cleanup repository after successful scan', async () => {
            const scanId = 'test-scan-123';
            const scanPath = '/tmp/test-scan-123';

            // Add scan to active scans
            repositoryScanner.activeScans.set(scanId, {
                path: scanPath,
                startTime: Date.now(),
                size: 1024 * 1024
            });

            const result = await repositoryScanner.cleanupRepository(scanId);

            expect(result).toBe(true);
            expect(fs.remove).toHaveBeenCalledWith(scanPath);
            expect(repositoryScanner.activeScans.has(scanId)).toBe(false);
        });

        test('should handle cleanup failure gracefully', async () => {
            const scanId = 'test-scan-456';
            const scanPath = '/tmp/test-scan-456';

            repositoryScanner.activeScans.set(scanId, {
                path: scanPath,
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

        test('should return false for non-existent scan', async () => {
            const result = await repositoryScanner.cleanupRepository('non-existent-scan');
            expect(result).toBe(false);
        });
    });

    describe('Periodic Cleanup', () => {
        test('should cleanup expired scans', async () => {
            const oldScanId = 'old-scan-123';
            const recentScanId = 'recent-scan-456';
            const now = Date.now();

            // Add old scan (3 hours old)
            repositoryScanner.activeScans.set(oldScanId, {
                path: '/tmp/old-scan',
                startTime: now - (3 * 60 * 60 * 1000),
                size: 1024 * 1024
            });

            // Add recent scan (30 minutes old)
            repositoryScanner.activeScans.set(recentScanId, {
                path: '/tmp/recent-scan',
                startTime: now - (30 * 60 * 1000),
                size: 1024 * 1024
            });

            await repositoryScanner.performPeriodicCleanup();

            // Old scan should be cleaned up
            expect(repositoryScanner.activeScans.has(oldScanId)).toBe(false);
            // Recent scan should remain
            expect(repositoryScanner.activeScans.has(recentScanId)).toBe(true);
        });

        test('should cleanup orphaned directories', async () => {
            // Mock orphaned directory
            fs.readdir.mockResolvedValue(['orphaned-dir', 'active-dir']);
            fs.stat.mockImplementation((dirPath) => {
                if (dirPath.includes('orphaned-dir')) {
                    return Promise.resolve({
                        isDirectory: () => true,
                        mtime: new Date(Date.now() - (2 * 60 * 60 * 1000)) // 2 hours old
                    });
                }
                return Promise.resolve({
                    isDirectory: () => true,
                    mtime: new Date()
                });
            });

            // Mock active scan for active-dir
            repositoryScanner.activeScans.set('active-scan', {
                path: path.join(repositoryScanner.tempDir, 'active-dir'),
                startTime: Date.now()
            });

            await repositoryScanner.cleanupOrphanedDirectories();

            expect(fs.remove).toHaveBeenCalledWith(
                expect.stringContaining('orphaned-dir')
            );
        });

        test('should enforce temp directory size limit', async () => {
            // Mock multiple large scans
            const scan1 = 'large-scan-1';
            const scan2 = 'large-scan-2';
            const scan3 = 'large-scan-3';

            repositoryScanner.activeScans.set(scan1, {
                path: '/tmp/large-scan-1',
                startTime: Date.now() - 60000, // Oldest
                size: 800 * 1024 * 1024
            });

            repositoryScanner.activeScans.set(scan2, {
                path: '/tmp/large-scan-2',
                startTime: Date.now() - 30000,
                size: 800 * 1024 * 1024
            });

            repositoryScanner.activeScans.set(scan3, {
                path: '/tmp/large-scan-3',
                startTime: Date.now(), // Newest
                size: 800 * 1024 * 1024
            });

            // Mock total size exceeding limit
            fs.readdir.mockResolvedValue(['large-scan-1', 'large-scan-2', 'large-scan-3']);
            fs.stat.mockResolvedValue({
                isDirectory: () => true,
                size: 800 * 1024 * 1024
            });

            await repositoryScanner.enforceTempDirSizeLimit();

            // Oldest scan should be cleaned up first
            expect(repositoryScanner.activeScans.has(scan1)).toBe(false);
        });
    });

    describe('Resource Monitoring', () => {
        test('should update resource monitoring statistics', async () => {
            // Mock directory with files
            fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
            fs.stat.mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 50 * 1024 * 1024
            });

            await repositoryScanner.updateResourceMonitoring();

            const stats = repositoryScanner.getResourceStats();
            expect(stats).toHaveProperty('diskUsage');
            expect(stats).toHaveProperty('activeScanCount');
            expect(stats).toHaveProperty('limits');
            expect(stats).toHaveProperty('formattedStats');
        });

        test('should provide formatted resource statistics', () => {
            const stats = repositoryScanner.getResourceStats();

            expect(stats.formattedStats).toHaveProperty('diskUsage');
            expect(stats.formattedStats).toHaveProperty('diskUsagePercent');
            expect(stats.formattedStats).toHaveProperty('activeScanCount');
            expect(stats.formattedStats.diskUsage).toMatch(/\d+MB/);
        });
    });

    describe('Directory Size Calculation', () => {
        test('should calculate directory size recursively', async () => {
            const testDir = '/tmp/test-dir';

            // Mock directory structure
            fs.readdir.mockImplementation((dirPath) => {
                if (dirPath === testDir) {
                    return Promise.resolve(['file1.txt', 'subdir']);
                } else if (dirPath.includes('subdir')) {
                    return Promise.resolve(['file2.txt']);
                }
                return Promise.resolve([]);
            });

            fs.stat.mockImplementation((filePath) => {
                if (filePath.includes('file1.txt')) {
                    return Promise.resolve({
                        isDirectory: () => false,
                        isFile: () => true,
                        size: 1024
                    });
                } else if (filePath.includes('subdir') && !filePath.includes('file2.txt')) {
                    return Promise.resolve({
                        isDirectory: () => true,
                        isFile: () => false
                    });
                } else if (filePath.includes('file2.txt')) {
                    return Promise.resolve({
                        isDirectory: () => false,
                        isFile: () => true,
                        size: 2048
                    });
                }
                return Promise.resolve({
                    isDirectory: () => false,
                    isFile: () => true,
                    size: 0
                });
            });

            const size = await repositoryScanner.getDirectorySize(testDir);
            expect(size).toBe(3072); // 1024 + 2048
        });

        test('should handle directory read errors gracefully', async () => {
            fs.readdir.mockRejectedValue(new Error('Permission denied'));

            const size = await repositoryScanner.getDirectorySize('/inaccessible-dir');
            expect(size).toBe(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle resource limit errors properly', async () => {
            const repoInfo = {
                fullName: 'test/repo',
                cloneUrl: 'https://github.com/test/repo.git'
            };

            // Mock resource limit exceeded
            repositoryScanner.resourceMonitor.activeScanCount = 10; // Exceed limit

            await expect(repositoryScanner.cloneRepository(repoInfo))
                .rejects
                .toMatchObject({
                    code: 'RESOURCE_LIMIT_EXCEEDED',
                    message: expect.stringContaining('Cannot start new scan')
                });
        });

        test('should update failure statistics on error', async () => {
            const target = { value: 'https://github.com/test/failing-repo.git' };

            // Mock clone failure
            mockGit.clone.mockRejectedValue(new Error('Clone failed'));

            const initialFailures = repositoryScanner.resourceMonitor.totalScansFailed;

            await expect(repositoryScanner.scan(target))
                .rejects
                .toThrow();

            expect(repositoryScanner.resourceMonitor.totalScansFailed)
                .toBe(initialFailures + 1);
        });
    });
});