/**
 * Confidence Scoring Tests - False positive reduction mechanisms
 * Tests confidence calculation, context analysis, and learning mechanisms
 */

const { ConfidenceScoring } = require('../services/confidenceScoring');

describe('ConfidenceScoring', () => {
    let confidenceScoring;
    let mockPattern;
    let mockFinding;

    beforeEach(() => {
        confidenceScoring = new ConfidenceScoring();

        mockPattern = {
            id: 'test_pattern',
            category: 'secrets',
            severity: 'high',
            confidence: 0.7,
            validator: (value) => value.length >= 20
        };

        mockFinding = {
            id: 'test-finding-1',
            value: 'sk_test_1234567890abcdef1234567890abcdef',
            file: '/config/api.js',
            context: {
                before: 'const apiKey = "',
                after: '";'
            }
        };
    });

    describe('calculateConfidence', () => {
        test('should return base confidence for simple finding', () => {
            const simpleFinding = { value: 'test_value' };
            const simplePattern = { id: 'simple', confidence: 0.6 };

            const confidence = confidenceScoring.calculateConfidence(simpleFinding, simplePattern);
            expect(confidence).toBeCloseTo(0.6, 1);
        });

        test('should increase confidence for assignment context', () => {
            const finding = {
                value: 'sk_test_1234567890abcdef',
                context: {
                    before: 'const apiKey = "',
                    after: '"'
                }
            };

            const confidence = confidenceScoring.calculateConfidence(finding, mockPattern);
            expect(confidence).toBeGreaterThan(mockPattern.confidence);
        });

        test('should increase confidence for environment variable context', () => {
            const finding = {
                value: 'sk_test_1234567890abcdef',
                context: {
                    before: 'process.env.API_KEY = "',
                    after: '"'
                }
            };

            const confidence = confidenceScoring.calculateConfidence(finding, mockPattern);
            expect(confidence).toBeGreaterThan(mockPattern.confidence);
        });

        test('should decrease confidence for false positive context', () => {
            const finding = {
                value: 'your_api_key_here',
                context: {
                    before: 'example: "',
                    after: '"'
                }
            };

            const confidence = confidenceScoring.calculateConfidence(finding, mockPattern);
            expect(confidence).toBeLessThan(mockPattern.confidence);
        });

        test('should decrease confidence for comment context', () => {
            const finding = {
                value: 'sk_test_1234567890abcdef',
                context: {
                    before: '// API key: "',
                    after: '"'
                }
            };

            // Calculate confidence without comment context for comparison
            const findingWithoutComment = {
                value: 'sk_test_1234567890abcdef',
                context: {
                    before: 'const key = "',
                    after: '"'
                }
            };

            const confidenceWithComment = confidenceScoring.calculateConfidence(finding, mockPattern);
            const confidenceWithoutComment = confidenceScoring.calculateConfidence(findingWithoutComment, mockPattern);

            // Comment context should reduce confidence compared to normal assignment
            expect(confidenceWithComment).toBeLessThan(confidenceWithoutComment);
        });

        test('should ensure confidence stays within bounds', () => {
            const highConfidenceFinding = {
                value: 'sk_live_very_high_entropy_key_with_many_random_chars_123456789',
                context: {
                    before: 'process.env.STRIPE_SECRET_KEY = "',
                    after: '"'
                }
            };

            const confidence = confidenceScoring.calculateConfidence(highConfidenceFinding, mockPattern);
            expect(confidence).toBeLessThanOrEqual(1);
            expect(confidence).toBeGreaterThanOrEqual(0);
        });
    });

    describe('applyContextAnalysis', () => {
        test('should detect variable assignment patterns', () => {
            const assignmentContexts = [
                'const apiKey = "',
                'let secretKey = "',
                'var token = "',
                'apiKey: "',
                'secretKey = "'
            ];

            assignmentContexts.forEach(context => {
                const finding = { context: { before: context, after: '"' } };
                const confidence = confidenceScoring.applyContextAnalysis(0.5, finding, mockPattern);
                expect(confidence).toBeGreaterThan(0.5);
            });
        });

        test('should detect environment variable patterns', () => {
            const envContexts = [
                'process.env.API_KEY = "',
                'process.env["SECRET"] = "',
                'ENV["TOKEN"] = "',
                'getenv("KEY") = "',
                'os.environ["SECRET"] = "'
            ];

            envContexts.forEach(context => {
                const finding = { context: { before: context, after: '"' } };
                const confidence = confidenceScoring.applyContextAnalysis(0.5, finding, mockPattern);
                expect(confidence).toBeGreaterThan(0.5);
            });
        });

        test('should detect configuration object patterns', () => {
            const configContexts = [
                'config.apiKey = "',
                'settings.secret = "',
                'options.token = "',
                'credentials.key = "',
                'auth.secret = "'
            ];

            configContexts.forEach(context => {
                const finding = { context: { before: context, after: '"' } };
                const confidence = confidenceScoring.applyContextAnalysis(0.5, finding, mockPattern);
                expect(confidence).toBeGreaterThan(0.5);
            });
        });

        test('should detect false positive context patterns', () => {
            const falsePositiveContexts = [
                'example: "',
                'placeholder: "',
                'test_key: "',
                'demo_secret: "',
                'sample_token: "',
                'your_key_here: "'
            ];

            falsePositiveContexts.forEach(context => {
                const finding = { context: { before: context, after: '"' } };
                const confidence = confidenceScoring.applyContextAnalysis(0.5, finding, mockPattern);
                expect(confidence).toBeLessThan(0.5);
            });
        });

        test('should detect comment patterns', () => {
            const commentContexts = [
                '/* API key: "',
                '// Secret: "',
                '<!-- Token: "',
                '# Key: "',
                '* Secret: "'
            ];

            commentContexts.forEach(context => {
                const finding = { context: { before: context, after: '"' } };
                const confidence = confidenceScoring.applyContextAnalysis(0.5, finding, mockPattern);
                expect(confidence).toBeLessThan(0.5);
            });
        });
    });

    describe('applyEntropyScoring', () => {
        test('should increase confidence for high entropy values', () => {
            const highEntropyFinding = { value: 'sk_live_51TuYYaAqBa0WuTuYidbkDbaJ2ezSflo' };
            const confidence = confidenceScoring.applyEntropyScoring(0.5, highEntropyFinding);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should decrease confidence for low entropy values', () => {
            const lowEntropyFinding = { value: 'aaaaaaaaaaaaaaaaaaaaaa' };
            const confidence = confidenceScoring.applyEntropyScoring(0.5, lowEntropyFinding);
            expect(confidence).toBeLessThan(0.5);
        });

        test('should handle empty values', () => {
            const emptyFinding = { value: '' };
            const confidence = confidenceScoring.applyEntropyScoring(0.5, emptyFinding);
            expect(confidence).toBeLessThan(0.5);
        });
    });

    describe('applyValidationScoring', () => {
        test('should increase confidence when validator passes', () => {
            const validFinding = { value: 'sk_test_1234567890abcdef1234567890abcdef' };
            const confidence = confidenceScoring.applyValidationScoring(0.5, validFinding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should decrease confidence when validator fails', () => {
            const invalidFinding = { value: 'short' };
            const confidence = confidenceScoring.applyValidationScoring(0.5, invalidFinding, mockPattern);
            expect(confidence).toBeLessThan(0.5);
        });

        test('should handle validator errors gracefully', () => {
            const errorPattern = {
                ...mockPattern,
                validator: () => { throw new Error('Validator error'); }
            };

            const finding = { value: 'test_value' };
            const confidence = confidenceScoring.applyValidationScoring(0.5, finding, errorPattern);
            expect(confidence).toBeLessThan(0.5);
        });

        test('should work without validator', () => {
            const patternWithoutValidator = { ...mockPattern };
            delete patternWithoutValidator.validator;

            const finding = { value: 'test_value' };
            const confidence = confidenceScoring.applyValidationScoring(0.5, finding, patternWithoutValidator);
            expect(confidence).toBeCloseTo(0.5, 1);
        });
    });

    describe('applyFormatValidation', () => {
        test('should increase confidence for base64 format', () => {
            const base64Finding = { value: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=' };
            const confidence = confidenceScoring.applyFormatValidation(0.5, base64Finding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should increase confidence for hex format', () => {
            const hexFinding = { value: 'abcdef1234567890abcdef1234567890abcdef12' };
            const confidence = confidenceScoring.applyFormatValidation(0.5, hexFinding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should increase confidence for UUID format', () => {
            const uuidFinding = { value: '123e4567-e89b-12d3-a456-426614174000' };
            const confidence = confidenceScoring.applyFormatValidation(0.5, uuidFinding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should increase confidence for JWT format', () => {
            const jwtFinding = { value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' };
            const confidence = confidenceScoring.applyFormatValidation(0.5, jwtFinding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should decrease confidence for obvious non-secrets', () => {
            const nonSecrets = ['true', 'false', 'yes', 'no', 'on', 'off', '123', 'https://example.com', 'simple'];

            nonSecrets.forEach(value => {
                const finding = { value };
                const confidence = confidenceScoring.applyFormatValidation(0.5, finding, mockPattern);
                expect(confidence).toBeLessThan(0.5);
            });
        });
    });

    describe('applyLengthScoring', () => {
        test('should increase confidence for appropriate length', () => {
            const longFinding = { value: 'sk_test_1234567890abcdef1234567890abcdef' };
            const confidence = confidenceScoring.applyLengthScoring(0.5, longFinding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should decrease confidence for very short values', () => {
            const shortFinding = { value: 'short' };
            const confidence = confidenceScoring.applyLengthScoring(0.5, shortFinding, mockPattern);
            expect(confidence).toBeLessThan(0.5);
        });

        test('should respect pattern length constraints', () => {
            const patternWithLength = {
                ...mockPattern,
                minLength: 30,
                maxLength: 50
            };

            const appropriateFinding = { value: 'sk_test_1234567890abcdef1234567890' };
            const confidence = confidenceScoring.applyLengthScoring(0.5, appropriateFinding, patternWithLength);
            expect(confidence).toBeGreaterThan(0.5);
        });
    });

    describe('applyFalsePositiveLearning', () => {
        test('should reduce confidence for known false positives', () => {
            const finding = { value: 'your_api_key_here' };
            const confidence = confidenceScoring.applyFalsePositiveLearning(0.8, finding, mockPattern);
            expect(confidence).toBeLessThan(0.5);
        });

        test('should increase confidence for known true positives', () => {
            // First record as true positive
            confidenceScoring.recordFeedback(mockFinding, mockPattern, false);

            const confidence = confidenceScoring.applyFalsePositiveLearning(0.5, mockFinding, mockPattern);
            expect(confidence).toBeGreaterThan(0.5);
        });

        test('should apply feedback data', () => {
            const testFinding = { value: 'test_secret_key' };

            // Record as false positive
            confidenceScoring.recordFeedback(testFinding, mockPattern, true);

            const confidence = confidenceScoring.applyFalsePositiveLearning(0.8, testFinding, mockPattern);
            expect(confidence).toBeLessThan(0.8);
        });
    });

    describe('applyPatternSpecificAdjustments', () => {
        test('should apply category-specific adjustments', () => {
            const secretsPattern = { ...mockPattern, category: 'secrets' };
            const configPattern = { ...mockPattern, category: 'configurations' };
            const vulnPattern = { ...mockPattern, category: 'vulnerabilities' };

            const lowConfidenceFinding = { value: 'test' };

            const secretsConfidence = confidenceScoring.applyPatternSpecificAdjustments(0.5, lowConfidenceFinding, secretsPattern);
            const configConfidence = confidenceScoring.applyPatternSpecificAdjustments(0.5, lowConfidenceFinding, configPattern);
            const vulnConfidence = confidenceScoring.applyPatternSpecificAdjustments(0.5, lowConfidenceFinding, vulnPattern);

            expect(secretsConfidence).toBeLessThan(0.5); // Secrets are stricter
            expect(configConfidence).toBeGreaterThan(0.5); // Configs are more lenient
            expect(vulnConfidence).toBeLessThan(0.5); // Vulnerabilities are careful
        });

        test('should apply severity-specific adjustments', () => {
            const criticalPattern = { ...mockPattern, severity: 'critical' };
            const lowPattern = { ...mockPattern, severity: 'low' };

            const mediumConfidenceFinding = { value: 'test_value' };

            const criticalConfidence = confidenceScoring.applyPatternSpecificAdjustments(0.6, mediumConfidenceFinding, criticalPattern);
            const lowConfidence = confidenceScoring.applyPatternSpecificAdjustments(0.6, mediumConfidenceFinding, lowPattern);

            expect(criticalConfidence).toBeLessThan(0.6); // Critical needs high confidence
            expect(lowConfidence).toBeGreaterThan(0.6); // Low severity is more permissive
        });
    });

    describe('calculateEntropy', () => {
        test('should calculate entropy correctly', () => {
            expect(confidenceScoring.calculateEntropy('')).toBe(0);
            expect(confidenceScoring.calculateEntropy('aaaa')).toBe(0);
            expect(confidenceScoring.calculateEntropy('abcd')).toBeCloseTo(2, 1);
            expect(confidenceScoring.calculateEntropy('sk_live_51TuYYaAqBa0WuTuYidbkDbaJ2ezSflo')).toBeGreaterThan(4);
        });

        test('should handle special characters', () => {
            const entropy = confidenceScoring.calculateEntropy('!@#$%^&*()');
            expect(entropy).toBeGreaterThan(0);
        });
    });

    describe('recordFeedback', () => {
        test('should record false positive feedback', () => {
            const initialStats = confidenceScoring.getStatistics();

            confidenceScoring.recordFeedback(mockFinding, mockPattern, true, { source: 'user' });

            const newStats = confidenceScoring.getStatistics();
            expect(newStats.feedbackEntries).toBe(initialStats.feedbackEntries + 1);
            expect(newStats.falsePositivePatterns).toBeGreaterThan(initialStats.falsePositivePatterns);
        });

        test('should record true positive feedback', () => {
            const initialStats = confidenceScoring.getStatistics();

            confidenceScoring.recordFeedback(mockFinding, mockPattern, false, { source: 'user' });

            const newStats = confidenceScoring.getStatistics();
            expect(newStats.feedbackEntries).toBe(initialStats.feedbackEntries + 1);
            expect(newStats.truePositivePatterns).toBeGreaterThan(initialStats.truePositivePatterns);
        });

        test('should generate consistent fingerprints', () => {
            const fingerprint1 = confidenceScoring.generateFindingFingerprint(mockFinding, mockPattern);
            const fingerprint2 = confidenceScoring.generateFindingFingerprint(mockFinding, mockPattern);

            expect(fingerprint1).toBe(fingerprint2);
            expect(fingerprint1).toHaveLength(32); // MD5 hash length
        });
    });

    describe('learning data management', () => {
        test('should export and import learning data', () => {
            // Record some feedback
            confidenceScoring.recordFeedback(mockFinding, mockPattern, true);
            confidenceScoring.recordFeedback({ value: 'true_positive' }, mockPattern, false);

            // Export data
            const exportedData = confidenceScoring.exportLearningData();
            expect(exportedData.falsePositivePatterns).toBeDefined();
            expect(exportedData.truePositivePatterns).toBeDefined();
            expect(exportedData.feedbackData).toBeDefined();
            expect(exportedData.timestamp).toBeDefined();

            // Create new instance and import
            const newScoring = new ConfidenceScoring();
            newScoring.importLearningData(exportedData);

            // Verify data was imported
            const newStats = newScoring.getStatistics();
            expect(newStats.feedbackEntries).toBeGreaterThan(0);
        });

        test('should clear learning data', () => {
            // Record some feedback
            confidenceScoring.recordFeedback(mockFinding, mockPattern, true);

            // Clear data
            confidenceScoring.clearLearningData();

            // Verify data was cleared
            const stats = confidenceScoring.getStatistics();
            expect(stats.feedbackEntries).toBe(0);
            expect(stats.falsePositivePatterns).toBeGreaterThan(0); // Should still have initialized patterns
        });
    });

    describe('integration tests', () => {
        test('should provide comprehensive confidence scoring', () => {
            const realWorldFindings = [
                {
                    finding: {
                        value: 'sk_live_51TuYYaAqBa0WuTuYidbkDbaJ2ezSflo',
                        context: { before: 'process.env.STRIPE_SECRET_KEY = "', after: '"' }
                    },
                    expectedConfidence: 'high'
                },
                {
                    finding: {
                        value: 'your_api_key_here',
                        context: { before: 'example: "', after: '"' }
                    },
                    expectedConfidence: 'low'
                },
                {
                    finding: {
                        value: 'AKIA1234567890ABCDEF',
                        context: { before: '// AWS key: "', after: '"' }
                    },
                    expectedConfidence: 'high' // Comment reduces but other factors boost it
                },
                {
                    finding: {
                        value: 'true',
                        context: { before: 'enabled = "', after: '"' }
                    },
                    expectedConfidence: 'low'
                }
            ];

            realWorldFindings.forEach(({ finding, expectedConfidence }) => {
                const confidence = confidenceScoring.calculateConfidence(finding, mockPattern);

                switch (expectedConfidence) {
                    case 'high':
                        expect(confidence).toBeGreaterThan(0.7);
                        break;
                    case 'medium':
                        expect(confidence).toBeGreaterThan(0.4);
                        expect(confidence).toBeLessThan(0.8);
                        break;
                    case 'low':
                        expect(confidence).toBeLessThan(0.5);
                        break;
                }
            });
        });

        test('should improve accuracy with feedback', () => {
            const testFinding = {
                value: 'borderline_secret_key_123',
                context: { before: 'config.key = "', after: '"' }
            };

            // Initial confidence
            const initialConfidence = confidenceScoring.calculateConfidence(testFinding, mockPattern);

            // Record as false positive
            confidenceScoring.recordFeedback(testFinding, mockPattern, true);

            // Confidence should be lower after feedback
            const postFeedbackConfidence = confidenceScoring.calculateConfidence(testFinding, mockPattern);
            expect(postFeedbackConfidence).toBeLessThan(initialConfidence);
        });

        test('should handle edge cases gracefully', () => {
            const edgeCases = [
                { value: null },
                { value: undefined },
                { value: '' },
                { value: 'a' },
                { value: 'a'.repeat(1000) },
                { context: null },
                { context: { before: null, after: undefined } }
            ];

            edgeCases.forEach(finding => {
                expect(() => {
                    const confidence = confidenceScoring.calculateConfidence(finding, mockPattern);
                    expect(confidence).toBeGreaterThanOrEqual(0);
                    expect(confidence).toBeLessThanOrEqual(1);
                }).not.toThrow();
            });
        });
    });

    describe('performance tests', () => {
        test('should calculate confidence efficiently for large datasets', () => {
            const findings = Array(1000).fill().map((_, i) => ({
                value: `test_secret_${i}_${Math.random().toString(36).substring(7)}`,
                context: {
                    before: 'const secret = "',
                    after: '"'
                }
            }));

            const startTime = Date.now();

            findings.forEach(finding => {
                confidenceScoring.calculateConfidence(finding, mockPattern);
            });

            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        test('should handle feedback recording efficiently', () => {
            const startTime = Date.now();

            for (let i = 0; i < 100; i++) {
                const finding = { value: `test_value_${i}` };
                confidenceScoring.recordFeedback(finding, mockPattern, i % 2 === 0);
            }

            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        });
    });
});