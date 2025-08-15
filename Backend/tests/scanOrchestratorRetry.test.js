/**
 * Scan Orchestrator Retry Tests - Test error recovery and graceful degradation
 * Requirements: 7.2, 7.5
 */

const { ScanOrchestrator } = require('../services/scanOrchestrator');
const EventEmitter = require('events');

describe('Scan Orchestrator Error Recovery', () => {
    let orchestrator;
    let mockScanners;

    beforeEach(() => {
        orchestrator = new ScanOrchestrator();

        // Mock scanners with different failure scenarios
        mockScanners = {
            url: {
                scan: jest.fn()
            },
            repository: {
                scan: jest.fn()
            },
            files: {
                scan: jest.fn()
            },
            headers: {
                scan: jest.fn()
            },
            owasp: {
                scan: jest.fn()
            }
        };

        // Mock getScannerForType method
        jest.spyOn(orchestrator, 'getScannerForType').mockImplementation((scanType) => {
            return mockScanners[scanType];
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Phase Error Recovery', () => {
        test('should retry failed phases with exponential backoff', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files'],
                options: {}
            };

            // Mock URL scanner to fail twice then succeed
            mockScanners.url.scan
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockResolvedValueOnce([{ type: 'secret', value: 'api-key' }]);

            // Mock files scanner to succeed immediately
            mockScanners.files.scan.mockResolvedValue([{ type: 'file', value: '.env' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('completed');
            expect(results.results.categories).toHaveLength(2);
            expect(mockScanners.url.scan).toHaveBeenCalledTimes(3); // Initial + 2 retries
            expect(mockScanners.files.scan).toHaveBeenCalledTimes(1);
        });

        test('should continue with partial results when phase fails after retries', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files', 'headers'],
                options: {}
            };

            // Mock URL scanner to always fail (retryable error)
            mockScanners.url.scan.mockRejectedValue(new Error('ECONNRESET'));

            // Mock other scanners to succeed
            mockScanners.files.scan.mockResolvedValue([{ type: 'file', value: '.env' }]);
            mockScanners.headers.scan.mockResolvedValue([{ type: 'header', value: 'missing-csp' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('partial');
            expect(results.results.categories).toHaveLength(2); // files and headers succeeded
            expect(results.errors).toHaveLength(1);
            expect(results.errors[0].phase).toBe('url');
            expect(mockScanners.url.scan).toHaveBeenCalledTimes(4); // Initial + 3 retries
        });

        test('should not retry non-recoverable errors', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            // Mock URL scanner to fail with non-recoverable error
            const nonRecoverableError = new Error('Invalid URL format');
            nonRecoverableError.code = 'INVALID_URL';
            mockScanners.url.scan.mockRejectedValue(nonRecoverableError);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('failed');
            expect(mockScanners.url.scan).toHaveBeenCalledTimes(1); // No retries
        });

        test('should handle critical errors by stopping scan', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files', 'headers'],
                options: {}
            };

            // Mock URL scanner to fail with critical error
            const criticalError = new Error('Authentication failed');
            criticalError.code = 'AUTHENTICATION_FAILED';
            mockScanners.url.scan.mockRejectedValue(criticalError);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for scan completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('failed');
            expect(mockScanners.url.scan).toHaveBeenCalledTimes(1);
            expect(mockScanners.files.scan).not.toHaveBeenCalled(); // Should not continue
            expect(mockScanners.headers.scan).not.toHaveBeenCalled();
        });
    });

    describe('Timeout Handling', () => {
        test('should handle scan timeout gracefully', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            // Mock URL scanner to hang indefinitely
            mockScanners.url.scan.mockImplementation(() => new Promise(() => { }));

            // Set short timeout for testing
            orchestrator.scanTimeout = 100;

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for timeout
            await new Promise((resolve) => {
                orchestrator.on('scanTimeout', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('timeout');
            expect(results.errors).toHaveLength(1);
            expect(results.errors[0].phase).toBe('timeout');
        });

        test('should complete successfully before timeout', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            // Mock URL scanner to succeed quickly
            mockScanners.url.scan.mockResolvedValue([{ type: 'secret', value: 'api-key' }]);

            // Set reasonable timeout
            orchestrator.scanTimeout = 5000;

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('completed');
            expect(results.results.categories).toHaveLength(1);
        });
    });

    describe('Resource Management', () => {
        test('should handle resource constraints gracefully', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files'],
                options: {}
            };

            // Mock resource constraint error
            const resourceError = new Error('Insufficient memory');
            resourceError.code = 'ENOMEM';

            mockScanners.url.scan.mockRejectedValue(resourceError);
            mockScanners.files.scan.mockResolvedValue([{ type: 'file', value: '.env' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('partial');
            expect(results.results.categories).toHaveLength(1); // Only files succeeded
            expect(results.errors).toHaveLength(1);
            expect(results.errors[0].error).toContain('Insufficient memory');
        });

        test('should limit concurrent scans', async () => {
            orchestrator.maxConcurrentScans = 2;

            const scanRequests = [
                { url: 'https://example1.com', scanTypes: ['url'] },
                { url: 'https://example2.com', scanTypes: ['url'] },
                { url: 'https://example3.com', scanTypes: ['url'] }
            ];

            // Mock scanners to hang
            mockScanners.url.scan.mockImplementation(() => new Promise(() => { }));

            const scanIds = await Promise.all(
                scanRequests.map(req => orchestrator.startScan(req))
            );

            // Check that only maxConcurrentScans are running
            const activeScans = scanIds.map(id => orchestrator.getScanStatus(id))
                .filter(status => status && status.status === 'running');

            expect(activeScans.length).toBeLessThanOrEqual(orchestrator.maxConcurrentScans);
        });
    });

    describe('Progress Tracking During Recovery', () => {
        test('should track progress correctly during retries', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files'],
                options: {}
            };

            const progressEvents = [];
            const phaseEvents = [];

            orchestrator.on('scanProgress', (data) => {
                progressEvents.push(data);
            });

            orchestrator.on('scanPhaseStarted', (data) => {
                phaseEvents.push({ type: 'started', ...data });
            });

            orchestrator.on('scanPhaseCompleted', (data) => {
                phaseEvents.push({ type: 'completed', ...data });
            });

            orchestrator.on('scanPhaseRecovered', (data) => {
                phaseEvents.push({ type: 'recovered', ...data });
            });

            // Mock URL scanner to fail once then succeed
            mockScanners.url.scan
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValueOnce([{ type: 'secret', value: 'api-key' }]);

            mockScanners.files.scan.mockResolvedValue([{ type: 'file', value: '.env' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('completed');
            expect(phaseEvents.filter(e => e.type === 'started')).toHaveLength(2);
            expect(phaseEvents.filter(e => e.type === 'recovered')).toHaveLength(1);
            expect(phaseEvents.filter(e => e.type === 'completed')).toHaveLength(1);
        });

        test('should update progress correctly with partial failures', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files', 'headers'],
                options: {}
            };

            // Mock mixed success/failure scenario
            mockScanners.url.scan.mockRejectedValue(new Error('ECONNRESET'));
            mockScanners.files.scan.mockResolvedValue([{ type: 'file', value: '.env' }]);
            mockScanners.headers.scan.mockResolvedValue([{ type: 'header', value: 'missing-csp' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('partial');
            expect(results.progress.current).toBe(3); // All phases attempted
            expect(results.progress.total).toBe(3);

            const phases = results.progress.phases;
            expect(phases[0].status).toBe('failed'); // url
            expect(phases[1].status).toBe('completed'); // files
            expect(phases[2].status).toBe('completed'); // headers
        });
    });

    describe('Error Classification and Recovery', () => {
        test('should classify errors correctly for recovery decisions', async () => {
            const testCases = [
                { error: new Error('ECONNRESET'), recoverable: true },
                { error: new Error('ETIMEDOUT'), recoverable: true },
                { error: new Error('ENOTFOUND'), recoverable: true },
                { error: new Error('Invalid input'), recoverable: false },
                { error: Object.assign(new Error('Not Found'), { code: 'INVALID_URL' }), recoverable: false }
            ];

            for (const testCase of testCases) {
                const result = orchestrator.isRecoverableError(testCase.error);
                expect(result).toBe(testCase.recoverable);
            }
        });

        test('should identify critical errors correctly', async () => {
            const testCases = [
                { error: new Error('INVALID_URL'), critical: true },
                { error: new Error('AUTHENTICATION_FAILED'), critical: true },
                { error: new Error('PERMISSION_DENIED'), critical: true },
                { error: new Error('ECONNRESET'), critical: false },
                { error: new Error('Temporary failure'), critical: false }
            ];

            for (const testCase of testCases) {
                const result = orchestrator.isCriticalError(testCase.error);
                expect(result).toBe(testCase.critical);
            }
        });
    });

    describe('Graceful Degradation', () => {
        test('should provide meaningful error messages for different failure types', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files'],
                options: {}
            };

            // Mock different types of failures
            const networkError = new Error('Network unreachable');
            networkError.code = 'ENETUNREACH';

            const timeoutError = new Error('Request timeout');
            timeoutError.code = 'ETIMEDOUT';

            mockScanners.url.scan.mockRejectedValue(networkError);
            mockScanners.files.scan.mockRejectedValue(timeoutError);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('failed');
            expect(results.errors).toHaveLength(2);

            const urlError = results.errors.find(e => e.phase === 'url');
            const filesError = results.errors.find(e => e.phase === 'files');

            expect(urlError.error).toContain('Network unreachable');
            expect(filesError.error).toContain('Request timeout');
        });

        test('should maintain scan state consistency during failures', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url', 'files', 'headers'],
                options: {}
            };

            // Mock mixed scenario
            mockScanners.url.scan.mockResolvedValue([{ type: 'secret', value: 'api-key' }]);
            mockScanners.files.scan.mockRejectedValue(new Error('ECONNRESET'));
            mockScanners.headers.scan.mockResolvedValue([{ type: 'header', value: 'missing-csp' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            const results = orchestrator.getScanResults(scanId);

            expect(results.status).toBe('partial');
            expect(results.results.categories).toHaveLength(2); // url and headers succeeded
            expect(results.errors).toHaveLength(1); // files failed

            // Check summary consistency
            const summary = results.results.summary;
            expect(summary.totalFindings).toBe(2);

            // Check phase consistency
            const phases = results.progress.phases;
            expect(phases.filter(p => p.status === 'completed')).toHaveLength(2);
            expect(phases.filter(p => p.status === 'failed')).toHaveLength(1);
        });
    });

    describe('Cleanup and Resource Management', () => {
        test('should cleanup scan data after completion', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            mockScanners.url.scan.mockResolvedValue([{ type: 'secret', value: 'api-key' }]);

            const scanId = await orchestrator.startScan(scanRequest);

            // Wait for completion
            await new Promise((resolve) => {
                orchestrator.on('scanCompleted', resolve);
            });

            // Verify scan data exists
            expect(orchestrator.getScanStatus(scanId)).toBeTruthy();
            expect(orchestrator.getScanResults(scanId)).toBeTruthy();

            // Cleanup old scans
            const cleaned = orchestrator.cleanup(0); // Cleanup immediately

            expect(cleaned).toBe(1);
            expect(orchestrator.getScanStatus(scanId)).toBeNull();
            expect(orchestrator.getScanResults(scanId)).toBeNull();
        });

        test('should handle cleanup during active scans', async () => {
            const scanRequest = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {}
            };

            // Mock scanner to hang
            mockScanners.url.scan.mockImplementation(() => new Promise(() => { }));

            const scanId = await orchestrator.startScan(scanRequest);

            // Try to cleanup while scan is running
            const cleaned = orchestrator.cleanup(0);

            // Should not cleanup active scans
            expect(cleaned).toBe(0);
            expect(orchestrator.getScanStatus(scanId)).toBeTruthy();
        });
    });
});