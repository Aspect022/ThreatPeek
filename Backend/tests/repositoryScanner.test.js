/**
 * Repository Scanner Tests
 * Comprehensive test suite for repository URL validation, parsing, and accessibility checking
 */

const RepositoryScanner = require('../services/repositoryScanner');
const fs = require('fs-extra');
const path = require('path');

// Mock simple-git to avoid actual git operations in tests
jest.mock('simple-git', () => {
    const mockGit = {
        clone: jest.fn(),
        log: jest.fn(),
        getRemotes: jest.fn(),
        branch: jest.fn(),
        status: jest.fn()
    };

    return jest.fn(() => mockGit);
});

const simpleGit = require('simple-git');

describe('RepositoryScanner', () => {
    let scanner;
    let mockGit;

    beforeEach(() => {
        scanner = RepositoryScanner;
        mockGit = simpleGit();
        jest.clearAllMocks();
    });

    describe('parseRepositoryUrl', () => {
        describe('Valid GitHub URLs', () => {
            test('should parse standard GitHub HTTPS URL', () => {
                const url = 'https://github.com/owner/repo';
                const result = scanner.parseRepositoryUrl(url);

                expect(result).toEqual({
                    platform: 'github',
                    owner: 'owner',
                    repo: 'repo',
                    fullName: 'owner/repo',
                    originalUrl: url,
                    cloneUrl: 'https://github.com/owner/repo.git',
                    webUrl: 'https://github.com/owner/repo'
                });
            });

            test('should parse GitHub HTTPS URL with .git extension', () => {
                const url = 'https://github.com/owner/repo.git';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
                expect(result.cloneUrl).toBe('https://github.com/owner/repo.git');
            });

            test('should parse GitHub SSH URL', () => {
                const url = 'git@github.com:owner/repo.git';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
                expect(result.cloneUrl).toBe('https://github.com/owner/repo.git');
            });

            test('should parse GitHub URL with www subdomain', () => {
                const url = 'https://www.github.com/owner/repo';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
            });

            test('should handle GitHub URL with trailing slash', () => {
                const url = 'https://github.com/owner/repo/';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
            });

            test('should handle GitHub URLs with complex repository names', () => {
                const url = 'https://github.com/my-org/my-awesome-project';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('my-org');
                expect(result.repo).toBe('my-awesome-project');
                expect(result.fullName).toBe('my-org/my-awesome-project');
            });
        });

        describe('Valid GitLab URLs', () => {
            test('should parse standard GitLab HTTPS URL', () => {
                const url = 'https://gitlab.com/owner/repo';
                const result = scanner.parseRepositoryUrl(url);

                expect(result).toEqual({
                    platform: 'gitlab',
                    owner: 'owner',
                    repo: 'repo',
                    fullName: 'owner/repo',
                    originalUrl: url,
                    cloneUrl: 'https://gitlab.com/owner/repo.git',
                    webUrl: 'https://gitlab.com/owner/repo'
                });
            });

            test('should parse GitLab HTTPS URL with .git extension', () => {
                const url = 'https://gitlab.com/owner/repo.git';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('gitlab');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
            });

            test('should parse GitLab SSH URL', () => {
                const url = 'git@gitlab.com:owner/repo.git';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('gitlab');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
                expect(result.cloneUrl).toBe('https://gitlab.com/owner/repo.git');
            });
        });

        describe('Invalid URLs', () => {
            test('should throw error for null URL', () => {
                expect(() => {
                    scanner.parseRepositoryUrl(null);
                }).toThrow('Repository URL is required and must be a string');
            });

            test('should throw error for undefined URL', () => {
                expect(() => {
                    scanner.parseRepositoryUrl(undefined);
                }).toThrow('Repository URL is required and must be a string');
            });

            test('should throw error for empty string', () => {
                expect(() => {
                    scanner.parseRepositoryUrl('');
                }).toThrow('Repository URL is required and must be a string');
            });

            test('should throw error for non-string URL', () => {
                expect(() => {
                    scanner.parseRepositoryUrl(123);
                }).toThrow('Repository URL is required and must be a string');
            });

            test('should throw error for unsupported platform', () => {
                const url = 'https://bitbucket.org/owner/repo';

                expect(() => {
                    scanner.parseRepositoryUrl(url);
                }).toThrow('Unsupported repository URL format');
            });

            test('should throw error for malformed GitHub URL', () => {
                const url = 'https://github.com/owner';

                expect(() => {
                    scanner.parseRepositoryUrl(url);
                }).toThrow('Unsupported repository URL format');
            });

            test('should throw error for invalid domain', () => {
                const url = 'https://github.co/owner/repo';

                expect(() => {
                    scanner.parseRepositoryUrl(url);
                }).toThrow('Unsupported repository URL format');
            });

            test('should provide helpful error details for unsupported URLs', () => {
                const url = 'https://example.com/owner/repo';

                try {
                    scanner.parseRepositoryUrl(url);
                } catch (error) {
                    expect(error.code).toBe('UNSUPPORTED_URL');
                    expect(error.details.supportedFormats).toContain('https://github.com/owner/repo');
                    expect(error.details.supportedFormats).toContain('https://gitlab.com/owner/repo');
                    expect(error.details.providedUrl).toBe(url);
                }
            });
        });

        describe('URL normalization', () => {
            test('should trim whitespace from URLs', () => {
                const url = '  https://github.com/owner/repo  ';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
            });

            test('should remove trailing slashes', () => {
                const url = 'https://github.com/owner/repo///';
                const result = scanner.parseRepositoryUrl(url);

                expect(result.platform).toBe('github');
                expect(result.owner).toBe('owner');
                expect(result.repo).toBe('repo');
            });
        });
    });

    describe('checkRepositoryAccessibility', () => {
        beforeEach(() => {
            // Mock fs operations
            jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            jest.spyOn(fs, 'remove').mockResolvedValue();
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should return accessible status for valid repository', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'repo',
                fullName: 'owner/repo',
                cloneUrl: 'https://github.com/owner/repo.git'
            };

            // Mock successful git operations
            mockGit.clone.mockResolvedValue();
            mockGit.log.mockResolvedValue({
                latest: {
                    hash: 'abc123',
                    date: '2023-01-01',
                    message: 'Initial commit',
                    author_name: 'Test Author'
                }
            });
            mockGit.getRemotes.mockResolvedValue([
                { name: 'origin', refs: { fetch: 'https://github.com/owner/repo.git' } }
            ]);
            mockGit.branch.mockResolvedValue({ current: 'main' });

            // Mock repository stats
            jest.spyOn(scanner, 'getRepositoryStats').mockResolvedValue({
                size: 1024,
                totalFiles: 10,
                scannableFiles: 5,
                lastModified: new Date()
            });

            const result = await scanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(true);
            expect(result.lastCommit).toEqual({
                hash: 'abc123',
                date: '2023-01-01',
                message: 'Initial commit',
                author: 'Test Author'
            });
            expect(result.defaultBranch).toBe('main');
            expect(result.stats).toBeDefined();
        });

        test('should handle repository not found error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'nonexistent',
                fullName: 'owner/nonexistent',
                cloneUrl: 'https://github.com/owner/nonexistent.git'
            };

            mockGit.clone.mockRejectedValue(new Error('Repository not found (404)'));

            const result = await scanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(false);
            expect(result.error.code).toBe('REPOSITORY_NOT_FOUND');
            expect(result.error.message).toContain('Repository not found');
            expect(result.error.details.suggestions).toContain('Verify the repository name and owner are correct');
        });

        test('should handle permission denied error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'private-repo',
                fullName: 'owner/private-repo',
                cloneUrl: 'https://github.com/owner/private-repo.git'
            };

            mockGit.clone.mockRejectedValue(new Error('Permission denied (403)'));

            const result = await scanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(false);
            expect(result.error.code).toBe('REPOSITORY_ACCESS_DENIED');
            expect(result.error.message).toContain('Access denied');
            expect(result.error.details.suggestions).toContain('Check if the repository is public');
        });

        test('should handle timeout error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'large-repo',
                fullName: 'owner/large-repo',
                cloneUrl: 'https://github.com/owner/large-repo.git'
            };

            mockGit.clone.mockRejectedValue(new Error('Operation timed out'));

            const result = await scanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(false);
            expect(result.error.code).toBe('REPOSITORY_TIMEOUT');
            expect(result.error.message).toContain('Timeout while accessing repository');
            expect(result.error.details.suggestions).toContain('Try again later');
        });

        test('should handle network error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'repo',
                fullName: 'owner/repo',
                cloneUrl: 'https://github.com/owner/repo.git'
            };

            mockGit.clone.mockRejectedValue(new Error('Network connection failed'));

            const result = await scanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(false);
            expect(result.error.code).toBe('NETWORK_ERROR');
            expect(result.error.message).toContain('Network error');
            expect(result.error.details.suggestions).toContain('Check your internet connection');
        });

        test('should handle generic error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'repo',
                fullName: 'owner/repo',
                cloneUrl: 'https://github.com/owner/repo.git'
            };

            mockGit.clone.mockRejectedValue(new Error('Unknown error occurred'));

            const result = await scanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(false);
            expect(result.error.code).toBe('REPOSITORY_ACCESS_ERROR');
            expect(result.error.message).toContain('Failed to access repository');
            expect(result.error.details.originalError).toBe('Unknown error occurred');
        });

        test('should cleanup temporary directory even on error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'repo',
                fullName: 'owner/repo',
                cloneUrl: 'https://github.com/owner/repo.git'
            };

            mockGit.clone.mockRejectedValue(new Error('Test error'));

            await scanner.checkRepositoryAccessibility(repoInfo);

            expect(fs.remove).toHaveBeenCalled();
        });
    });

    describe('Error handling utilities', () => {
        test('should create structured error with code and details', () => {
            const error = scanner.createError('TEST_CODE', 'Test message', { key: 'value' });

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Test message');
            expect(error.code).toBe('TEST_CODE');
            expect(error.details).toEqual({ key: 'value' });
            expect(error.timestamp).toBeDefined();
        });

        test('should create error with empty details by default', () => {
            const error = scanner.createError('TEST_CODE', 'Test message');

            expect(error.details).toEqual({});
        });
    });

    describe('File scanning utilities', () => {
        test('should identify scannable files by extension', () => {
            expect(scanner.isScannable('test.js')).toBe(true);
            expect(scanner.isScannable('test.json')).toBe(true);
            expect(scanner.isScannable('test.env')).toBe(true);
            expect(scanner.isScannable('.env')).toBe(true);
            expect(scanner.isScannable('test.txt')).toBe(true);
            expect(scanner.isScannable('test.exe')).toBe(false);
            expect(scanner.isScannable('test.bin')).toBe(false);
        });

        test('should ignore common patterns', () => {
            expect(scanner.shouldIgnorePath('node_modules/package')).toBe(true);
            expect(scanner.shouldIgnorePath('.git/config')).toBe(true);
            expect(scanner.shouldIgnorePath('dist/bundle.js')).toBe(true);
            expect(scanner.shouldIgnorePath('src/index.js')).toBe(false);
            expect(scanner.shouldIgnorePath('README.md')).toBe(false);
        });

        test('should handle nested ignore patterns', () => {
            expect(scanner.shouldIgnorePath('src/node_modules/package.json')).toBe(true);
            expect(scanner.shouldIgnorePath('deep/nested/node_modules/file.js')).toBe(true);
            expect(scanner.shouldIgnorePath('src/components/Button.js')).toBe(false);
        });
    });

    describe('Repository cloning and scanning', () => {
        beforeEach(() => {
            // Mock fs operations for cloning tests
            jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            jest.spyOn(fs, 'remove').mockResolvedValue();
            jest.spyOn(fs, 'readdir').mockResolvedValue(['file1.js', 'file2.txt']);
            jest.spyOn(fs, 'stat').mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 1024
            });
            jest.spyOn(fs, 'readFile').mockResolvedValue('const apiKey = "test-key";');
        });

        test('should clone repository successfully', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'repo',
                fullName: 'owner/repo',
                cloneUrl: 'https://github.com/owner/repo.git'
            };

            // Mock successful git operations
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });

            const result = await scanner.cloneRepository(repoInfo, { depth: 1 });

            expect(result.scanId).toBeDefined();
            expect(result.clonePath).toContain('clone_');
            expect(mockGit.clone).toHaveBeenCalledWith(
                repoInfo.cloneUrl,
                expect.stringContaining('clone_'),
                expect.objectContaining({
                    '--depth': 1,
                    '--single-branch': null,
                    '--no-tags': null
                })
            );
        });

        test('should handle clone timeout', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'owner',
                repo: 'repo',
                fullName: 'owner/repo',
                cloneUrl: 'https://github.com/owner/repo.git'
            };

            // Mock clone that never resolves (simulating timeout)
            mockGit.clone.mockImplementation(() => new Promise(() => { }));

            // Reduce timeout for test
            scanner.cloneTimeout = 100;

            await expect(scanner.cloneRepository(repoInfo)).rejects.toThrow('Clone operation timed out');
        });

        test('should scan repository files recursively', async () => {
            const repoPath = '/tmp/test-repo';

            // Mock file system structure
            jest.spyOn(fs, 'readdir')
                .mockResolvedValueOnce(['src', 'package.json'])
                .mockResolvedValueOnce(['index.js', 'config.js']);

            jest.spyOn(fs, 'stat')
                .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 1024 })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 512 })
                .mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true, size: 256 });

            jest.spyOn(fs, 'readFile')
                .mockResolvedValueOnce('{"name": "test"}')
                .mockResolvedValueOnce('const secret = "sk-test123";')
                .mockResolvedValueOnce('const config = { api: "test" };');

            // Mock pattern engine to return some matches
            jest.spyOn(scanner.patternEngine, 'scanContent').mockReturnValue([
                {
                    pattern: { id: 'test-pattern', name: 'Test Secret', severity: 'high', category: 'secrets' },
                    value: 'sk-test123',
                    confidence: 0.9,
                    index: 15,
                    context: { before: 'const secret = "', after: '";' }
                }
            ]);

            const result = await scanner.scanRepositoryFiles(repoPath, {
                maxFiles: 10,
                onProgress: jest.fn()
            });

            expect(result.findings).toHaveLength(2); // Only 2 files are scannable (.js files)
            expect(result.filesScanned).toBe(2);
            expect(result.findings[0].type).toBe('Test Secret');
            expect(result.findings[0].file).toContain('.js');
        });

        test('should respect file type filtering', async () => {
            expect(scanner.shouldScanFile('test.js', [], [])).toBe(true);
            expect(scanner.shouldScanFile('test.exe', [], [])).toBe(false);
            expect(scanner.shouldScanFile('node_modules/package.json', [], [])).toBe(false);
            expect(scanner.shouldScanFile('src/index.js', ['src/**'], [])).toBe(true);
            expect(scanner.shouldScanFile('test/index.js', ['src/**'], [])).toBe(false);
            expect(scanner.shouldScanFile('src/test.js', [], ['**test**'])).toBe(false);
        });

        test('should handle large files by skipping them', async () => {
            const filePath = '/tmp/large-file.js';
            const relativePath = 'large-file.js';

            // Mock large file
            jest.spyOn(fs, 'stat').mockResolvedValue({ size: 20 * 1024 * 1024 }); // 20MB

            const result = await scanner.scanFile(filePath, relativePath);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('Large File Skipped');
            expect(result[0].severity).toBe('info');
        });

        test('should handle file read errors gracefully', async () => {
            const filePath = '/tmp/unreadable-file.js';
            const relativePath = 'unreadable-file.js';

            // Create a fresh scanner instance to avoid mock interference
            const freshScanner = require('../services/repositoryScanner');

            // Mock file stats but fail on read
            jest.spyOn(fs, 'stat').mockResolvedValueOnce({ size: 1024 });
            jest.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('Permission denied'));

            const result = await freshScanner.scanFile(filePath, relativePath);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('File Read Error');
            expect(result[0].value).toContain('Permission denied');
        });

        test('should calculate line and column numbers correctly', () => {
            const content = 'line 1\nline 2\nline 3 with secret';
            const index = content.indexOf('secret');

            expect(scanner.getLineNumber(content, index)).toBe(3);
            expect(scanner.getColumnNumber(content, index)).toBe(13); // Column is 1-based, so 'secret' starts at column 13
        });

        test('should cleanup repository successfully', async () => {
            const scanId = 'test-scan-id';
            scanner.activeScans.set(scanId, {
                path: '/tmp/test-repo',
                repoInfo: { fullName: 'test/repo' },
                startTime: Date.now()
            });

            const result = await scanner.cleanupRepository(scanId);

            expect(result).toBe(true);
            expect(scanner.activeScans.has(scanId)).toBe(false);
            expect(fs.remove).toHaveBeenCalledWith('/tmp/test-repo');
        });

        test('should handle cleanup failure gracefully', async () => {
            const scanId = 'test-scan-id';
            scanner.activeScans.set(scanId, {
                path: '/tmp/test-repo',
                repoInfo: { fullName: 'test/repo' },
                startTime: Date.now()
            });

            jest.spyOn(fs, 'remove').mockRejectedValue(new Error('Cleanup failed'));
            jest.spyOn(console, 'warn').mockImplementation(() => { });

            const result = await scanner.cleanupRepository(scanId);

            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to cleanup repository'));
        });
    });

    describe('Integration with scan method', () => {
        beforeEach(() => {
            // Mock all file system operations
            jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            jest.spyOn(fs, 'remove').mockResolvedValue();
            jest.spyOn(fs, 'readdir').mockResolvedValue(['test.js']);
            jest.spyOn(fs, 'stat').mockResolvedValue({
                isDirectory: () => false,
                isFile: () => true,
                size: 1024
            });
            jest.spyOn(fs, 'readFile').mockResolvedValue('const apiKey = "sk-test123";');
        });

        test('should perform full repository scan workflow', async () => {
            const target = { value: 'https://github.com/owner/repo' };
            const options = {
                onProgress: jest.fn(),
                maxFiles: 10,
                depth: 1
            };

            // Mock successful git operations
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });
            mockGit.log.mockResolvedValue({
                latest: { hash: 'abc123', date: '2023-01-01', message: 'Test', author_name: 'Test' }
            });
            mockGit.getRemotes.mockResolvedValue([]);
            mockGit.branch.mockResolvedValue({ current: 'main' });

            // Mock pattern engine
            jest.spyOn(scanner.patternEngine, 'scanContent').mockReturnValue([
                {
                    pattern: { id: 'test-secret', name: 'Test Secret', severity: 'high', category: 'secrets' },
                    value: 'sk-test123',
                    confidence: 0.9,
                    index: 15,
                    context: { before: 'const apiKey = "', after: '";' }
                }
            ]);

            const result = await scanner.scan(target, options);

            expect(options.onProgress).toHaveBeenCalledWith(5);
            expect(options.onProgress).toHaveBeenCalledWith(10);
            expect(options.onProgress).toHaveBeenCalledWith(20);
            expect(options.onProgress).toHaveBeenCalledWith(100);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('Test Secret');
            expect(result[0].severity).toBe('high');
            expect(result[0].value).toBe('sk-test123');
            expect(result[0].metadata.repository.fullName).toBe('owner/repo');
            expect(result[0].metadata.scanStats.filesScanned).toBe(1);
        });

        test('should throw error for invalid URL in scan method', async () => {
            const target = { value: 'invalid-url' };

            await expect(scanner.scan(target)).rejects.toThrow('Unsupported repository URL format');
        });

        test('should throw error for inaccessible repository in scan method', async () => {
            const target = { value: 'https://github.com/owner/nonexistent' };

            // Mock accessibility check failure
            mockGit.clone.mockRejectedValue(new Error('Repository not found (404)'));

            await expect(scanner.scan(target)).rejects.toThrow('Repository not found');
        });

        test('should cleanup on scan error', async () => {
            const target = { value: 'https://github.com/owner/repo' };

            // Mock successful initial steps but fail during file scanning
            mockGit.clone.mockResolvedValue();
            mockGit.status.mockResolvedValue({ current: 'main' });
            mockGit.log.mockResolvedValue({
                latest: { hash: 'abc123', date: '2023-01-01', message: 'Test', author_name: 'Test' }
            });
            mockGit.getRemotes.mockResolvedValue([]);
            mockGit.branch.mockResolvedValue({ current: 'main' });

            // Fail during file scanning
            jest.spyOn(fs, 'readdir').mockRejectedValue(new Error('File system error'));

            await expect(scanner.scan(target)).rejects.toThrow('File system error');

            // Verify cleanup was attempted
            expect(fs.remove).toHaveBeenCalled();
        });
    });
});