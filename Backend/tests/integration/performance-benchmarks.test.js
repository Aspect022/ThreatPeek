/**
 * Performance Benchmarking Tests for Enhanced Scanner
 * Tests performance characteristics and resource usage
 */

const request = require('supertest');
const express = require('express');
const { ScanOrchestrator } = require('../../services/scanOrchestrator');
const { EnhancedPatternEngine } = require('../../utils/enhancedPatternEngine');
const { allPatterns } = require('../../utils/enhancedPatternDefinitions');

// Create test app
const app = express();
app.use(express.json());

// Import routes
const enhancedScanRoutes = require('../../routes/enhancedScan');
app.use('/api', enhancedScanRoutes);

describe('Performance Benchmarking Tests', () => {
    let orchestrator;
    let patternEngine;

    beforeAll(async () => {
        orchestrator = new ScanOrchestrator();
        patternEngine = new EnhancedPatternEngine();
        patternEngine.registerPatterns(allPatterns);

        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterAll(async () => {
        if (orchestrator) {
            await orchestrator.shutdown();
        }
    });

    describe('Pattern Matching Performance', () => {
        const testContent = `
            const apiKey = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";
            const stripeKey = "pk_test_TYooMQauvdEDq54NiTphI7jx";
            const githubToken = "github_pat_11ABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890abcdefghijklmnopqrstuvwxyz";
            const azureKey = "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc123==;EndpointSuffix=core.windows.net";
            const sendgridKey = "SG.1234567890abcdefghijklmn.1234567890abcdefghijklmnopqrstuvwxyz1234567890";
            const twilioKey = "SK1234567890abcdef1234567890abcdef";
            const discordToken = "MTA1NzM4ODQ2NzE2NzI4MzIwMA.GrKHhX.1234567890abcdefghijklmnopqrstuvwxyz";
            const notionKey = "secret_1234567890abcdefghijklmnopqrstuvwxyz1234567";
            const digitalOceanToken = "dop_v1_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        `.repeat(100); // Repeat to create larger content

        test('should process large content efficiently', async () => {
            const startTime = Date.now();

            const results = patternEngine.scanContent(testContent, {
                filename: 'test.js',
                url: 'https://example.com/test.js'
            });

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Should process within reasonable time (< 1 second for this content size)
            expect(processingTime).toBeLessThan(1000);

            // Should find multiple patterns
            expect(results.length).toBeGreaterThan(0);

            console.log(`Pattern matching performance: ${processingTime}ms for ${testContent.length} characters`);
            console.log(`Found ${results.length} patterns`);
        });

        test('should handle concurrent pattern matching', async () => {
            const concurrentRequests = 10;
            const startTime = Date.now();

            const promises = Array(concurrentRequests).fill().map(() =>
                patternEngine.scanContent(testContent, {
                    filename: 'test.js',
                    url: 'https://example.com/test.js'
                })
            );

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should handle concurrent requests efficiently
            expect(totalTime).toBeLessThan(5000);

            // All requests should return results
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBeGreaterThan(0);
            });

            console.log(`Concurrent pattern matching: ${totalTime}ms for ${concurrentRequests} requests`);
        });
    });

    describe('Scan Orchestrator Performance', () => {
        test('should handle multiple concurrent scans', async () => {
            const concurrentScans = 5;
            const scanRequests = Array(concurrentScans).fill().map((_, index) => ({
                url: `https://httpbin.org/html?test=${index}`,
                scanTypes: ['url', 'headers'],
                options: { timeout: 30000 }
            }));

            const startTime = Date.now();

            // Start all scans concurrently
            const startPromises = scanRequests.map(scanRequest =>
                request(app)
                    .post('/api/scan/enhanced')
                    .send(scanRequest)
            );

            const startResponses = await Promise.all(startPromises);
            const scanIds = startResponses.map(response => response.body.scanId);

            // Wait for all scans to complete
            const completionPromises = scanIds.map(async (scanId) => {
                let completed = false;
                let attempts = 0;
                const maxAttempts = 30;

                while (!completed && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const statusResponse = await request(app)
                        .get(`/api/scan/enhanced/${scanId}/status`);

                    const status = statusResponse.body.status;
                    if (['completed', 'partial', 'failed'].includes(status)) {
                        completed = true;
                        return statusResponse.body;
                    }
                    attempts++;
                }

                throw new Error(`Scan ${scanId} did not complete in time`);
            });

            const completionResults = await Promise.all(completionPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should complete all scans within reasonable time
            expect(totalTime).toBeLessThan(60000); // 1 minute

            // All scans should complete successfully
            completionResults.forEach(result => {
                expect(['completed', 'partial']).toContain(result.status);
            });

            console.log(`Concurrent scans performance: ${totalTime}ms for ${concurrentScans} scans`);
        });

        test('should manage memory efficiently during large scans', async () => {
            const initialMemory = process.memoryUsage();

            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'files', 'headers', 'owasp'],
                options: { timeout: 45000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            const maxAttempts = 45;
            let peakMemory = initialMemory;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const currentMemory = process.memoryUsage();
                if (currentMemory.heapUsed > peakMemory.heapUsed) {
                    peakMemory = currentMemory;
                }

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`);

                const status = statusResponse.body.status;
                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                }
                attempts++;
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const peakIncrease = peakMemory.heapUsed - initialMemory.heapUsed;

            // Memory increase should be reasonable (< 100MB for a single scan)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
            expect(peakIncrease).toBeLessThan(150 * 1024 * 1024);

            console.log(`Memory usage - Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`Memory usage - Peak: ${Math.round(peakMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`Memory usage - Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });
    });

    describe('Repository Scanning Performance', () => {
        test('should clone and scan repository efficiently', async () => {
            const scanRequest = {
                repositoryUrl: 'https://github.com/octocat/Hello-World.git',
                scanTypes: ['repository'],
                options: {
                    timeout: 60000,
                    maxSize: 10 * 1024 * 1024
                }
            };

            const startTime = Date.now();

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Monitor progress and measure time
            let completed = false;
            let attempts = 0;
            const maxAttempts = 60;
            let cloneTime = null;
            let scanTime = null;

            while (!completed && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`)
                    .expect(200);

                const status = statusResponse.body.status;
                const progress = statusResponse.body.progress;

                // Track phase completion times
                if (progress && progress.phases) {
                    const repoPhase = progress.phases.find(p => p.type === 'repository');
                    if (repoPhase && repoPhase.status === 'completed' && !cloneTime) {
                        cloneTime = Date.now() - startTime;
                    }
                }

                if (['completed', 'partial', 'failed'].includes(status)) {
                    completed = true;
                    scanTime = Date.now() - startTime;
                }
                attempts++;
            }

            expect(completed).toBe(true);
            expect(scanTime).toBeLessThan(60000); // Should complete within 1 minute

            console.log(`Repository scan performance:`);
            if (cloneTime) console.log(`  Clone time: ${cloneTime}ms`);
            console.log(`  Total time: ${scanTime}ms`);

            // Get results to verify scan quality
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            expect(resultsResponse.body).toHaveProperty('results');
        });
    });

    describe('Result Processing Performance', () => {
        let scanId;

        beforeAll(async () => {
            // Create a scan with substantial results
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'files', 'headers', 'owasp'],
                options: { timeout: 45000 }
            };

            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest);

            scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            while (!completed && attempts < 45) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const statusResponse = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/status`);
                if (['completed', 'partial', 'failed'].includes(statusResponse.body.status)) {
                    completed = true;
                }
                attempts++;
            }
        });

        test('should format results efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Should format results quickly
            expect(processingTime).toBeLessThan(2000);
            expect(response.body).toHaveProperty('results');

            console.log(`Result formatting performance: ${processingTime}ms`);
        });

        test('should export large results efficiently', async () => {
            const formats = ['json', 'csv', 'sarif'];

            for (const format of formats) {
                const startTime = Date.now();

                const response = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/results`)
                    .query({ format })
                    .expect(200);

                const endTime = Date.now();
                const processingTime = endTime - startTime;

                // Should export within reasonable time
                expect(processingTime).toBeLessThan(5000);

                console.log(`${format.toUpperCase()} export performance: ${processingTime}ms`);
            }
        });

        test('should filter results efficiently', async () => {
            const filters = [
                { severity: 'high' },
                { category: 'secrets' },
                { confidenceThreshold: '0.8' },
                { severity: 'medium', category: 'headers' }
            ];

            for (const filter of filters) {
                const startTime = Date.now();

                const response = await request(app)
                    .get(`/api/scan/enhanced/${scanId}/results`)
                    .query(filter)
                    .expect(200);

                const endTime = Date.now();
                const processingTime = endTime - startTime;

                // Should filter quickly
                expect(processingTime).toBeLessThan(1000);

                console.log(`Filter performance (${JSON.stringify(filter)}): ${processingTime}ms`);
            }
        });
    });

    describe('Resource Management Performance', () => {
        test('should clean up resources efficiently', async () => {
            // Create multiple scans to test cleanup
            const scanPromises = Array(5).fill().map((_, index) =>
                request(app)
                    .post('/api/scan/enhanced')
                    .send({
                        url: `https://httpbin.org/html?cleanup=${index}`,
                        scanTypes: ['url'],
                        options: { timeout: 30000 }
                    })
            );

            const startResponses = await Promise.all(scanPromises);
            const scanIds = startResponses.map(response => response.body.scanId);

            // Wait for all scans to complete
            for (const scanId of scanIds) {
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
            }

            // Test cleanup performance
            const startTime = Date.now();
            const cleanedCount = orchestrator.cleanup(0); // Clean up all scans
            const endTime = Date.now();
            const cleanupTime = endTime - startTime;

            // Cleanup should be fast
            expect(cleanupTime).toBeLessThan(1000);
            expect(cleanedCount).toBeGreaterThanOrEqual(0);

            console.log(`Cleanup performance: ${cleanupTime}ms for ${cleanedCount} scans`);
        });

        test('should handle resource statistics efficiently', async () => {
            const startTime = Date.now();

            const stats = orchestrator.getResourceStatistics();

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Should get stats quickly
            expect(processingTime).toBeLessThan(100);
            expect(stats).toBeDefined();

            console.log(`Resource statistics performance: ${processingTime}ms`);
        });
    });

    describe('Stress Testing', () => {
        test('should handle rapid scan requests', async () => {
            const rapidRequests = 20;
            const requestInterval = 100; // 100ms between requests

            const startTime = Date.now();
            const scanIds = [];

            // Send rapid requests
            for (let i = 0; i < rapidRequests; i++) {
                const response = await request(app)
                    .post('/api/scan/enhanced')
                    .send({
                        url: `https://httpbin.org/html?rapid=${i}`,
                        scanTypes: ['url'],
                        options: { timeout: 30000 }
                    });

                if (response.status === 200) {
                    scanIds.push(response.body.scanId);
                }

                if (i < rapidRequests - 1) {
                    await new Promise(resolve => setTimeout(resolve, requestInterval));
                }
            }

            const requestTime = Date.now() - startTime;

            // Should handle rapid requests without significant errors
            expect(scanIds.length).toBeGreaterThan(rapidRequests * 0.8); // At least 80% success rate

            console.log(`Rapid requests performance: ${requestTime}ms for ${rapidRequests} requests`);
            console.log(`Success rate: ${(scanIds.length / rapidRequests * 100).toFixed(1)}%`);

            // Cancel remaining scans to clean up
            for (const scanId of scanIds) {
                try {
                    await request(app).delete(`/api/scan/enhanced/${scanId}`);
                } catch (error) {
                    // Ignore cancellation errors
                }
            }
        });
    });
});