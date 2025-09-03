/**
 * End-to-End Integration Tests for Enhanced Scanner
 * Tests complete workflows for all new scan types
 */

const request = require('supertest');
const express = require('express');
const { ScanOrchestrator } = require('../../services/scanOrchestrator');

// Create test app
const app = express();
app.use(express.json());

// Import routes
const enhancedScanRoutes = require('../../routes/enhancedScan');
app.use('/api', enhancedScanRoutes);

describe('End-to-End Integration Tests', () => {
    let orchestrator;

    beforeAll(async () => {
        // Initialize orchestrator
        orchestrator = new ScanOrchestrator();

        // Wait for any initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterAll(async () => {
        // Cleanup orchestrator
        if (orchestrator) {
            await orchestrator.shutdown();
        }
    });

    describe('URL Scanning Workflow', () => {
        test('should complete full URL scan workflow', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'files', 'headers'],
                options: {
                    timeout: 30000,
                    confidenceThreshold: 0.5
                }
            };

            // Start scan
            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            expect(startResponse.body).toHaveProperty('scanId');
            expect(startResponse.body.status).toBe('started');

            const scanId = startResponse.body.scanId;

            // Poll for completion
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (status === 'completed' || status === 'partial' || status === 'failed') {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Get results
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            expect(resultsResponse.body).toHaveProperty('results');
            expect(resultsResponse.body.results).toHaveProperty('categories');
            expect(Array.isArray(resultsResponse.body.results.categories)).toBe(true);
        });

        test('should handle invalid URL gracefully', async () => {
            const scanRequest = {
                url: 'invalid-url',
                scanTypes: ['url']
            };

            const response = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(500);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid URL format');
        });
    });

    describe('Repository Scanning Workflow', () => {
        test('should complete repository scan workflow', async () => {
            const scanRequest = {
                repositoryUrl: 'https://github.com/octocat/Hello-World.git',
                scanTypes: ['repository'],
                options: {
                    timeout: 60000,
                    maxSize: 10 * 1024 * 1024 // 10MB
                }
            };

            // Start scan
            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            expect(startResponse.body).toHaveProperty('scanId');
            expect(startResponse.body.target.type).toBe('repository');

            const scanId = startResponse.body.scanId;

            // Poll for completion with longer timeout for repository scans
            let completed = false;
            let attempts = 0;
            const maxAttempts = 60;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (status === 'completed' || status === 'partial' || status === 'failed') {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Get results
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            expect(resultsResponse.body).toHaveProperty('results');
            expect(resultsResponse.body.target.type).toBe('repository');
        });

        test('should handle invalid repository URL', async () => {
            const scanRequest = {
                repositoryUrl: 'https://github.com/nonexistent/repo.git',
                scanTypes: ['repository']
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for scan to complete/fail
            let completed = false;
            let attempts = 0;
            const maxAttempts = 30;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                if (status === 'completed' || status === 'partial' || status === 'failed') {
                    completed = true;
                }
                attempts++;
            }

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should have errors in results
            expect(resultsResponse.body.errors).toBeDefined();
            expect(Array.isArray(resultsResponse.body.errors)).toBe(true);
        });
    });

    describe('Multi-Scan Type Workflow', () => {
        test('should handle multiple scan types simultaneously', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'files', 'headers', 'owasp'],
                options: {
                    timeout: 45000,
                    confidenceThreshold: 0.3
                }
            };

            // Start scan
            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Monitor progress
            let completed = false;
            let attempts = 0;
            const maxAttempts = 45;
            let lastProgress = -1;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                const progress = statusResponse.body.progress;

                // Verify progress is advancing
                if (progress && progress.percentage > lastProgress) {
                    lastProgress = progress.percentage;
                }

                if (status === 'completed' || status === 'partial' || status === 'failed') {
                    completed = true;
                }
                attempts++;
            }

            expect(completed).toBe(true);

            // Get results and verify all scan types were processed
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            const categories = resultsResponse.body.results.categories;
            expect(Array.isArray(categories)).toBe(true);

            // Should have results from multiple scan types
            const scanTypesCovered = categories.map(cat => cat.scanType);
            expect(scanTypesCovered.length).toBeGreaterThan(0);
        });
    });

    describe('Result Filtering and Formatting', () => {
        let scanId;

        beforeAll(async () => {
            // Create a scan with results for testing
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'headers'],
                options: { timeout: 30000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest);

            scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            while (!completed && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`);
                if (['completed', 'partial', 'failed'].includes(statusResponse.body.status)) {
                    completed = true;
                }
                attempts++;
            }
        });

        test('should filter results by severity', async () => {
            const response = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .query({ severity: 'high' })
                .expect(200);

            expect(response.body).toHaveProperty('results');
        });

        test('should filter results by category', async () => {
            const response = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .query({ category: 'headers' })
                .expect(200);

            expect(response.body).toHaveProperty('results');
        });

        test('should export results in CSV format', async () => {
            const response = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .query({ format: 'csv' })
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
        });

        test('should export results in SARIF format', async () => {
            const response = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .query({ format: 'sarif' })
                .expect(200);

            expect(response.headers['content-type']).toContain('application/json');
        });

        test('should provide consolidated report', async () => {
            const response = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .query({ consolidated: 'true' })
                .expect(200);

            expect(response.body).toHaveProperty('consolidatedReport');
        });
    });

    describe('Scan Management', () => {
        test('should cancel active scan', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/delay/30',
                scanTypes: ['url'],
                options: { timeout: 60000 }
            };

            // Start scan
            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait a moment for scan to start
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Cancel scan
            const cancelResponse = await request(app)
                .delete(`/api/scan/enhanced/${scanId}`)
                .expect(200);

            expect(cancelResponse.body.status).toBe('cancelled');

            // Verify scan is cancelled
            const statusResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/status`)
                .expect(200);

            expect(statusResponse.body.status).toBe('cancelled');
        });

        test('should handle scan not found', async () => {
            const nonExistentId = 'non-existent-scan-id';

            await request(app)
                .get(`/api/scan/enhanced/${nonExistentId}/status`)
                .expect(404);

            await request(app)
                .get(`/api/scan/enhanced/${nonExistentId}/results`)
                .expect(404);

            await request(app)
                .delete(`/api/scan/enhanced/${nonExistentId}`)
                .expect(404);
        });
    });

    describe('Feedback and Learning', () => {
        let scanId;

        beforeAll(async () => {
            // Create a scan with results for feedback testing
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url'],
                options: { timeout: 30000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest);

            scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            while (!completed && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`);
                if (['completed', 'partial', 'failed'].includes(statusResponse.body.status)) {
                    completed = true;
                }
                attempts++;
            }
        });

        test('should record false positive feedback', async () => {
            const feedbackData = {
                findingId: 'test-finding-id',
                isFalsePositive: true,
                patternId: 'test-pattern',
                metadata: {
                    userComment: 'This is a test case, not a real secret'
                }
            };

            const response = await request(app)
                .post(`/api/scan/enhanced/${scanId}/feedback`)
                .send(feedbackData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.isFalsePositive).toBe(true);
        });

        test('should get confidence statistics', async () => {
            const response = await request(app)
                .get('/api/scan/enhanced/confidence-stats')
                .expect(200);

            expect(response.body).toHaveProperty('confidenceScoring');
            expect(response.body).toHaveProperty('patternEngine');
            expect(response.body).toHaveProperty('resultFormatter');
        });
    });

    describe('API Information', () => {
        test('should get available scan types', async () => {
            const response = await request(app)
                .get('/api/scan/enhanced/types')
                .expect(200);

            expect(response.body).toHaveProperty('scanTypes');
            expect(Array.isArray(response.body.scanTypes)).toBe(true);

            const scanTypes = response.body.scanTypes.map(st => st.type);
            expect(scanTypes).toContain('url');
            expect(scanTypes).toContain('repository');
            expect(scanTypes).toContain('files');
            expect(scanTypes).toContain('headers');
            expect(scanTypes).toContain('owasp');
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle network timeouts gracefully', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/delay/60',
                scanTypes: ['url'],
                options: { timeout: 5000 } // Short timeout to trigger timeout
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
                if (status === 'completed' || status === 'partial' || status === 'failed' || status === 'timeout') {
                    completed = true;
                }
                attempts++;
            }

            // Should have completed with error status
            const finalStatusResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/status`)
                .expect(200);

            expect(['failed', 'partial', 'timeout']).toContain(finalStatusResponse.body.status);
        });

        test('should handle malformed requests', async () => {
            // Missing required fields
            await request(app)
                .post('/api/scan/enhanced')
                .send({})
                .expect(400);

            // Invalid scan types
            await request(app)
                .post('/api/scan/enhanced')
                .send({
                    url: 'https://example.com',
                    scanTypes: ['invalid-type']
                })
                .expect(500);

            // Both URL and repository URL
            await request(app)
                .post('/api/scan/enhanced')
                .send({
                    url: 'https://example.com',
                    repositoryUrl: 'https://github.com/test/repo.git',
                    scanTypes: ['url']
                })
                .expect(500);
        });
    });
});