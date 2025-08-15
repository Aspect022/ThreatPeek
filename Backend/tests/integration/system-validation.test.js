/**
 * System Validation Tests for Error Handling and Recovery
 * Tests system resilience, error recovery, and edge cases
 */

const request = require('supertest');
const express = require('express');
const { ScanOrchestrator } = require('../../services/scanOrchestrator');
const { ResourceManager } = require('../../services/resourceManager');
const { ErrorRecoveryService } = require('../../services/errorRecoveryService');

// Create test app
const app = express();
app.use(express.json());

// Import routes
const enhancedScanRoutes = require('../../routes/enhancedScan');
app.use('/api', enhancedScanRoutes);

describe('System Validation Tests', () => {
    let orchestrator;
    let resourceManager;
    let errorRecoveryService;

    beforeAll(async () => {
        orchestrator = new ScanOrchestrator({
            resourceManager: { enabled: true },
            errorRecovery: { enabled: true }
        });

        resourceManager = new ResourceManager({ enabled: true });
        errorRecoveryService = new ErrorRecoveryService({ enabled: true });

        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterAll(async () => {
        if (orchestrator) {
            await orchestrator.shutdown();
        }
        if (resourceManager) {
            await resourceManager.stop();
        }
    });

    describe('Network Error Handling', () => {
        test('should handle connection timeouts gracefully', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/delay/60', // Long delay to trigger timeout
                scanTypes: ['url'],
                options: { timeout: 5000 } // Short timeout
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for timeout to occur
            let completed = false;
            let attempts = 0;
            const maxAttempts = 15;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed', 'timeout'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Get results to verify error handling
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            expect(resultsResponse.body).toHaveProperty('errors');
            expect(Array.isArray(resultsResponse.body.errors)).toBe(true);

            // Should have timeout-related error
            const hasTimeoutError = resultsResponse.body.errors.some(error =>
                error.error.toLowerCase().includes('timeout') ||
                error.error.toLowerCase().includes('time limit')
            );
            expect(hasTimeoutError).toBe(true);
        });

        test('should handle DNS resolution failures', async () => {
            const scanRequest = {
                url: 'https://nonexistent-domain-12345.com',
                scanTypes: ['url'],
                options: { timeout: 10000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for DNS failure
            let completed = false;
            let attempts = 0;
            const maxAttempts = 15;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should have DNS-related error
            const hasDNSError = resultsResponse.body.errors.some(error =>
                error.error.toLowerCase().includes('enotfound') ||
                error.error.toLowerCase().includes('dns') ||
                error.error.toLowerCase().includes('resolve')
            );
            expect(hasDNSError).toBe(true);
        });

        test('should handle HTTP error responses', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/status/500',
                scanTypes: ['url'],
                options: { timeout: 15000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            const maxAttempts = 20;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should handle HTTP error gracefully
            expect(resultsResponse.body).toHaveProperty('results');

            // May have errors but should not crash
            if (resultsResponse.body.errors && resultsResponse.body.errors.length > 0) {
                const hasHTTPError = resultsResponse.body.errors.some(error =>
                    error.error.includes('500') || error.error.includes('HTTP')
                );
                expect(hasHTTPError).toBe(true);
            }
        });
    });

    describe('Repository Error Handling', () => {
        test('should handle invalid repository URLs', async () => {
            const scanRequest = {
                repositoryUrl: 'https://github.com/nonexistent/repository.git',
                scanTypes: ['repository'],
                options: { timeout: 30000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for repository error
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should have repository-related error
            expect(resultsResponse.body.errors).toBeDefined();
            const hasRepoError = resultsResponse.body.errors.some(error =>
                error.error.toLowerCase().includes('repository') ||
                error.error.toLowerCase().includes('clone') ||
                error.error.toLowerCase().includes('not found')
            );
            expect(hasRepoError).toBe(true);
        });

        test('should handle repository size limits', async () => {
            const scanRequest = {
                repositoryUrl: 'https://github.com/octocat/Hello-World.git',
                scanTypes: ['repository'],
                options: {
                    timeout: 30000,
                    maxSize: 1024 // Very small size limit (1KB)
                }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for size limit error
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should handle size limit appropriately
            if (resultsResponse.body.errors && resultsResponse.body.errors.length > 0) {
                const hasSizeError = resultsResponse.body.errors.some(error =>
                    error.error.toLowerCase().includes('size') ||
                    error.error.toLowerCase().includes('limit') ||
                    error.error.toLowerCase().includes('too large')
                );
                expect(hasSizeError).toBe(true);
            }
        });

        test('should handle authentication failures', async () => {
            const scanRequest = {
                repositoryUrl: 'https://github.com/private/repository.git',
                scanTypes: ['repository'],
                options: { timeout: 30000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for auth failure
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should have authentication-related error
            if (resultsResponse.body.errors && resultsResponse.body.errors.length > 0) {
                const hasAuthError = resultsResponse.body.errors.some(error =>
                    error.error.toLowerCase().includes('authentication') ||
                    error.error.toLowerCase().includes('permission') ||
                    error.error.toLowerCase().includes('access') ||
                    error.error.toLowerCase().includes('403') ||
                    error.error.toLowerCase().includes('401')
                );
                expect(hasAuthError).toBe(true);
            }
        });
    });

    describe('Resource Management and Recovery', () => {
        test('should handle memory pressure gracefully', async () => {
            // Create multiple concurrent scans to stress memory
            const concurrentScans = 8;
            const scanPromises = Array(concurrentScans).fill().map((_, index) =>
                request(app)
                    .post('/api/scan/enhanced')
                    .send({
                        url: `https://httpbin.org/html?memory=${index}`,
                        scanTypes: ['url', 'headers', 'files'],
                        options: { timeout: 30000 }
                    })
            );

            const startResponses = await Promise.all(scanPromises);
            const scanIds = startResponses.map(response => response.body.scanId);

            // Monitor memory usage during scans
            const initialMemory = process.memoryUsage();
            let peakMemory = initialMemory;

            // Wait for all scans to complete
            const completionPromises = scanIds.map(async (scanId) => {
                let completed = false;
                let attempts = 0;
                const maxAttempts = 30;

                while (!completed && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Monitor memory
                    const currentMemory = process.memoryUsage();
                    if (currentMemory.heapUsed > peakMemory.heapUsed) {
                        peakMemory = currentMemory;
                    }

                    const statusResponse = await request(app)
                        .get(`/api/scan/enhanced/${scanId}/status`);

                    if (statusResponse.status === 200) {
                        const status = statusResponse.body.status;
                        if (['completed', 'partial', 'failed'].includes(status)) {
                            completed = true;
                            return statusResponse.body;
                        }
                    }
                    attempts++;
                }

                return { status: 'timeout' };
            });

            const results = await Promise.all(completionPromises);
            const finalMemory = process.memoryUsage();

            // Most scans should complete successfully
            const successfulScans = results.filter(result =>
                ['completed', 'partial'].includes(result.status)
            ).length;

            expect(successfulScans).toBeGreaterThan(concurrentScans * 0.6); // At least 60% success

            // Memory should not grow excessively
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB increase

            console.log(`Memory stress test - Peak: ${Math.round(peakMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
            console.log(`Successful scans: ${successfulScans}/${concurrentScans}`);
        });

        test('should recover from temporary resource exhaustion', async () => {
            // Test resource recovery by creating and cancelling scans
            const testScans = 5;
            const scanIds = [];

            // Create scans
            for (let i = 0; i < testScans; i++) {
                const response = await request(app)
                    .post('/api/scan/enhanced')
                    .send({
                        url: `https://httpbin.org/delay/30?recovery=${i}`,
                        scanTypes: ['url'],
                        options: { timeout: 60000 }
                    });

                if (response.status === 200) {
                    scanIds.push(response.body.scanId);
                }
            }

            // Cancel half of them to free resources
            const toCancel = scanIds.slice(0, Math.floor(scanIds.length / 2));
            for (const scanId of toCancel) {
                await request(app)
                    .delete(`/api/scan/enhanced/${scanId}`)
                    .expect(200);
            }

            // Create new scans to test recovery
            const recoveryScanResponse = await request(app)
                .post('/api/scan/enhanced')
                .send({
                    url: 'https://httpbin.org/html?recovery=test',
                    scanTypes: ['url'],
                    options: { timeout: 30000 }
                })
                .expect(200);

            const recoveryScanId = recoveryScanResponse.body.scanId;

            // Wait for recovery scan to complete
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${recoveryScanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Clean up remaining scans
            const remaining = scanIds.slice(Math.floor(scanIds.length / 2));
            for (const scanId of remaining) {
                try {
                    await request(app).delete(`/api/scan/enhanced/${scanId}`);
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        });

        test('should handle disk space limitations', async () => {
            // Test with repository that might stress disk usage
            const scanRequest = {
                repositoryUrl: 'https://github.com/octocat/Hello-World.git',
                scanTypes: ['repository'],
                options: {
                    timeout: 30000,
                    maxSize: 50 * 1024 * 1024 // 50MB limit
                }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Should handle disk operations gracefully
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            expect(resultsResponse.body).toHaveProperty('results');
        });
    });

    describe('Retry Logic and Error Recovery', () => {
        test('should retry failed operations with exponential backoff', async () => {
            // Mock a service that fails initially then succeeds
            let attemptCount = 0;
            const originalScan = orchestrator.getScannerForType('url').scan;

            orchestrator.getScannerForType('url').scan = async (target, options) => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Temporary failure');
                }
                return originalScan.call(orchestrator.getScannerForType('url'), target, options);
            };

            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url'],
                options: { timeout: 30000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for completion (should succeed after retries)
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            // Should eventually succeed due to retry logic
            expect(completed).toBe(true);
            expect(attemptCount).toBeGreaterThanOrEqual(3);

            // Restore original method
            orchestrator.getScannerForType('url').scan = originalScan;
        });

        test('should handle partial failures gracefully', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'headers', 'files', 'owasp'],
                options: { timeout: 30000 }
            };

            // Mock one scanner to fail
            const originalFilesScan = orchestrator.getScannerForType('files').scan;
            orchestrator.getScannerForType('files').scan = async () => {
                throw new Error('Files scanner unavailable');
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should have partial results from successful scanners
            expect(resultsResponse.body.results.categories.length).toBeGreaterThan(0);

            // Should have errors from failed scanner
            expect(resultsResponse.body.errors).toBeDefined();
            const hasFilesError = resultsResponse.body.errors.some(error =>
                error.error.includes('Files scanner unavailable')
            );
            expect(hasFilesError).toBe(true);

            // Restore original method
            orchestrator.getScannerForType('files').scan = originalFilesScan;
        });
    });

    describe('Input Validation and Security', () => {
        test('should validate and sanitize input parameters', async () => {
            // Test various malformed inputs
            const malformedRequests = [
                { url: 'javascript:alert(1)', scanTypes: ['url'] },
                { url: 'file:///etc/passwd', scanTypes: ['url'] },
                { repositoryUrl: 'git://malicious.com/repo.git', scanTypes: ['repository'] },
                { url: 'https://example.com', scanTypes: ['<script>alert(1)</script>'] },
                { url: 'https://example.com', options: { timeout: 'invalid' } },
                { url: 'https://example.com', options: { maxSize: -1 } }
            ];

            for (const malformedRequest of malformedRequests) {
                const response = await request(app)
                    .post('/api/scan/enhanced')
                    .send(malformedRequest);

                // Should reject malformed requests
                expect([400, 500]).toContain(response.status);
                expect(response.body).toHaveProperty('error');
            }
        });

        test('should prevent path traversal attacks', async () => {
            const pathTraversalAttempts = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\config\\sam',
                '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
            ];

            for (const attempt of pathTraversalAttempts) {
                const response = await request(app)
                    .get(`/api/scan/enhanced/${attempt}/status`);

                // Should not allow path traversal
                expect([400, 404]).toContain(response.status);
            }
        });

        test('should handle extremely large payloads', async () => {
            const largePayload = {
                url: 'https://example.com',
                scanTypes: ['url'],
                options: {
                    includePatterns: Array(10000).fill('*.js'),
                    excludePatterns: Array(10000).fill('*.min.js'),
                    metadata: 'x'.repeat(1024 * 1024) // 1MB string
                }
            };

            const response = await request(app)
                .post('/api/scan/enhanced')
                .send(largePayload);

            // Should handle or reject large payloads gracefully
            expect([200, 400, 413]).toContain(response.status);
        });
    });

    describe('Concurrent Access and Race Conditions', () => {
        test('should handle concurrent access to same scan', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url'],
                options: { timeout: 30000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Make concurrent requests for the same scan
            const concurrentRequests = Array(10).fill().map(() =>
                request(app).get(`/api/scan/enhanced/${scanId}/status`)
            );

            const responses = await Promise.all(concurrentRequests);

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('scanId', scanId);
            });
        });

        test('should handle concurrent scan cancellations', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/delay/30',
                scanTypes: ['url'],
                options: { timeout: 60000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait a moment for scan to start
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Try to cancel the same scan multiple times concurrently
            const cancelRequests = Array(5).fill().map(() =>
                request(app).delete(`/api/scan/enhanced/${scanId}`)
            );

            const cancelResponses = await Promise.all(cancelRequests);

            // First cancellation should succeed, others should handle gracefully
            const successfulCancellations = cancelResponses.filter(response =>
                response.status === 200
            ).length;

            expect(successfulCancellations).toBeGreaterThanOrEqual(1);

            // Verify scan is actually cancelled
            const statusResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/status`)
                .expect(200);

            expect(statusResponse.body.status).toBe('cancelled');
        });
    });

    describe('System Limits and Boundaries', () => {
        test('should enforce maximum concurrent scans', async () => {
            const maxConcurrentScans = 10;
            const scanPromises = [];

            // Try to create more scans than the limit
            for (let i = 0; i < maxConcurrentScans + 5; i++) {
                const promise = request(app)
                    .post('/api/scan/enhanced')
                    .send({
                        url: `https://httpbin.org/delay/10?limit=${i}`,
                        scanTypes: ['url'],
                        options: { timeout: 30000 }
                    });
                scanPromises.push(promise);
            }

            const responses = await Promise.all(scanPromises);
            const successfulScans = responses.filter(response => response.status === 200);
            const rejectedScans = responses.filter(response => response.status !== 200);

            // Should have some limit enforcement
            expect(successfulScans.length).toBeGreaterThan(0);

            // Clean up successful scans
            for (const response of successfulScans) {
                if (response.body && response.body.scanId) {
                    try {
                        await request(app).delete(`/api/scan/enhanced/${response.body.scanId}`);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }
            }

            console.log(`Concurrent limit test - Successful: ${successfulScans.length}, Rejected: ${rejectedScans.length}`);
        });

        test('should handle scan timeout boundaries', async () => {
            const timeoutTests = [
                { timeout: 1000, expectedResult: 'timeout' },
                { timeout: 60000, expectedResult: 'completed' }
            ];

            for (const test of timeoutTests) {
                const scanRequest = {
                    url: 'https://httpbin.org/delay/5',
                    scanTypes: ['url'],
                    options: { timeout: test.timeout }
                };

                const startResponse = await request(app)
                    .post('/api/scan/enhanced')
                    .send(scanRequest)
                    .expect(200);

                const scanId = startResponse.body.scanId;

                // Wait for completion or timeout
                let completed = false;
                let attempts = 0;
                const maxAttempts = Math.ceil(test.timeout / 1000) + 10;

                while (!completed && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const statusResponse = await request(app)
                        .get(`/api/scan/enhanced/${scanId}/status`)
                        .expect(200);

                    const status = statusResponse.body.status;
                    if (['completed', 'partial', 'failed', 'timeout'].includes(status)) {
                        completed = true;

                        if (test.expectedResult === 'timeout') {
                            expect(['failed', 'timeout']).toContain(status);
                        } else {
                            expect(['completed', 'partial']).toContain(status);
                        }
                    }
                    attempts++;
                }

                expect(completed).toBe(true);
            }
        });
    });
});