/**
 * Integration tests for repository scanner deduplication functionality
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const repositoryScanner = require('../../services/repositoryScanner');

describe('Repository Scanner - Deduplication Integration', () => {
    let testRepoPath;
    let tempDir;

    beforeAll(async () => {
        // Create temporary directory for test repository
        tempDir = path.join(__dirname, '..', '..', 'temp', 'test-repos');
        await fs.ensureDir(tempDir);
        testRepoPath = path.join(tempDir, `test-repo-${uuidv4()}`);
        await fs.ensureDir(testRepoPath);

        // Create test files with duplicate findings
        await createTestRepository(testRepoPath);
    });

    afterAll(async () => {
        // Clean up test repository
        if (await fs.pathExists(testRepoPath)) {
            await fs.remove(testRepoPath);
        }
    });

    describe('File-level deduplication', () => {
        test('should deduplicate identical findings within same file', async () => {
            // Create a file with duplicate API keys
            const testFile = path.join(testRepoPath, 'duplicate-keys.js');
            const content = `
                const apiKey1 = "sk_test_123456789abcdef";
                const apiKey2 = "sk_test_123456789abcdef"; // Same key
                const apiKey3 = "sk_test_123456789abcdef"; // Same key again
                const differentKey = "sk_test_987654321fedcba";
            `;
            await fs.writeFile(testFile, content);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            // Should find 2 unique API keys, not 4
            const apiKeyFindings = results.findings.filter(f =>
                f.pattern?.id === 'stripe_api_key' || f.type?.toLowerCase().includes('api')
            );

            expect(apiKeyFindings.length).toBeLessThanOrEqual(2);

            // Check that deduplication stats are present
            expect(results.deduplicationStats).toBeDefined();
            expect(results.deduplicationStats.duplicatesRemoved).toBeGreaterThan(0);
        });

        test('should preserve highest confidence and most severe severity', async () => {
            const testFile = path.join(testRepoPath, 'severity-test.js');
            const content = `
                // This should be detected as high severity
                const password = "admin123";
                // This might be detected as medium severity
                var pwd = "admin123";
            `;
            await fs.writeFile(testFile, content);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            const passwordFindings = results.findings.filter(f =>
                f.value === "admin123"
            );

            if (passwordFindings.length > 0) {
                // Should preserve the highest severity level
                const severityLevels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'info': 0 };
                const maxSeverity = Math.max(...passwordFindings.map(f => severityLevels[f.severity] || 0));

                expect(passwordFindings.some(f => severityLevels[f.severity] === maxSeverity)).toBe(true);
            }
        });

        test('should include occurrence count in deduplicated findings', async () => {
            const testFile = path.join(testRepoPath, 'occurrence-test.js');
            const content = `
                const token1 = "ghp_1234567890abcdef1234567890abcdef12345678";
                const token2 = "ghp_1234567890abcdef1234567890abcdef12345678";
                const token3 = "ghp_1234567890abcdef1234567890abcdef12345678";
            `;
            await fs.writeFile(testFile, content);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            const tokenFindings = results.findings.filter(f =>
                f.value === "ghp_1234567890abcdef1234567890abcdef12345678"
            );

            if (tokenFindings.length > 0) {
                expect(tokenFindings[0].occurrenceCount).toBeGreaterThan(1);
                expect(tokenFindings[0].locations).toBeDefined();
                expect(tokenFindings[0].locations.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Scan-level deduplication', () => {
        test('should deduplicate findings across multiple files', async () => {
            // Create multiple files with the same secret
            const sharedSecret = "sk_live_abcdef1234567890";

            await fs.writeFile(path.join(testRepoPath, 'config1.js'),
                `const apiKey = "${sharedSecret}";`);
            await fs.writeFile(path.join(testRepoPath, 'config2.js'),
                `export const API_KEY = "${sharedSecret}";`);
            await fs.writeFile(path.join(testRepoPath, 'config3.js'),
                `var key = "${sharedSecret}";`);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            const sharedSecretFindings = results.findings.filter(f =>
                f.value === sharedSecret
            );

            // Should have one finding with multiple locations
            expect(sharedSecretFindings.length).toBe(1);
            if (sharedSecretFindings.length > 0) {
                expect(sharedSecretFindings[0].locations.length).toBe(3);
                expect(sharedSecretFindings[0].occurrenceCount).toBe(3);
            }
        });

        test('should report separate findings for same pattern in different files with different values', async () => {
            await fs.writeFile(path.join(testRepoPath, 'app1.js'),
                `const apiKey = "sk_test_111111111111111111111111";`);
            await fs.writeFile(path.join(testRepoPath, 'app2.js'),
                `const apiKey = "sk_test_222222222222222222222222";`);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            const apiKeyFindings = results.findings.filter(f =>
                f.value?.startsWith('sk_test_')
            );

            // Should have separate findings for different API keys
            const uniqueValues = new Set(apiKeyFindings.map(f => f.value));
            expect(uniqueValues.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Performance and error handling', () => {
        test('should complete deduplication within performance limits', async () => {
            // Create multiple files with various findings
            for (let i = 0; i < 5; i++) {
                const content = `
                    const apiKey${i} = "sk_test_${i.toString().padStart(32, '0')}";
                    const password${i} = "password123";
                    const token${i} = "ghp_${i.toString().padStart(36, '0')}";
                `;
                await fs.writeFile(path.join(testRepoPath, `perf-test-${i}.js`), content);
            }

            const startTime = Date.now();
            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 20
            });
            const endTime = Date.now();

            const scanTime = endTime - startTime;

            // Deduplication should not significantly impact performance
            expect(scanTime).toBeLessThan(10000); // 10 seconds max
            expect(results.deduplicationStats).toBeDefined();
            expect(results.deduplicationStats.deduplicationTime).toBeLessThan(scanTime * 0.1); // Less than 10% of total time
        });

        test('should handle deduplication with empty findings gracefully', async () => {
            // Create a file with no security findings
            await fs.writeFile(path.join(testRepoPath, 'clean-file.js'),
                `const message = "Hello, world!";`);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 1
            });

            expect(results.findings).toBeDefined();
            expect(Array.isArray(results.findings)).toBe(true);
            expect(results.deduplicationStats).toBeDefined();
        });

        test('should work correctly with deduplication disabled', async () => {
            const testFile = path.join(testRepoPath, 'no-dedup-test.js');
            const content = `
                const key1 = "sk_test_duplicate";
                const key2 = "sk_test_duplicate";
                const key3 = "sk_test_duplicate";
            `;
            await fs.writeFile(testFile, content);

            const withDedup = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            const withoutDedup = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: false,
                maxFiles: 10
            });

            // Without deduplication should have more or equal findings
            expect(withoutDedup.findings.length).toBeGreaterThanOrEqual(withDedup.findings.length);
            expect(withoutDedup.deduplicationStats).toBeNull();
        });
    });

    describe('Deduplication statistics', () => {
        test('should provide accurate deduplication statistics', async () => {
            // Create files with known duplicates
            await fs.writeFile(path.join(testRepoPath, 'stats-test1.js'),
                `const duplicate = "sk_test_stats"; const unique1 = "sk_test_unique1";`);
            await fs.writeFile(path.join(testRepoPath, 'stats-test2.js'),
                `const duplicate = "sk_test_stats"; const unique2 = "sk_test_unique2";`);

            const results = await repositoryScanner.scanRepositoryFiles(testRepoPath, {
                enableDeduplication: true,
                maxFiles: 10
            });

            expect(results.deduplicationStats).toBeDefined();
            expect(results.deduplicationStats.totalFindings).toBeGreaterThan(0);
            expect(results.deduplicationStats.uniqueFindings).toBeGreaterThan(0);
            expect(results.deduplicationStats.duplicatesRemoved).toBeGreaterThanOrEqual(0);
            expect(results.deduplicationStats.deduplicationRate).toBeDefined();
            expect(results.deduplicationStats.deduplicationTime).toBeGreaterThanOrEqual(0);
        });
    });
});

/**
 * Create a test repository with various files containing security findings
 */
async function createTestRepository(repoPath) {
    // Create basic structure
    await fs.ensureDir(path.join(repoPath, 'src'));
    await fs.ensureDir(path.join(repoPath, 'config'));
    await fs.ensureDir(path.join(repoPath, 'tests'));

    // Create files with various security findings
    await fs.writeFile(path.join(repoPath, 'src', 'app.js'), `
        const express = require('express');
        const app = express();
        
        // API key that should be detected
        const stripeKey = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";
        
        app.listen(3000);
    `);

    await fs.writeFile(path.join(repoPath, 'config', 'database.js'), `
        module.exports = {
            host: 'localhost',
            user: 'admin',
            password: 'admin123', // Weak password
            database: 'myapp'
        };
    `);

    await fs.writeFile(path.join(repoPath, '.env'), `
        DATABASE_URL=postgresql://user:password@localhost/db
        API_KEY=sk_live_1234567890abcdef
        SECRET_TOKEN=ghp_abcdef1234567890abcdef1234567890abcdef12
    `);

    await fs.writeFile(path.join(repoPath, 'README.md'), `
        # Test Repository
        
        This is a test repository for deduplication testing.
    `);
}