/**
 * Tests for AI Analysis Service
 * Tests AI analysis integration, impact assessment, and risk scoring
 */

const { AIAnalysisService } = require('../services/aiAnalysisService');

describe('AIAnalysisService', () => {
    let aiService;
    let mockFindings;

    beforeEach(() => {
        aiService = new AIAnalysisService({
            enabled: true,
            cacheMaxSize: 10,
            cacheMaxAge: 1000 // 1 second for testing
        });

        mockFindings = [
            {
                id: 'finding-1',
                type: 'AWS Access Key',
                category: 'secrets',
                severity: 'critical',
                confidence: 0.9,
                value: 'AKIAIOSFODNN7EXAMPLE',
                location: { file: 'config.js', line: 15 }
            },
            {
                id: 'finding-2',
                type: 'Exposed .env file',
                category: 'files',
                severity: 'high',
                confidence: 0.8,
                value: '.env',
                location: { file: '.env', line: 1 }
            },
            {
                id: 'finding-3',
                type: 'Missing CSP header',
                category: 'headers',
                severity: 'medium',
                confidence: 0.7,
                value: 'Content-Security-Policy',
                location: { file: 'response headers', line: null }
            }
        ];
    });

    afterEach(() => {
        aiService.clearCache();
    });

    describe('analyzeFindings', () => {
        test('should analyze findings and provide AI-enhanced explanations', async () => {
            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanType: 'url'
            };

            const result = await aiService.analyzeFindings(mockFindings, context);

            expect(result).toHaveProperty('findings');
            expect(result).toHaveProperty('analysis');
            expect(result).toHaveProperty('metadata');

            expect(result.findings).toHaveLength(3);
            expect(result.findings[0]).toHaveProperty('aiAnalysis');
            expect(result.findings[0]).toHaveProperty('riskScore');

            expect(result.analysis).toHaveProperty('summary');
            expect(result.analysis).toHaveProperty('keyInsights');
            expect(result.analysis).toHaveProperty('recommendations');
            expect(result.analysis).toHaveProperty('nextSteps');

            expect(result.metadata.aiEnabled).toBe(true);
            expect(result.metadata.totalFindings).toBe(3);
        });

        test('should handle empty findings array', async () => {
            const result = await aiService.analyzeFindings([], {});

            expect(result.findings).toHaveLength(0);
            expect(result.analysis).toBeNull();
        });

        test('should use fallback analysis when AI is disabled', async () => {
            aiService.enabled = false;

            const result = await aiService.analyzeFindings(mockFindings, {});

            expect(result.findings).toHaveLength(3);
            expect(result.analysis).toBeDefined();
            expect(result.metadata.fallbackUsed).toBe(true);
        });
    });

    describe('analyzeFinding', () => {
        test('should analyze secret finding with appropriate context', async () => {
            const secretFinding = mockFindings[0];
            const context = { target: { value: 'https://example.com' } };

            const result = await aiService.analyzeFinding(secretFinding, context);

            expect(result).toHaveProperty('aiAnalysis');
            expect(result).toHaveProperty('riskScore');

            const analysis = result.aiAnalysis;
            expect(analysis).toHaveProperty('explanation');
            expect(analysis).toHaveProperty('impact');
            expect(analysis).toHaveProperty('remediation');
            expect(analysis).toHaveProperty('references');
            expect(analysis).toHaveProperty('confidence');

            expect(analysis.explanation).toContain('AWS Access Key');
            expect(analysis.impact.severity).toBe('Critical');
            expect(analysis.remediation.immediate).toBeInstanceOf(Array);
            expect(analysis.remediation.longTerm).toBeInstanceOf(Array);
            expect(analysis.references).toBeInstanceOf(Array);
            expect(analysis.confidence).toBeGreaterThan(0.8);
        });

        test('should analyze file finding with appropriate context', async () => {
            const fileFinding = mockFindings[1];
            const context = { target: { value: 'https://example.com' } };

            const result = await aiService.analyzeFinding(fileFinding, context);

            const analysis = result.aiAnalysis;
            expect(analysis.explanation).toContain('sensitive file');
            expect(analysis.impact.severity).toBe('High');
            expect(analysis.remediation.codeExample).toContain('.htaccess');
        });

        test('should analyze header finding with appropriate context', async () => {
            const headerFinding = mockFindings[2];
            const context = { target: { value: 'https://example.com' } };

            const result = await aiService.analyzeFinding(headerFinding, context);

            const analysis = result.aiAnalysis;
            expect(analysis.explanation).toContain('security header');
            expect(analysis.remediation.codeExample).toContain('Missing CSP header');
        });

        test('should use cache for repeated findings', async () => {
            const finding = mockFindings[0];
            const context = { target: { value: 'https://example.com' } };

            // First call
            const result1 = await aiService.analyzeFinding(finding, context);

            // Second call should use cache
            const result2 = await aiService.analyzeFinding(finding, context);

            expect(result1.aiAnalysis.explanation).toBe(result2.aiAnalysis.explanation);
            expect(aiService.getCacheStats().size).toBe(1);
        });

        test('should handle cache expiration', async () => {
            const finding = mockFindings[0];
            const context = { target: { value: 'https://example.com' } };

            // First call
            await aiService.analyzeFinding(finding, context);
            expect(aiService.getCacheStats().size).toBe(1);

            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Second call should not use expired cache
            await aiService.analyzeFinding(finding, context);
            expect(aiService.getCacheStats().size).toBe(1);
        });
    });

    describe('generateSecretAnalysis', () => {
        test('should generate appropriate analysis for AWS keys', () => {
            const finding = {
                type: 'AWS Access Key',
                category: 'secrets',
                severity: 'critical',
                value: 'AKIAIOSFODNN7EXAMPLE'
            };

            const analysis = aiService.generateSecretAnalysis(finding);

            expect(analysis.explanation).toContain('AWS Access Key');
            expect(analysis.impact.severity).toBe('Critical');
            expect(analysis.remediation.immediate[0]).toContain('Immediately revoke/rotate this AWS Access Key');
            expect(analysis.remediation.codeExample).toContain('process.env.AWS_ACCESS_KEY');
            expect(analysis.confidence).toBe(0.9);
        });

        test('should generate appropriate analysis for generic API keys', () => {
            const finding = {
                type: 'API Key',
                category: 'secrets',
                severity: 'high',
                value: 'sk_test_123456789'
            };

            const analysis = aiService.generateSecretAnalysis(finding);

            expect(analysis.explanation).toContain('API Key');
            expect(analysis.remediation.immediate[0]).toContain('revoke/rotate this API Key');
        });
    });

    describe('generateFileAnalysis', () => {
        test('should generate appropriate analysis for .env files', () => {
            const finding = {
                type: 'Exposed .env file',
                category: 'files',
                severity: 'critical',
                location: { file: '.env' }
            };

            const analysis = aiService.generateFileAnalysis(finding);

            expect(analysis.explanation).toContain('.env');
            expect(analysis.remediation.codeExample).toContain('.htaccess');
            expect(analysis.confidence).toBe(0.85);
        });
    });

    describe('generateHeaderAnalysis', () => {
        test('should generate appropriate analysis for CSP headers', () => {
            const finding = {
                type: 'Content-Security-Policy',
                category: 'headers',
                severity: 'medium'
            };

            const analysis = aiService.generateHeaderAnalysis(finding);

            expect(analysis.explanation).toContain('Content-Security-Policy');
            expect(analysis.remediation.codeExample).toContain('Content-Security-Policy');
        });

        test('should provide correct code examples for different headers', () => {
            const headers = ['X-Frame-Options', 'Strict-Transport-Security', 'X-XSS-Protection'];

            headers.forEach(headerName => {
                const codeExample = aiService.getHeaderCodeExample(headerName);
                expect(codeExample).toContain(headerName);
                expect(codeExample).toContain('Express.js');
            });
        });
    });

    describe('calculateRiskScore', () => {
        test('should calculate risk score based on severity, confidence, and category', () => {
            const finding = {
                severity: 'critical',
                confidence: 0.9,
                category: 'secrets'
            };

            const analysis = { confidence: 0.8 };

            const riskScore = aiService.calculateRiskScore(finding, analysis);

            expect(riskScore).toBeGreaterThan(80);
            expect(riskScore).toBeLessThanOrEqual(100);
        });

        test('should handle missing confidence values', () => {
            const finding = {
                severity: 'medium',
                category: 'headers'
            };

            const analysis = {};

            const riskScore = aiService.calculateRiskScore(finding, analysis);

            expect(riskScore).toBeGreaterThan(0);
            expect(riskScore).toBeLessThanOrEqual(100);
        });

        test('should apply category multipliers correctly', () => {
            const secretFinding = {
                severity: 'high',
                confidence: 0.8,
                category: 'secrets'
            };

            const headerFinding = {
                severity: 'high',
                confidence: 0.8,
                category: 'headers'
            };

            const analysis = { confidence: 0.8 };

            const secretScore = aiService.calculateRiskScore(secretFinding, analysis);
            const headerScore = aiService.calculateRiskScore(headerFinding, analysis);

            expect(secretScore).toBeGreaterThan(headerScore);
        });
    });

    describe('calculateOverallRiskScore', () => {
        test('should calculate overall risk score for multiple findings', () => {
            const findings = [
                { riskScore: 90 },
                { riskScore: 70 },
                { riskScore: 50 }
            ];

            const overallScore = aiService.calculateOverallRiskScore(findings);

            expect(overallScore).toBeGreaterThan(60);
            expect(overallScore).toBeLessThanOrEqual(100);
        });

        test('should return 0 for empty findings array', () => {
            const overallScore = aiService.calculateOverallRiskScore([]);
            expect(overallScore).toBe(0);
        });

        test('should apply volume multiplier for many findings', () => {
            const manyFindings = Array(60).fill({ riskScore: 50 });
            const fewFindings = Array(5).fill({ riskScore: 50 });

            const manyScore = aiService.calculateOverallRiskScore(manyFindings);
            const fewScore = aiService.calculateOverallRiskScore(fewFindings);

            expect(manyScore).toBeGreaterThan(fewScore);
        });
    });

    describe('getRiskLevel', () => {
        test('should return correct risk levels for different scores', () => {
            expect(aiService.getRiskLevel(90)).toBe('Critical');
            expect(aiService.getRiskLevel(70)).toBe('High');
            expect(aiService.getRiskLevel(50)).toBe('Medium');
            expect(aiService.getRiskLevel(30)).toBe('Low');
        });
    });

    describe('generatePrioritizedRecommendations', () => {
        test('should generate prioritized recommendations based on findings', () => {
            const findings = [
                { category: 'secrets', severity: 'critical' },
                { category: 'secrets', severity: 'high' },
                { category: 'headers', severity: 'medium' },
                { category: 'files', severity: 'high' }
            ];

            const recommendations = aiService.generatePrioritizedRecommendations(findings);

            expect(recommendations).toBeInstanceOf(Array);
            expect(recommendations.length).toBeGreaterThan(0);

            // Should prioritize critical findings first
            const criticalRec = recommendations.find(r => r.priority === 'Critical');
            expect(criticalRec).toBeDefined();
            expect(criticalRec.category).toBe('secrets');
        });

        test('should estimate remediation effort correctly', () => {
            const highEffortFindings = Array(25).fill({ severity: 'critical' });
            const lowEffortFindings = Array(3).fill({ severity: 'medium' });

            const highEffort = aiService.estimateRemediationEffort(highEffortFindings);
            const lowEffort = aiService.estimateRemediationEffort(lowEffortFindings);

            expect(highEffort).toBe('High');
            expect(lowEffort).toBe('Low');
        });
    });

    describe('fallback functionality', () => {
        test('should provide fallback analysis when AI fails', () => {
            const findings = [mockFindings[0]];
            const context = {};

            const result = aiService.getFallbackAnalysis(findings, context);

            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].aiAnalysis.fallback).toBe(true);
            expect(result.metadata.fallbackUsed).toBe(true);
            expect(result.metadata.aiEnabled).toBe(false);
        });

        test('should provide category-specific fallback explanations', () => {
            const secretFinding = { category: 'secrets' };
            const fileFinding = { category: 'files' };
            const unknownFinding = { category: 'unknown' };

            const secretAnalysis = aiService.getFallbackFindingAnalysis(secretFinding);
            const fileAnalysis = aiService.getFallbackFindingAnalysis(fileFinding);
            const unknownAnalysis = aiService.getFallbackFindingAnalysis(unknownFinding);

            expect(secretAnalysis.explanation).toContain('API key');
            expect(fileAnalysis.explanation).toContain('sensitive file');
            expect(unknownAnalysis.explanation).toContain('manual review');
        });
    });

    describe('cache management', () => {
        test('should manage cache size correctly', () => {
            const service = new AIAnalysisService({ cacheMaxSize: 2 });

            // Add entries to exceed cache size
            service.setCache('key1', { data: 'test1' });
            service.setCache('key2', { data: 'test2' });
            service.setCache('key3', { data: 'test3' }); // Should evict key1

            expect(service.getCacheStats().size).toBe(2);
            expect(service.getFromCache('key1')).toBeNull();
            expect(service.getFromCache('key2')).toBeDefined();
            expect(service.getFromCache('key3')).toBeDefined();
        });

        test('should clear cache correctly', () => {
            aiService.setCache('test-key', { data: 'test' });
            expect(aiService.getCacheStats().size).toBe(1);

            aiService.clearCache();
            expect(aiService.getCacheStats().size).toBe(0);
        });

        test('should generate consistent cache keys', () => {
            const finding1 = { type: 'API Key', category: 'secrets', severity: 'high' };
            const finding2 = { type: 'API Key', category: 'secrets', severity: 'high' };
            const finding3 = { type: 'Different', category: 'secrets', severity: 'high' };

            const key1 = aiService.generateCacheKey(finding1);
            const key2 = aiService.generateCacheKey(finding2);
            const key3 = aiService.generateCacheKey(finding3);

            expect(key1).toBe(key2);
            expect(key1).not.toBe(key3);
        });
    });

    describe('integration with different finding types', () => {
        test('should handle OWASP findings correctly', async () => {
            const owaspFinding = {
                id: 'owasp-1',
                type: 'A01: Broken Access Control',
                category: 'owasp',
                severity: 'high',
                confidence: 0.8
            };

            const result = await aiService.analyzeFinding(owaspFinding, {});

            expect(result.aiAnalysis.explanation).toContain('OWASP');
            expect(result.aiAnalysis.references[0]).toContain('owasp.org');
        });

        test('should handle unknown finding types gracefully', async () => {
            const unknownFinding = {
                id: 'unknown-1',
                type: 'Unknown Issue',
                category: 'unknown',
                severity: 'medium',
                confidence: 0.6
            };

            const result = await aiService.analyzeFinding(unknownFinding, {});

            expect(result.aiAnalysis.explanation).toContain('potential vulnerability');
            expect(result.aiAnalysis.confidence).toBe(0.6);
        });
    });
});