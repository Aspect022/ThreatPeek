/**
 * AI Analysis and Reporting Integration Tests
 * Tests AI-enhanced analysis, specialized guidance, and finding consolidation
 */

const request = require('supertest');
const express = require('express');
const { ScanOrchestrator } = require('../../services/scanOrchestrator');
const { AIAnalysisService } = require('../../services/aiAnalysisService');
const { SpecializedGuidanceService } = require('../../services/specializedGuidanceService');
const { FindingConsolidationService } = require('../../services/findingConsolidationService');

// Create test app
const app = express();
app.use(express.json());

// Import routes
const enhancedScanRoutes = require('../../routes/enhancedScan');
app.use('/api', enhancedScanRoutes);

describe('AI Analysis and Reporting Integration Tests', () => {
    let orchestrator;
    let aiAnalysisService;
    let specializedGuidanceService;
    let findingConsolidationService;

    beforeAll(async () => {
        orchestrator = new ScanOrchestrator({
            aiAnalysis: { enabled: true },
            specializedGuidance: { enabled: true },
            findingConsolidation: { enabled: true }
        });

        aiAnalysisService = new AIAnalysisService({ enabled: true });
        specializedGuidanceService = new SpecializedGuidanceService({ enabled: true });
        findingConsolidationService = new FindingConsolidationService({ enabled: true });

        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterAll(async () => {
        if (orchestrator) {
            await orchestrator.shutdown();
        }
    });

    describe('AI Analysis Integration', () => {
        test('should provide AI analysis for scan results', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'headers'],
                options: {
                    timeout: 30000,
                    aiAnalysis: true
                }
            };

            // Start scan
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

            // Get results and verify AI analysis
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            const results = resultsResponse.body.results;

            // Should have AI analysis if findings were present
            if (results.categories && results.categories.some(cat => cat.findings.length > 0)) {
                expect(results).toHaveProperty('aiAnalysis');
                expect(results.aiAnalysis).toHaveProperty('summary');
                expect(results.aiAnalysis).toHaveProperty('recommendations');
            }
        });

        test('should generate contextual explanations for findings', async () => {
            // Create mock findings for AI analysis
            const mockFindings = [
                {
                    id: 'test-finding-1',
                    type: 'api_key',
                    severity: 'high',
                    value: 'sk_test_example',
                    location: { file: 'config.js', line: 10 },
                    category: 'secrets'
                },
                {
                    id: 'test-finding-2',
                    type: 'missing_csp',
                    severity: 'medium',
                    description: 'Missing Content Security Policy header',
                    category: 'headers'
                }
            ];

            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanTypes: ['url', 'headers']
            };

            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);

            expect(aiResult).toHaveProperty('findings');
            expect(aiResult).toHaveProperty('analysis');
            expect(aiResult.analysis).toHaveProperty('summary');
            expect(aiResult.analysis).toHaveProperty('recommendations');

            // Each finding should have enhanced analysis
            aiResult.findings.forEach(finding => {
                expect(finding).toHaveProperty('aiAnalysis');
                expect(finding.aiAnalysis).toHaveProperty('explanation');
                expect(finding.aiAnalysis).toHaveProperty('impact');
                expect(finding.aiAnalysis).toHaveProperty('remediation');
            });
        });

        test('should provide risk scoring and prioritization', async () => {
            const mockFindings = [
                {
                    id: 'critical-finding',
                    type: 'production_api_key',
                    severity: 'critical',
                    value: 'sk_live_example',
                    category: 'secrets'
                },
                {
                    id: 'medium-finding',
                    type: 'test_api_key',
                    severity: 'medium',
                    value: 'sk_test_example',
                    category: 'secrets'
                }
            ];

            const context = {
                target: { type: 'repository', value: 'https://github.com/test/repo.git' },
                scanTypes: ['repository']
            };

            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);

            expect(aiResult.analysis).toHaveProperty('summary');
            expect(aiResult.analysis.summary).toHaveProperty('overallRiskScore');
            expect(aiResult.analysis.summary).toHaveProperty('riskLevel');
            expect(aiResult.analysis.summary).toHaveProperty('prioritizedFindings');

            // Risk score should be calculated
            expect(typeof aiResult.analysis.summary.overallRiskScore).toBe('number');
            expect(aiResult.analysis.summary.overallRiskScore).toBeGreaterThanOrEqual(0);
            expect(aiResult.analysis.summary.overallRiskScore).toBeLessThanOrEqual(10);

            // Risk level should be categorized
            expect(['low', 'medium', 'high', 'critical']).toContain(aiResult.analysis.summary.riskLevel);
        });
    });

    describe('Specialized Guidance Integration', () => {
        test('should generate security-specific guidance', async () => {
            const mockFindings = [
                {
                    id: 'cors-misconfiguration',
                    type: 'cors_wildcard',
                    severity: 'high',
                    description: 'CORS allows all origins',
                    category: 'headers'
                },
                {
                    id: 'exposed-env-file',
                    type: 'exposed_file',
                    severity: 'critical',
                    description: '.env file accessible',
                    category: 'files'
                }
            ];

            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanTypes: ['headers', 'files']
            };

            const guidance = specializedGuidanceService.generateGuidance(mockFindings, context);

            expect(guidance).toHaveProperty('securityMisconfigurations');
            expect(guidance).toHaveProperty('owaspGuidance');
            expect(guidance).toHaveProperty('implementationSteps');

            // Should have specific guidance for each finding type
            expect(guidance.securityMisconfigurations).toHaveProperty('cors');
            expect(guidance.securityMisconfigurations.cors).toHaveProperty('description');
            expect(guidance.securityMisconfigurations.cors).toHaveProperty('remediation');
            expect(guidance.securityMisconfigurations.cors).toHaveProperty('codeExamples');
        });

        test('should provide OWASP-specific remediation advice', async () => {
            const mockFindings = [
                {
                    id: 'sql-injection-pattern',
                    type: 'sql_injection',
                    severity: 'high',
                    description: 'Potential SQL injection vulnerability',
                    category: 'owasp',
                    owaspCategory: 'A03'
                },
                {
                    id: 'weak-crypto',
                    type: 'weak_encryption',
                    severity: 'medium',
                    description: 'Weak cryptographic implementation',
                    category: 'owasp',
                    owaspCategory: 'A02'
                }
            ];

            const context = {
                target: { type: 'repository', value: 'https://github.com/test/repo.git' },
                scanTypes: ['owasp']
            };

            const guidance = specializedGuidanceService.generateGuidance(mockFindings, context);

            expect(guidance.owaspGuidance).toHaveProperty('A02');
            expect(guidance.owaspGuidance).toHaveProperty('A03');

            // Each OWASP category should have detailed guidance
            expect(guidance.owaspGuidance.A03).toHaveProperty('title');
            expect(guidance.owaspGuidance.A03).toHaveProperty('description');
            expect(guidance.owaspGuidance.A03).toHaveProperty('remediation');
            expect(guidance.owaspGuidance.A03).toHaveProperty('references');
        });

        test('should provide git-workflow-aware remediation for repository findings', async () => {
            const mockFindings = [
                {
                    id: 'committed-secret',
                    type: 'api_key',
                    severity: 'critical',
                    value: 'sk_live_example',
                    location: { file: 'config/production.js', line: 15 },
                    category: 'secrets'
                }
            ];

            const context = {
                target: { type: 'repository', value: 'https://github.com/test/repo.git' },
                scanTypes: ['repository']
            };

            const guidance = specializedGuidanceService.generateGuidance(mockFindings, context);

            expect(guidance).toHaveProperty('gitWorkflowSteps');
            expect(guidance.gitWorkflowSteps).toHaveProperty('secretRemoval');

            const secretRemoval = guidance.gitWorkflowSteps.secretRemoval;
            expect(secretRemoval).toHaveProperty('steps');
            expect(secretRemoval).toHaveProperty('commands');
            expect(secretRemoval).toHaveProperty('warnings');

            // Should include git-specific commands
            expect(secretRemoval.commands.some(cmd => cmd.includes('git'))).toBe(true);
        });
    });

    describe('Finding Consolidation Integration', () => {
        test('should group related security issues', async () => {
            const mockFindings = [
                {
                    id: 'missing-csp',
                    type: 'missing_csp',
                    severity: 'medium',
                    category: 'headers'
                },
                {
                    id: 'missing-hsts',
                    type: 'missing_hsts',
                    severity: 'medium',
                    category: 'headers'
                },
                {
                    id: 'missing-xframe',
                    type: 'missing_x_frame_options',
                    severity: 'low',
                    category: 'headers'
                },
                {
                    id: 'api-key-1',
                    type: 'api_key',
                    severity: 'high',
                    category: 'secrets'
                },
                {
                    id: 'api-key-2',
                    type: 'api_key',
                    severity: 'high',
                    category: 'secrets'
                }
            ];

            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanTypes: ['headers', 'url']
            };

            const consolidation = findingConsolidationService.consolidateFindings(mockFindings, context);

            expect(consolidation).toHaveProperty('groups');
            expect(consolidation).toHaveProperty('summary');
            expect(consolidation).toHaveProperty('recommendations');

            // Should group related findings
            const groups = consolidation.groups;
            expect(groups.some(group => group.category === 'security_headers')).toBe(true);
            expect(groups.some(group => group.category === 'exposed_secrets')).toBe(true);

            // Each group should have consolidated remediation
            groups.forEach(group => {
                expect(group).toHaveProperty('findings');
                expect(group).toHaveProperty('consolidatedRemediation');
                expect(group).toHaveProperty('priority');
                expect(Array.isArray(group.findings)).toBe(true);
            });
        });

        test('should provide consolidated remediation strategies', async () => {
            const mockFindings = [
                {
                    id: 'stripe-key',
                    type: 'stripe_key',
                    severity: 'critical',
                    provider: 'stripe',
                    category: 'secrets'
                },
                {
                    id: 'github-token',
                    type: 'github_token',
                    severity: 'high',
                    provider: 'github',
                    category: 'secrets'
                },
                {
                    id: 'aws-key',
                    type: 'aws_access_key',
                    severity: 'critical',
                    provider: 'aws',
                    category: 'secrets'
                }
            ];

            const context = {
                target: { type: 'repository', value: 'https://github.com/test/repo.git' },
                scanTypes: ['repository']
            };

            const consolidation = findingConsolidationService.consolidateFindings(mockFindings, context);

            expect(consolidation.recommendations).toHaveProperty('immediate');
            expect(consolidation.recommendations).toHaveProperty('shortTerm');
            expect(consolidation.recommendations).toHaveProperty('longTerm');

            // Should have provider-specific guidance
            const secretsGroup = consolidation.groups.find(g => g.category === 'exposed_secrets');
            expect(secretsGroup).toBeDefined();
            expect(secretsGroup.consolidatedRemediation).toHaveProperty('steps');
            expect(secretsGroup.consolidatedRemediation).toHaveProperty('providerSpecific');
        });

        test('should generate frontend-specific guidance for UI findings', async () => {
            const mockFindings = [
                {
                    id: 'xss-vulnerability',
                    type: 'xss_pattern',
                    severity: 'high',
                    location: { file: 'components/UserInput.jsx', line: 25 },
                    category: 'owasp'
                },
                {
                    id: 'missing-csrf',
                    type: 'missing_csrf_protection',
                    severity: 'medium',
                    category: 'headers'
                }
            ];

            const context = {
                target: { type: 'repository', value: 'https://github.com/test/frontend-app.git' },
                scanTypes: ['repository', 'headers']
            };

            const consolidation = findingConsolidationService.consolidateFindings(mockFindings, context);

            expect(consolidation).toHaveProperty('frontendSpecific');
            expect(consolidation.frontendSpecific).toHaveProperty('componentSecurity');
            expect(consolidation.frontendSpecific).toHaveProperty('frameworkGuidance');

            // Should have React/frontend-specific recommendations
            const componentSecurity = consolidation.frontendSpecific.componentSecurity;
            expect(componentSecurity).toHaveProperty('inputSanitization');
            expect(componentSecurity).toHaveProperty('stateManagement');
        });
    });

    describe('End-to-End AI Integration', () => {
        test('should provide complete AI-enhanced scan results', async () => {
            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url', 'headers', 'files'],
                options: {
                    timeout: 45000,
                    aiAnalysis: true,
                    specializedGuidance: true,
                    findingConsolidation: true
                }
            };

            // Start scan
            const startResponse = await request(app)
                .post('/api/scan/enhanced')
                .send(scanRequest)
                .expect(200);

            const scanId = startResponse.body.scanId;

            // Wait for completion
            let completed = false;
            let attempts = 0;
            const maxAttempts = 45;

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

            // Get results and verify all AI features
            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            const results = resultsResponse.body.results;

            // Should have all AI enhancement features if findings exist
            if (results.categories && results.categories.some(cat => cat.findings.length > 0)) {
                // AI Analysis
                expect(results).toHaveProperty('aiAnalysis');
                expect(results.aiAnalysis).toHaveProperty('summary');

                // Specialized Guidance
                expect(results).toHaveProperty('specializedGuidance');
                expect(results.specializedGuidance).toHaveProperty('implementationSteps');

                // Finding Consolidation
                expect(results).toHaveProperty('consolidation');
                expect(results.consolidation).toHaveProperty('groups');

                // Enhanced findings with AI analysis
                results.categories.forEach(category => {
                    category.findings.forEach(finding => {
                        if (finding.aiAnalysis) {
                            expect(finding.aiAnalysis).toHaveProperty('explanation');
                            expect(finding.aiAnalysis).toHaveProperty('remediation');
                        }
                    });
                });
            }
        });

        test('should handle AI analysis errors gracefully', async () => {
            // Mock AI service to throw error
            const originalAnalyzeFindings = aiAnalysisService.analyzeFindings;
            aiAnalysisService.analyzeFindings = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

            const scanRequest = {
                url: 'https://httpbin.org/html',
                scanTypes: ['url'],
                options: {
                    timeout: 30000,
                    aiAnalysis: true
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

            // Should complete despite AI error
            expect(completed).toBe(true);

            const resultsResponse = await request(app)
                .get(`/api/scan/enhanced/${scanId}/results`)
                .expect(200);

            // Should have basic results even without AI analysis
            expect(resultsResponse.body).toHaveProperty('results');

            // Restore original method
            aiAnalysisService.analyzeFindings = originalAnalyzeFindings;
        });
    });

    describe('AI Performance and Caching', () => {
        test('should cache AI analysis results', async () => {
            const mockFindings = [
                {
                    id: 'test-finding',
                    type: 'api_key',
                    severity: 'high',
                    value: 'sk_test_example',
                    category: 'secrets'
                }
            ];

            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanTypes: ['url']
            };

            // First analysis
            const startTime1 = Date.now();
            const result1 = await aiAnalysisService.analyzeFindings(mockFindings, context);
            const time1 = Date.now() - startTime1;

            // Second analysis (should use cache)
            const startTime2 = Date.now();
            const result2 = await aiAnalysisService.analyzeFindings(mockFindings, context);
            const time2 = Date.now() - startTime2;

            // Second call should be faster due to caching
            expect(time2).toBeLessThan(time1);
            expect(result1).toEqual(result2);

            console.log(`AI analysis performance - First: ${time1}ms, Cached: ${time2}ms`);
        });

        test('should handle concurrent AI analysis requests', async () => {
            const mockFindings = Array(5).fill().map((_, index) => ({
                id: `concurrent-finding-${index}`,
                type: 'api_key',
                severity: 'high',
                value: `sk_test_example_${index}`,
                category: 'secrets'
            }));

            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanTypes: ['url']
            };

            const startTime = Date.now();

            // Run concurrent analyses
            const promises = mockFindings.map(finding =>
                aiAnalysisService.analyzeFindings([finding], context)
            );

            const results = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            // All analyses should complete
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toHaveProperty('findings');
                expect(result).toHaveProperty('analysis');
            });

            console.log(`Concurrent AI analysis performance: ${totalTime}ms for 5 requests`);
        });
    });
});