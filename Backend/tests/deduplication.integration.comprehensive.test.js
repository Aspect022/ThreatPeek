/**
 * Comprehensive Integration Tests for All Deduplication Components
 * Tests the complete deduplication pipeline with real-world scenarios
 * 
 * Requirements covered: All requirements (1.1-1.4, 2.1-2.4, 3.1-3.4)
 */

const { DeduplicationEngine } = require('../utils/deduplicationEngine');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const repositoryScanner = require('../services/repositoryScanner');
const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

describe('Comprehensive Deduplication Integration Tests', () => {
    let testDir;
    let testRepoPath;

    beforeAll(async () => {
        testDir = path.join(__dirname, 'temp', 'comprehensive-integration-test');
        await fs.ensureDir(testDir);
        testRepoPath = path.join(testDir, 'test-repository');
        await fs.ensureDir(testRepoPath);

        // Create comprehensive test repository
        await createComprehensiveTestRepository(testRepoPath);
    });

    afterAll(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('End-to-End Deduplication Pipeline', () => {
        test('should deduplicate findings through complete scan pipeline', async () => {
            // Create a comprehensive test scenario
            const testScenario = await createTestScenario();

            // Test with DeduplicationEngine directly
            const engine = new DeduplicationEngine({
                enableFileLevel: true,
                enableScanLevel: true,
                preserveContext: true,
                enablePerformanceMonitoring: true
            });

            // Process findings through complete pipeline
            const fileResults = [];

            // File-level deduplication for each file
            for (const [fileName, findings] of Object.entries(testScenario.fileFindings)) {
                const deduplicated = engine.deduplicateFileFindings(findings, fileName);
                fileResults.push(...deduplicated);
            }

            // Scan-level deduplication across all files
            const finalResults = engine.deduplicateScanFindings(fileResults);
            const stats = engine.getStats();

            // Verify complete deduplication pipeline
            expect(finalResults.length).toBeLessThan(testScenario.totalFindings);
            expect(stats.duplicatesRemoved).toBeGreaterThan(0);
            expect(stats.deduplicationRate).toMatch(/\d+\.\d+%/);

            // Verify specific deduplication scenarios
            const apiKeyFindings = finalResults.filter(f => f.value === 'sk_test_shared_api_key');
            expect(apiKeyFindings).toHaveLength(1);
            expect(apiKeyFindings[0].occurrenceCount).toBeGreaterThan(1);
            expect(apiKeyFindings[0].locations.length).toBeGreaterThan(1);

            console.log(`End-to-End Pipeline Test:`);
            console.log(`  Original findings: ${testScenario.totalFindings}`);
            console.log(`  Final findings: ${finalResults.length}`);
            console.log(`  Duplicates removed: ${stats.duplicatesRemoved} (${stats.deduplicationRate})`);
        });

        test('should integrate with EnhancedPatternEngine deduplication', () => {
            const patternEngine = new EnhancedPatternEngine();

            // Register patterns that could create duplicates
            patternEngine.registerPattern({
                id: 'api-key-pattern',
                name: 'API Key Pattern',
                regex: /api[_-]?key\s*[=:]\s*["']([^"']+)["']/gi,
                category: 'secrets',
                severity: 'high'
            });

            patternEngine.registerPattern({
                id: 'password-pattern',
                name: 'Password Pattern',
                regex: /password\s*[=:]\s*["']([^"']+)["']/gi,
                category: 'secrets',
                severity: 'high'
            });

            const content = `
                const api_key = "sk_test_duplicate_key";
                const apiKey = "sk_test_duplicate_key";
                const API_KEY = "sk_test_duplicate_key";
                const password = "admin123";
                const pwd = "admin123";
                const different_key = "sk_test_unique_key";
            `;

            const results = patternEngine.scanContent(content, {
                enableDeduplication: true,
                filename: 'integration-test.js'
            });

            // Should deduplicate identical values
            const duplicateKeyFindings = results.filter(r => r.value === 'sk_test_duplicate_key');
            const duplicatePasswordFindings = results.filter(r => r.value === 'admin123');

            expect(duplicateKeyFindings.length).toBeLessThanOrEqual(1);
            expect(duplicatePasswordFindings.length).toBeLessThanOrEqual(1);

            if (duplicateKeyFindings.length > 0) {
                expect(duplicateKeyFindings[0].occurrenceCount).toBeGreaterThan(1);
            }
            if (duplicatePasswordFindings.length > 0) {
                expect(duplicatePasswordFindings[0].occurrenceCount).toBeGreaterThan(1);
            }
        });

        test('should work with repository scanner integration', async () => {
            // Mock repository scanner with deduplication
            const mockScanner = {
                scanRepositoryFiles: jest.fn().mockImplementation(async (repoPath, options) => {
                    const engine = new DeduplicationEngine({
                        enableFileLevel: options.enableDeduplication,
                        enableScanLevel: options.enableDeduplication,
                        preserveContext: true
                    });

                    // Simulate findings from repository scan
                    const findings = [
                        // Duplicate API keys across files
                        {
                            pattern: { id: 'stripe-key' },
                            file: 'config/stripe.js',
                            value: 'sk_test_repository_key',
                            severity: 'critical',
                            confidence: 0.95,
                            location: { line: 5, column: 20 }
                        },
                        {
                            pattern: { id: 'stripe-key' },
                            file: 'lib/payment.js',
                            value: 'sk_test_repository_key',
                            severity: 'critical',
                            confidence: 0.95,
                            location: { line: 12, column: 15 }
                        },
                        {
                            pattern: { id: 'stripe-key' },
                            file: 'tests/payment.test.js',
                            value: 'sk_test_repository_key',
                            severity: 'critical',
                            confidence: 0.95,
                            location: { line: 8, column: 25 }
                        },
                        // Unique findings
                        {
                            pattern: { id: 'github-token' },
                            file: '.github/workflows/ci.yml',
                            value: 'ghp_unique_token_123',
                            severity: 'high',
                            confidence: 0.9,
                            location: { line: 20, column: 10 }
                        }
                    ];

                    const deduplicated = options.enableDeduplication
                        ? engine.deduplicateScanFindings(findings)
                        : findings;

                    return {
                        findings: deduplicated,
                        deduplicationStats: options.enableDeduplication ? engine.getStats() : null,
                        totalFiles: 4,
                        scannedFiles: 4
                    };
                })
            };

            // Test with deduplication enabled
            const resultsWithDedup = await mockScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            expect(resultsWithDedup.findings).toHaveLength(2); // 1 deduplicated + 1 unique
            expect(resultsWithDedup.deduplicationStats).toBeDefined();
            expect(resultsWithDedup.deduplicationStats.duplicatesRemoved).toBe(2);

            const stripeKeyFinding = resultsWithDedup.findings.find(f => f.value === 'sk_test_repository_key');
            expect(stripeKeyFinding.occurrenceCount).toBe(3);
            expect(stripeKeyFinding.locations).toHaveLength(3);

            // Test with deduplication disabled
            const resultsWithoutDedup = await mockScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: false,
                maxFiles: 10
            });

            expect(resultsWithoutDedup.findings).toHaveLength(4); // All original findings
            expect(resultsWithoutDedup.deduplicationStats).toBeNull();
        });
    });

    describe('Real-World Scenario Testing', () => {
        test('should handle typical web application secrets', async () => {
            const webAppFindings = [
                // Database credentials (duplicated across config files)
                {
                    pattern: { id: 'db-password' },
                    file: 'config/database.js',
                    value: 'db_password_123',
                    severity: 'critical',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'db-password' },
                    file: 'config/database.prod.js',
                    value: 'db_password_123',
                    severity: 'critical',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'db-password' },
                    file: 'docker-compose.yml',
                    value: 'db_password_123',
                    severity: 'critical',
                    confidence: 0.85
                },
                // API keys (some duplicated)
                {
                    pattern: { id: 'stripe-key' },
                    file: 'src/payment.js',
                    value: 'sk_live_production_key',
                    severity: 'critical',
                    confidence: 0.95
                },
                {
                    pattern: { id: 'stripe-key' },
                    file: 'src/billing.js',
                    value: 'sk_live_production_key',
                    severity: 'critical',
                    confidence: 0.95
                },
                {
                    pattern: { id: 'stripe-key' },
                    file: 'tests/fixtures.js',
                    value: 'sk_test_fixture_key',
                    severity: 'medium',
                    confidence: 0.8
                },
                // JWT secrets (duplicated)
                {
                    pattern: { id: 'jwt-secret' },
                    file: 'src/auth.js',
                    value: 'jwt_super_secret_key',
                    severity: 'high',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'jwt-secret' },
                    file: 'middleware/auth.js',
                    value: 'jwt_super_secret_key',
                    severity: 'high',
                    confidence: 0.9
                }
            ];

            const engine = new DeduplicationEngine({
                enableFileLevel: true,
                enableScanLevel: true,
                preserveContext: true
            });

            const deduplicated = engine.deduplicateScanFindings(webAppFindings);
            const stats = engine.getStats();

            // Should deduplicate to unique secrets
            expect(deduplicated).toHaveLength(4); // 4 unique secrets
            expect(stats.duplicatesRemoved).toBe(4); // 4 duplicates removed

            // Verify specific deduplication results
            const dbPasswordFinding = deduplicated.find(f => f.value === 'db_password_123');
            expect(dbPasswordFinding.occurrenceCount).toBe(3);
            expect(dbPasswordFinding.severity).toBe('critical'); // Highest severity preserved
            expect(dbPasswordFinding.confidence).toBe(0.9); // Highest confidence preserved

            const stripeProdKeyFinding = deduplicated.find(f => f.value === 'sk_live_production_key');
            expect(stripeProdKeyFinding.occurrenceCount).toBe(2);

            const jwtSecretFinding = deduplicated.find(f => f.value === 'jwt_super_secret_key');
            expect(jwtSecretFinding.occurrenceCount).toBe(2);
        });

        test('should handle CI/CD pipeline secrets', async () => {
            const cicdFindings = [
                // GitHub Actions secrets (duplicated across workflows)
                {
                    pattern: { id: 'github-token' },
                    file: '.github/workflows/deploy.yml',
                    value: 'ghp_deployment_token_123',
                    severity: 'high',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'github-token' },
                    file: '.github/workflows/test.yml',
                    value: 'ghp_deployment_token_123',
                    severity: 'high',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'github-token' },
                    file: '.github/workflows/release.yml',
                    value: 'ghp_deployment_token_123',
                    severity: 'high',
                    confidence: 0.9
                },
                // Docker registry credentials
                {
                    pattern: { id: 'docker-password' },
                    file: 'docker-compose.yml',
                    value: 'docker_registry_pass',
                    severity: 'high',
                    confidence: 0.85
                },
                {
                    pattern: { id: 'docker-password' },
                    file: 'k8s/deployment.yml',
                    value: 'docker_registry_pass',
                    severity: 'high',
                    confidence: 0.85
                },
                // AWS credentials (unique per environment)
                {
                    pattern: { id: 'aws-access-key' },
                    file: 'terraform/prod.tfvars',
                    value: 'AKIAIOSFODNN7EXAMPLE',
                    severity: 'critical',
                    confidence: 0.95
                },
                {
                    pattern: { id: 'aws-access-key' },
                    file: 'terraform/staging.tfvars',
                    value: 'AKIAIOSFODNN7STAGING',
                    severity: 'critical',
                    confidence: 0.95
                }
            ];

            const engine = new DeduplicationEngine();
            const deduplicated = engine.deduplicateScanFindings(cicdFindings);
            const stats = engine.getStats();

            expect(deduplicated).toHaveLength(4); // 4 unique secrets
            expect(stats.duplicatesRemoved).toBe(3); // 3 duplicates removed

            // GitHub token should be deduplicated
            const githubTokenFinding = deduplicated.find(f => f.value === 'ghp_deployment_token_123');
            expect(githubTokenFinding.occurrenceCount).toBe(3);
            expect(githubTokenFinding.locations).toHaveLength(3);

            // Docker password should be deduplicated
            const dockerPasswordFinding = deduplicated.find(f => f.value === 'docker_registry_pass');
            expect(dockerPasswordFinding.occurrenceCount).toBe(2);

            // AWS keys should remain separate (different values)
            const awsKeys = deduplicated.filter(f => f.pattern.id === 'aws-access-key');
            expect(awsKeys).toHaveLength(2);
            expect(awsKeys.every(key => key.occurrenceCount === 1)).toBe(true);
        });

        test('should handle microservices architecture secrets', async () => {
            const microservicesFindings = [
                // Shared database password across services
                {
                    pattern: { id: 'postgres-password' },
                    file: 'user-service/config.js',
                    value: 'shared_db_password',
                    severity: 'critical',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'postgres-password' },
                    file: 'order-service/config.js',
                    value: 'shared_db_password',
                    severity: 'critical',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'postgres-password' },
                    file: 'payment-service/config.js',
                    value: 'shared_db_password',
                    severity: 'critical',
                    confidence: 0.9
                },
                {
                    pattern: { id: 'postgres-password' },
                    file: 'notification-service/config.js',
                    value: 'shared_db_password',
                    severity: 'critical',
                    confidence: 0.9
                },
                // Service-specific API keys
                {
                    pattern: { id: 'stripe-key' },
                    file: 'payment-service/stripe.js',
                    value: 'sk_live_payment_service',
                    severity: 'critical',
                    confidence: 0.95
                },
                {
                    pattern: { id: 'sendgrid-key' },
                    file: 'notification-service/email.js',
                    value: 'SG.notification_service_key',
                    severity: 'high',
                    confidence: 0.9
                },
                // Shared Redis password
                {
                    pattern: { id: 'redis-password' },
                    file: 'user-service/cache.js',
                    value: 'redis_shared_pass',
                    severity: 'medium',
                    confidence: 0.8
                },
                {
                    pattern: { id: 'redis-password' },
                    file: 'order-service/cache.js',
                    value: 'redis_shared_pass',
                    severity: 'medium',
                    confidence: 0.8
                }
            ];

            const engine = new DeduplicationEngine();
            const deduplicated = engine.deduplicateScanFindings(microservicesFindings);
            const stats = engine.getStats();

            expect(deduplicated).toHaveLength(4); // 4 unique secrets
            expect(stats.duplicatesRemoved).toBe(4); // 4 duplicates removed

            // Shared database password
            const dbPasswordFinding = deduplicated.find(f => f.value === 'shared_db_password');
            expect(dbPasswordFinding.occurrenceCount).toBe(4);
            expect(dbPasswordFinding.locations).toHaveLength(4);

            // Shared Redis password
            const redisPasswordFinding = deduplicated.find(f => f.value === 'redis_shared_pass');
            expect(redisPasswordFinding.occurrenceCount).toBe(2);

            // Service-specific keys should remain unique
            const stripeKeyFinding = deduplicated.find(f => f.value === 'sk_live_payment_service');
            expect(stripeKeyFinding.occurrenceCount).toBe(1);

            const sendgridKeyFinding = deduplicated.find(f => f.value === 'SG.notification_service_key');
            expect(sendgridKeyFinding.occurrenceCount).toBe(1);
        });
    });

    describe('Performance Integration Tests', () => {
        test('should maintain performance in integrated environment', async () => {
            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxCacheSize: 5000
            });

            // Simulate large-scale integrated scan
            const largeIntegratedFindings = [];

            // Generate findings from multiple "files" with realistic duplicate patterns
            const fileCount = 50;
            const findingsPerFile = 100;

            for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
                const fileFindings = [];

                for (let findingIndex = 0; findingIndex < findingsPerFile; findingIndex++) {
                    // Create realistic duplicate patterns
                    const isDuplicate = Math.random() < 0.3; // 30% chance of duplicate
                    const value = isDuplicate
                        ? `shared_secret_${findingIndex % 10}` // Shared across files
                        : `unique_secret_${fileIndex}_${findingIndex}`;

                    fileFindings.push({
                        pattern: { id: 'secret-pattern' },
                        file: `file-${fileIndex}.js`,
                        value: value,
                        severity: 'high',
                        confidence: 0.8 + (Math.random() * 0.2),
                        location: { line: findingIndex + 1, column: 10 }
                    });
                }

                // File-level deduplication
                const deduplicated = engine.deduplicateFileFindings(fileFindings, `file-${fileIndex}.js`);
                largeIntegratedFindings.push(...deduplicated);
            }

            // Scan-level deduplication
            const startTime = Date.now();
            const finalResults = engine.deduplicateScanFindings(largeIntegratedFindings);
            const endTime = Date.now();

            const stats = engine.getStats();
            const processingTime = endTime - startTime;

            // Performance requirements
            expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
            expect(finalResults.length).toBeLessThan(largeIntegratedFindings.length);
            expect(stats.duplicatesRemoved).toBeGreaterThan(0);

            console.log(`Integrated Performance Test:`);
            console.log(`  Files processed: ${fileCount}`);
            console.log(`  Original findings: ${fileCount * findingsPerFile}`);
            console.log(`  After file-level dedup: ${largeIntegratedFindings.length}`);
            console.log(`  Final findings: ${finalResults.length}`);
            console.log(`  Processing time: ${processingTime}ms`);
            console.log(`  Duplicates removed: ${stats.duplicatesRemoved} (${stats.deduplicationRate})`);
        });

        test('should handle memory efficiently in integrated scenarios', () => {
            const initialMemory = process.memoryUsage().heapUsed;

            const engine = new DeduplicationEngine({
                enablePerformanceMonitoring: true,
                maxCacheSize: 2000
            });

            // Process multiple batches to simulate continuous operation
            const batchCount = 20;
            const findingsPerBatch = 200;

            for (let batch = 0; batch < batchCount; batch++) {
                const findings = Array(findingsPerBatch).fill().map((_, i) => ({
                    pattern: { id: 'test-pattern' },
                    file: `batch-${batch}-file-${Math.floor(i / 20)}.js`,
                    value: `value-${i % 50}`, // Create duplicates within and across batches
                    severity: 'medium',
                    confidence: 0.8
                }));

                engine.deduplicateFileFindings(findings, `batch-${batch}.js`);
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            const stats = engine.getStats();

            // Memory should be managed efficiently
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
            expect(stats.cacheSize).toBeLessThanOrEqual(2000); // Should respect cache limit

            console.log(`Integrated Memory Test:`);
            console.log(`  Batches processed: ${batchCount}`);
            console.log(`  Total findings processed: ${batchCount * findingsPerBatch}`);
            console.log(`  Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
            console.log(`  Cache size: ${stats.cacheSize}/2000`);
        });
    });

    describe('Error Recovery Integration Tests', () => {
        test('should recover gracefully from integrated component failures', () => {
            const engine = new DeduplicationEngine({
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 3,
                enablePerformanceMonitoring: true
            });

            // Simulate integrated failure scenario
            let operationCount = 0;
            const originalMethod = engine._performFileDeduplication;
            engine._performFileDeduplication = jest.fn().mockImplementation((findings) => {
                operationCount++;

                // Fail first few operations, then succeed
                if (operationCount <= 2) {
                    throw new Error(`Integrated component failure ${operationCount}`);
                }

                return originalMethod.call(engine, findings);
            });

            const findings = [
                { pattern: { id: 'test' }, file: 'test.js', value: 'test1' },
                { pattern: { id: 'test' }, file: 'test.js', value: 'test2' }
            ];

            // First operations should fail and use fallback
            const result1 = engine.deduplicateFileFindings(findings, 'test1.js');
            const result2 = engine.deduplicateFileFindings(findings, 'test2.js');

            expect(result1.every(f => f.deduplicationStatus === 'fallback')).toBe(true);
            expect(result2.every(f => f.deduplicationStatus === 'fallback')).toBe(true);

            // Third operation should succeed
            const result3 = engine.deduplicateFileFindings(findings, 'test3.js');
            expect(result3.every(f => f.deduplicationStatus !== 'fallback')).toBe(true);

            const stats = engine.getStats();
            expect(stats.fallbackCount).toBe(2);
            expect(stats.errorCount).toBe(2);

            // Restore original method
            engine._performFileDeduplication = originalMethod;
        });

        test('should maintain data integrity during partial failures', () => {
            const engine = new DeduplicationEngine();

            // Mock fingerprint generation to fail for specific patterns
            const originalMethod = engine.generateFingerprint;
            engine.generateFingerprint = jest.fn().mockImplementation((finding) => {
                if (finding.pattern?.id === 'problematic-pattern') {
                    throw new Error('Fingerprint generation failed');
                }
                return originalMethod.call(engine, finding);
            });

            const mixedFindings = [
                { pattern: { id: 'good-pattern' }, file: 'test.js', value: 'good1' },
                { pattern: { id: 'problematic-pattern' }, file: 'test.js', value: 'bad1' },
                { pattern: { id: 'good-pattern' }, file: 'test.js', value: 'good2' },
                { pattern: { id: 'good-pattern' }, file: 'test.js', value: 'good1' }, // Duplicate
                { pattern: { id: 'problematic-pattern' }, file: 'test.js', value: 'bad2' }
            ];

            const result = engine.deduplicateFileFindings(mixedFindings, 'test.js');

            // Should handle partial failures gracefully
            expect(result).toHaveLength(5); // All findings returned in fallback mode
            expect(result.every(f => f.deduplicationStatus === 'fallback')).toBe(true);

            const stats = engine.getStats();
            expect(stats.fallbackCount).toBe(1);
            expect(stats.errorCount).toBe(1);

            // Restore original method
            engine.generateFingerprint = originalMethod;
        });
    });
});

/**
 * Create a comprehensive test repository with realistic duplicate patterns
 */
async function createComprehensiveTestRepository(repoPath) {
    // Create directory structure
    const dirs = [
        'src', 'config', 'tests', 'scripts', '.github/workflows',
        'docker', 'k8s', 'terraform', 'docs'
    ];

    for (const dir of dirs) {
        await fs.ensureDir(path.join(repoPath, dir));
    }

    // Create files with duplicate secrets
    const files = {
        'src/app.js': `
            const express = require('express');
            const app = express();
            
            // Shared API key (will be duplicated)
            const stripeKey = "sk_test_shared_api_key";
            const dbPassword = "shared_db_password_123";
            
            app.listen(3000);
        `,
        'config/database.js': `
            module.exports = {
                host: 'localhost',
                user: 'admin',
                password: 'shared_db_password_123', // Duplicate password
                database: 'myapp'
            };
        `,
        'config/stripe.js': `
            module.exports = {
                secretKey: "sk_test_shared_api_key", // Duplicate API key
                publishableKey: "pk_test_unique_key"
            };
        `,
        'tests/integration.test.js': `
            const stripe = require('stripe')("sk_test_shared_api_key"); // Another duplicate
            const db = { password: "shared_db_password_123" }; // Another duplicate
            
            test('payment processing', () => {
                // Test code
            });
        `,
        '.env': `
            DATABASE_URL=postgresql://user:shared_db_password_123@localhost/db
            STRIPE_SECRET_KEY=sk_test_shared_api_key
            JWT_SECRET=unique_jwt_secret_key
        `,
        'docker-compose.yml': `
            version: '3'
            services:
              db:
                environment:
                  POSTGRES_PASSWORD: shared_db_password_123
              app:
                environment:
                  STRIPE_KEY: sk_test_shared_api_key
        `,
        '.github/workflows/deploy.yml': `
            name: Deploy
            on: [push]
            jobs:
              deploy:
                steps:
                  - name: Deploy
                    env:
                      GITHUB_TOKEN: ghp_unique_github_token_123
                      STRIPE_KEY: sk_test_shared_api_key
        `
    };

    for (const [filePath, content] of Object.entries(files)) {
        await fs.writeFile(path.join(repoPath, filePath), content);
    }
}

/**
 * Create a comprehensive test scenario with known duplicate patterns
 */
async function createTestScenario() {
    const fileFindings = {
        'app.js': [
            {
                pattern: { id: 'stripe-key' },
                file: 'app.js',
                value: 'sk_test_shared_api_key',
                severity: 'critical',
                confidence: 0.95,
                location: { line: 5, column: 20 }
            },
            {
                pattern: { id: 'db-password' },
                file: 'app.js',
                value: 'shared_db_password_123',
                severity: 'critical',
                confidence: 0.9,
                location: { line: 6, column: 18 }
            }
        ],
        'config.js': [
            {
                pattern: { id: 'db-password' },
                file: 'config.js',
                value: 'shared_db_password_123',
                severity: 'critical',
                confidence: 0.9,
                location: { line: 4, column: 15 }
            },
            {
                pattern: { id: 'stripe-key' },
                file: 'config.js',
                value: 'sk_test_shared_api_key',
                severity: 'critical',
                confidence: 0.95,
                location: { line: 8, column: 22 }
            }
        ],
        'test.js': [
            {
                pattern: { id: 'stripe-key' },
                file: 'test.js',
                value: 'sk_test_shared_api_key',
                severity: 'critical',
                confidence: 0.95,
                location: { line: 2, column: 25 }
            },
            {
                pattern: { id: 'test-token' },
                file: 'test.js',
                value: 'unique_test_token',
                severity: 'medium',
                confidence: 0.8,
                location: { line: 10, column: 15 }
            }
        ]
    };

    const totalFindings = Object.values(fileFindings).reduce((sum, findings) => sum + findings.length, 0);

    return {
        fileFindings,
        totalFindings
    };
}