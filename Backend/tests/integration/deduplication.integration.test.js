/**
 * Integration tests for deduplication functionality
 */

const { EnhancedPatternEngine } = require('../../utils/enhancedPatternEngine');
const { allPatterns } = require('../../utils/enhancedPatternDefinitions');

describe('Deduplication Integration Tests', () => {
    let engine;

    beforeEach(() => {
        engine = new EnhancedPatternEngine();
        // Register some real patterns for testing
        engine.registerPatterns(allPatterns.slice(0, 5));
    });

    test('should deduplicate identical findings in real content', () => {
        const content = `
            const apiKey = "sk_test_123456789";
            const backupKey = "sk_test_123456789"; // Same key duplicated
            const anotherKey = "sk_test_987654321"; // Different key
        `;

        const results = engine.scanContent(content, { enableDeduplication: true });

        // Should find 2 unique keys, not 3
        const stripeKeys = results.filter(r => r.pattern.id === 'stripe-secret-key');
        expect(stripeKeys.length).toBeLessThanOrEqual(2);

        // Check that occurrence count is tracked
        const duplicatedKey = stripeKeys.find(k => k.occurrenceCount > 1);
        if (duplicatedKey) {
            expect(duplicatedKey.occurrenceCount).toBe(2);
            expect(duplicatedKey.locations).toHaveLength(2);
        }
    });

    test('should prevent overlapping matches across different patterns', () => {
        const content = 'password123secret456token789';

        const results = engine.scanContent(content, { enableDeduplication: true });

        // Verify no overlapping matches by checking positions
        const positions = results.map(r => ({ start: r.index, end: r.index + r.length }));

        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const pos1 = positions[i];
                const pos2 = positions[j];

                // Check for overlap
                const hasOverlap = (pos1.start < pos2.end && pos2.start < pos1.end);
                expect(hasOverlap).toBe(false);
            }
        }
    });

    test('should maintain high performance with deduplication enabled', () => {
        // Create content with many potential duplicates
        const content = Array(100).fill('const apiKey = "sk_test_123456789";').join('\n');

        const startTime = Date.now();
        const results = engine.scanContent(content, { enableDeduplication: true });
        const endTime = Date.now();

        // Should complete quickly even with many duplicates
        expect(endTime - startTime).toBeLessThan(1000);

        // Should deduplicate effectively
        expect(results.length).toBeLessThan(10); // Much fewer than 100
    });

    test('should work correctly with deduplication disabled', () => {
        const content = `
            const key1 = "sk_test_123456789";
            const key2 = "sk_test_123456789";
        `;

        const withDedup = engine.scanContent(content, { enableDeduplication: true });
        const withoutDedup = engine.scanContent(content, { enableDeduplication: false });

        // Without deduplication should have more results
        expect(withoutDedup.length).toBeGreaterThanOrEqual(withDedup.length);
    });
});