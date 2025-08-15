/**
 * Scanner Retry Integration Tests - Test retry logic integration in scanners
 * Requirements: 7.2, 7.5
 */

const repositoryScanner = require('../services/repositoryScanner');
const fileDetectionScanner = require('../services/fileDetectionScanner');
const nock = require('nock');
const fs = require('fs-extra');
const path = require('path');

describe('Scanner Retry Integration', () => {
    beforeEach(() => {
        // Clean up any existing nock interceptors
        nock.cleanAll();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('Repository Scanner Retry Logic', () => {
        test('should retry repository accessibility check on network failures', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'test-owner',
                repo: 'test-repo',
                fullName: 'test-owner/test-repo',
                cloneUrl: 'https://github.com/test-owner/test-repo.git'
            };

            // Mock git operations to simulate network failures then success
            const originalSimpleGit = require('simple-git');
            const mockGit = {
                clone: jest.fn()
                    .mockRejectedValueOnce(new Error('ECONNRESET'))
                    .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                    .mockResolvedValueOnce(undefined)
            };

            jest.doMock('simple-git', () => () => mockGit);

            // Mock fs operations
            jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            jest.spyOn(fs, 'remove').mockResolvedValue();
            jest.spyOn(fs, 'stat').mockResolvedValue({ size: 1000, mtime: new Date() });
            jest.spyOn(fs, 'readdir').mockResolvedValue([]);

            const result = await repositoryScanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(true);
            expect(mockGit.clone).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        test('should not retry on non-retryable repository errors', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'test-owner',
                repo: 'private-repo',
                fullName: 'test-owner/private-repo',
                cloneUrl: 'https://github.com/test-owner/private-repo.git'
            };

            // Mock git operations to simulate 404 error
            const mockGit = {
                clone: jest.fn().mockRejectedValue(new Error('Repository not found'))
            };

            jest.doMock('simple-git', () => () => mockGit);
            jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            jest.spyOn(fs, 'remove').mockResolvedValue();

            const result = await repositoryScanner.checkRepositoryAccessibility(repoInfo);

            expect(result.accessible).toBe(false);
            expect(result.error.code).toBe('REPOSITORY_NOT_FOUND');
            expect(mockGit.clone).toHaveBeenCalledTimes(1); // No retries for 404
        });

        test('should retry clone operations with cleanup on failure', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'test-owner',
                repo: 'test-repo',
                fullName: 'test-owner/test-repo',
                cloneUrl: 'https://github.com/test-owner/test-repo.git'
            };

            // Mock resource availability check
            jest.spyOn(repositoryScanner, 'checkResourceAvailability').mockResolvedValue({
                available: true,
                checks: {}
            });

            // Mock git operations
            const mockGit = {
                clone: jest.fn()
                    .mockRejectedValueOnce(new Error('ECONNRESET'))
                    .mockResolvedValueOnce(undefined)
            };

            const mockRepoGit = {
                status: jest.fn().mockResolvedValue({ current: 'main' })
            };

            jest.doMock('simple-git', () => (path) => path ? mockRepoGit : mockGit);

            // Mock fs operations
            const ensureDirSpy = jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            const removeSpy = jest.spyOn(fs, 'remove').mockResolvedValue();
            jest.spyOn(repositoryScanner, 'getDirectorySize').mockResolvedValue(1000);

            const result = await repositoryScanner.cloneRepository(repoInfo);

            expect(result.scanId).toBeDefined();
            expect(result.clonePath).toBeDefined();
            expect(mockGit.clone).toHaveBeenCalledTimes(2); // Initial + 1 retry
            expect(removeSpy).toHaveBeenCalled(); // Cleanup on retry
            expect(ensureDirSpy).toHaveBeenCalled();
        });

        test('should handle repository size limits with proper error', async () => {
            const repoInfo = {
                platform: 'github',
                owner: 'test-owner',
                repo: 'large-repo',
                fullName: 'test-owner/large-repo',
                cloneUrl: 'https://github.com/test-owner/large-repo.git'
            };

            jest.spyOn(repositoryScanner, 'checkResourceAvailability').mockResolvedValue({
                available: true,
                checks: {}
            });

            const mockGit = {
                clone: jest.fn().mockResolvedValue(undefined)
            };

            const mockRepoGit = {
                status: jest.fn().mockResolvedValue({ current: 'main' })
            };

            jest.doMock('simple-git', () => (path) => path ? mockRepoGit : mockGit);

            jest.spyOn(fs, 'ensureDir').mockResolvedValue();
            jest.spyOn(fs, 'remove').mockResolvedValue();
            // Mock large repository size
            jest.spyOn(repositoryScanner, 'getDirectorySize').mockResolvedValue(600 * 1024 * 1024); // 600MB

            await expect(repositoryScanner.cloneRepository(repoInfo)).rejects.toThrow('REPOSITORY_TOO_LARGE');
            expect(fs.remove).toHaveBeenCalled(); // Should cleanup oversized repo
        });
    });

    describe('File Detection Scanner Retry Logic', () => {
        test('should retry file accessibility checks on network failures', async () => {
            const target = { value: 'https://example.com' };

            // Mock HTTP requests with failures then success
            nock('https://example.com')
                .get('/.env')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/.env')
                .replyWithError({ code: 'ETIMEDOUT' })
                .get('/.env')
                .reply(200, 'API_KEY=secret123', {
                    'content-type': 'text/plain',
                    'content-length': '15'
                });

            // Mock other file checks to return 404
            nock('https://example.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            expect(results).toHaveLength(1);
            expect(results[0].type).toBe('Exposed Sensitive File');
            expect(results[0].value).toBe('.env');
            expect(results[0].severity).toBe('critical');
        });

        test('should not retry on 404 errors', async () => {
            const target = { value: 'https://example.com' };

            // Mock all requests to return 404
            const scope = nock('https://example.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            expect(results).toHaveLength(0);
            // Should not have excessive requests due to retries on 404s
            expect(scope.isDone()).toBe(true);
        });

        test('should retry directory listing checks with proper error handling', async () => {
            const target = { value: 'https://example.com' };

            // Mock sensitive file checks to return 404
            nock('https://example.com')
                .get(/\/\.[^\/]*$/) // Files starting with dot
                .reply(404)
                .persist();

            // Mock directory listing with retry scenario
            nock('https://example.com')
                .get('/admin/')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/admin/')
                .reply(200, '<html><title>Index of /admin</title><body><h1>Index of /admin</h1></body></html>', {
                    'content-type': 'text/html'
                });

            // Mock other directory checks to return 404
            nock('https://example.com')
                .get(/.*\/$/)
                .reply(404)
                .persist();

            // Mock backup file checks to return 404
            nock('https://example.com')
                .get(/.*\.(bak|backup|old)$/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            expect(results).toHaveLength(1);
            expect(results[0].type).toBe('Directory Listing Vulnerability');
            expect(results[0].value).toBe('admin');
            expect(results[0].severity).toBe('critical');
        });

        test('should handle mixed success and failure scenarios', async () => {
            const target = { value: 'https://example.com' };

            // Mock .env file to succeed after retry
            nock('https://example.com')
                .get('/.env')
                .replyWithError({ code: 'ETIMEDOUT' })
                .get('/.env')
                .reply(200, 'DATABASE_URL=postgres://user:pass@localhost/db', {
                    'content-type': 'text/plain'
                });

            // Mock .git/config to fail permanently (non-retryable)
            nock('https://example.com')
                .get('/.git/config')
                .reply(403, 'Forbidden');

            // Mock config.js to succeed immediately
            nock('https://example.com')
                .get('/config.js')
                .reply(200, 'module.exports = { apiKey: "test123" };', {
                    'content-type': 'application/javascript'
                });

            // Mock all other requests to return 404
            nock('https://example.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            expect(results).toHaveLength(2); // .env and config.js should be found

            const envResult = results.find(r => r.value === '.env');
            const configResult = results.find(r => r.value === 'config.js');

            expect(envResult).toBeDefined();
            expect(envResult.severity).toBe('critical');
            expect(configResult).toBeDefined();
            expect(configResult.severity).toBe('high');
        });

        test('should handle timeout errors with proper retry logic', async () => {
            const target = { value: 'https://slow-server.com' };

            // Mock slow server responses
            nock('https://slow-server.com')
                .get('/.env')
                .delayConnection(15000) // Longer than axios timeout
                .reply(200, 'API_KEY=secret')
                .get('/.env')
                .reply(200, 'API_KEY=secret123', {
                    'content-type': 'text/plain'
                });

            // Mock other requests to return 404 quickly
            nock('https://slow-server.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            expect(results).toHaveLength(1);
            expect(results[0].value).toBe('.env');
        });
    });

    describe('Error Recovery and Graceful Degradation', () => {
        test('should continue scanning other files when some fail', async () => {
            const target = { value: 'https://example.com' };

            // Mock mixed responses
            nock('https://example.com')
                .get('/.env')
                .reply(200, 'API_KEY=secret123')
                .get('/.git/config')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/.git/config')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/.git/config')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/.git/config')
                .replyWithError({ code: 'ECONNRESET' }) // Exhaust retries
                .get('/config.js')
                .reply(200, 'module.exports = { secret: "test" };');

            // Mock all other requests to return 404
            nock('https://example.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            // Should find .env and config.js despite .git/config failure
            expect(results).toHaveLength(2);
            expect(results.map(r => r.value)).toContain('.env');
            expect(results.map(r => r.value)).toContain('config.js');
        });

        test('should provide partial results when network is unstable', async () => {
            const target = { value: 'https://unstable-server.com' };

            let requestCount = 0;
            nock('https://unstable-server.com')
                .get(/.*/)
                .reply(() => {
                    requestCount++;
                    // Simulate 50% failure rate
                    if (requestCount % 2 === 0) {
                        throw new Error('ECONNRESET');
                    }
                    return [404, 'Not Found'];
                })
                .persist();

            // Override with some successful responses
            nock('https://unstable-server.com')
                .get('/.env')
                .reply(200, 'API_KEY=found')
                .get('/config.js')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/config.js')
                .reply(200, 'module.exports = {};');

            const results = await fileDetectionScanner.scan(target);

            // Should get some results despite network instability
            expect(results.length).toBeGreaterThan(0);
        });

        test('should handle resource constraints gracefully', async () => {
            const target = { value: 'https://example.com' };

            // Mock memory pressure scenario
            const originalMemoryUsage = process.memoryUsage;
            let memoryPressure = false;

            process.memoryUsage = jest.fn().mockImplementation(() => ({
                rss: memoryPressure ? 2 * 1024 * 1024 * 1024 : 100 * 1024 * 1024, // 2GB vs 100MB
                heapTotal: memoryPressure ? 1024 * 1024 * 1024 : 50 * 1024 * 1024,
                heapUsed: memoryPressure ? 950 * 1024 * 1024 : 25 * 1024 * 1024,
                external: 0,
                arrayBuffers: 0
            }));

            // Mock HTTP responses
            nock('https://example.com')
                .get('/.env')
                .reply(200, 'API_KEY=secret123')
                .get('/.git/config')
                .reply(() => {
                    memoryPressure = true; // Simulate memory pressure during scan
                    return [200, '[core]\n    repositoryformatversion = 0'];
                });

            // Mock other requests
            nock('https://example.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target);

            // Should complete scan despite memory pressure
            expect(results.length).toBeGreaterThanOrEqual(1);

            // Restore original function
            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('Progress Tracking with Retries', () => {
        test('should track progress correctly during retries', async () => {
            const target = { value: 'https://example.com' };
            const progressUpdates = [];

            // Mock some files with retry scenarios
            nock('https://example.com')
                .get('/.env')
                .replyWithError({ code: 'ECONNRESET' })
                .get('/.env')
                .reply(200, 'API_KEY=secret123')
                .get('/.git/config')
                .reply(200, '[core]\n    repositoryformatversion = 0');

            // Mock all other requests to return 404
            nock('https://example.com')
                .get(/.*/)
                .reply(404)
                .persist();

            const results = await fileDetectionScanner.scan(target, {
                onProgress: (progress) => {
                    progressUpdates.push(progress);
                }
            });

            expect(results).toHaveLength(2);
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1]).toBe(100); // Should complete at 100%
        });
    });
});