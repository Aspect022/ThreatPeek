/**
 * Integration tests for AI-Enhanced Reporting
 * Tests the integration of AI analysis, specialized guidance, and finding consolidation
 */

const { AIAnalysisService } = require('../services/aiAnalysisService');
const { SpecializedGuidanceService } = require('../services/specializedGuidanceService');
const { FindingConsolidationService } = require('../services/findingConsolidationService');

describe('AI-Enhanced Reporting Integration', () => {
    let aiAnalysisService;
    let specializedGuidanceService;
    let findingConsolidationService;
    let mockFindings;

    beforeEach(() => {
        aiAnalysisService = new AIAnalysisService({ enabled: true });
        specializedGuidanceService = new SpecializedGuidanceService({ enabled: true });
        findingConsolidationService = new FindingConsolidationService({ enabled: true });

        mockFindings = [
            {
                id: 'finding-1',
                type: 'AWS Access Key',
                category: 'secrets',
                severity: 'critical',
                confidence: 0.9,
                location: { file: 'config.js', line: 15 }
            },
            {
                id: 'finding-2',
                type: 'Missing CSP header',
                category: 'headers',
                severity: 'medium',
                confidence: 0.8,
                location: { file: 'response headers', line: null }
            },
            {
                id: 'finding-3',
                type: 'A01: Broken Access Control',
                category: 'owasp',
                severity: 'high',
                confidence: 0.85,
                location: { file: 'auth.js', line: 45 }
            }
        ];
    });

    describe('Full AI-Enhanced Reporting Pipeline', () => {
        test('should process findings through all AI enhancement services', async () => {
            const context = {
                target: { type: 'repository', value: 'https://github.com/user/repo' },
                scanType: 'repository'
            };

            // Step 1: AI Analysis
            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);

            expect(aiResult).toBeDefined();
            expect(aiResult.findings).toHaveLength(3);
            expect(aiResult.analysis).toBeDefined();
            expect(aiResult.metadata).toBeDefined();

            // Verify AI analysis enhanced findings
            aiResult.findings.forEach(finding => {
                expect(finding).toHaveProperty('aiAnalysis');
                expect(finding).toHaveProperty('riskScore');
                expect(finding.aiAnalysis).toHaveProperty('explanation');
                expect(finding.aiAnalysis).toHaveProperty('impact');
                expect(finding.aiAnalysis).toHaveProperty('remediation');
                expect(finding.aiAnalysis).toHaveProperty('references');
            });

            // Step 2: Specialized Guidance
            const specializedGuidance = specializedGuidanceService.generateGuidance(aiResult.findings, context);

            expect(specializedGuidance).toBeDefined();
            expect(specializedGuidance).toHaveProperty('securityMisconfigurations');
            expect(specializedGuidance).toHaveProperty('owaspRemediation');
            expect(specializedGuidance).toHaveProperty('gitWorkflowSteps');
            expect(specializedGuidance).toHaveProperty('codeExamples');
            expect(specializedGuidance).toHaveProperty('prioritizedActions');

            // Step 3: Finding Consolidation
            const consolidation = findingConsolidationService.consolidateFindings(aiResult.findings, context);

            expect(consolidation).toBeDefined();
            expect(consolidation).toHaveProperty('groups');
            expect(consolidation).toHaveProperty('consolidatedRemediation');
            expect(consolidation).toHaveProperty('statistics');
            expect(consolidation.originalFindings).toBe(3);

            // Verify integration results
            expect(consolidation.groups.length).toBeGreaterThan(0);
            expect(consolidation.consolidatedRemediation.phases.length).toBeGreaterThan(0);
        });

        test('should provide comprehensive security guidance', async () => {
            const context = {
                target: { type: 'url', value: 'https://example.com' },
                scanType: 'url'
            };

            // Process through all services
            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);
            const specializedGuidance = specializedGuidanceService.generateGuidance(aiResult.findings, context);
            const consolidation = findingConsolidationService.consolidateFindings(aiResult.findings, context);

            // Verify comprehensive guidance is provided
            expect(aiResult.analysis.summary.overallRiskScore).toBeGreaterThan(0);
            expect(aiResult.analysis.recommendations.length).toBeGreaterThan(0);

            expect(specializedGuidance.prioritizedActions.length).toBeGreaterThan(0);
            expect(specializedGuidance.prioritizedActions[0].priority).toBe('CRITICAL');

            expect(consolidation.consolidatedRemediation.phases.length).toBeGreaterThan(0);
            expect(consolidation.consolidatedRemediation.phases[0].priority).toBe('critical');
        });

        test('should handle different finding categories appropriately', async () => {
            const context = { target: { type: 'repository' } };

            // Process findings
            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);
            const specializedGuidance = specializedGuidanceService.generateGuidance(aiResult.findings, context);
            const consolidation = findingConsolidationService.consolidateFindings(aiResult.findings, context);

            // Verify category-specific handling
            const secretFinding = aiResult.findings.find(f => f.category === 'secrets');
            const headerFinding = aiResult.findings.find(f => f.category === 'headers');
            const owaspFinding = aiResult.findings.find(f => f.category === 'owasp');

            expect(secretFinding.aiAnalysis.explanation).toContain('AWS Access Key');
            expect(headerFinding.aiAnalysis.explanation).toContain('security header');
            expect(owaspFinding.aiAnalysis.explanation).toContain('OWASP');

            // Verify specialized guidance categories
            expect(specializedGuidance.securityMisconfigurations).toBeDefined();
            expect(specializedGuidance.owaspRemediation).toBeDefined();
            expect(specializedGuidance.gitWorkflowSteps).toBeDefined();

            // Verify consolidation groups
            const secretGroup = consolidation.groups.find(g => g.category === 'secrets');
            const headerGroup = consolidation.groups.find(g => g.category === 'headers');

            if (secretGroup) {
                expect(secretGroup.severity).toBe('critical');
                expect(secretGroup.consolidatedRemediation.strategy).toBe('credential-rotation');
            }

            if (headerGroup) {
                expect(headerGroup.consolidatedRemediation.strategy).toBe('security-headers');
            }
        });

        test('should provide risk scoring and prioritization', async () => {
            const context = { target: { type: 'repository' } };

            // Process findings
            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);
            const consolidation = findingConsolidationService.consolidateFindings(aiResult.findings, context);

            // Verify risk scoring
            aiResult.findings.forEach(finding => {
                expect(finding.riskScore).toBeGreaterThan(0);
                expect(finding.riskScore).toBeLessThanOrEqual(100);
            });

            expect(aiResult.analysis.summary.overallRiskScore).toBeGreaterThan(0);
            expect(aiResult.analysis.summary.riskLevel).toBeDefined();

            // Verify prioritization
            expect(consolidation.groups).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        priority: expect.any(Number)
                    })
                ])
            );

            // Groups should be sorted by priority
            for (let i = 1; i < consolidation.groups.length; i++) {
                expect(consolidation.groups[i].priority).toBeGreaterThanOrEqual(
                    consolidation.groups[i - 1].priority
                );
            }
        });

        test('should handle empty findings gracefully', async () => {
            const context = { target: { type: 'url' } };

            const aiResult = await aiAnalysisService.analyzeFindings([], context);
            const specializedGuidance = specializedGuidanceService.generateGuidance([], context);
            const consolidation = findingConsolidationService.consolidateFindings([], context);

            expect(aiResult.findings).toHaveLength(0);
            expect(aiResult.analysis).toBeNull();

            expect(specializedGuidance).toBeNull();
            expect(consolidation).toBeNull();
        });

        test('should provide frontend-specific guidance when applicable', async () => {
            const frontendFindings = [
                {
                    id: 'frontend-1',
                    type: 'XSS Vulnerability',
                    category: 'owasp',
                    severity: 'high',
                    location: { file: 'app.js' }
                },
                {
                    id: 'frontend-2',
                    type: 'Missing CSP header',
                    category: 'headers',
                    severity: 'medium',
                    location: { file: 'index.html' }
                }
            ];

            const context = { target: { type: 'url' } };

            const consolidation = findingConsolidationService.consolidateFindings(frontendFindings, context);

            expect(consolidation.frontendGuidance).toBeDefined();
            expect(consolidation.frontendGuidance.uiComponents).toBeDefined();
            expect(consolidation.frontendGuidance.implementation).toBeDefined();
            expect(consolidation.frontendGuidance.testing).toBeDefined();
            expect(consolidation.frontendGuidance.monitoring).toBeDefined();
        });
    });

    describe('Service Integration Edge Cases', () => {
        test('should handle service failures gracefully', async () => {
            // Disable services to test fallback behavior
            const disabledAI = new AIAnalysisService({ enabled: false });
            const disabledGuidance = new SpecializedGuidanceService({ enabled: false });
            const disabledConsolidation = new FindingConsolidationService({ enabled: false });

            const context = { target: { type: 'url' } };

            const aiResult = await disabledAI.analyzeFindings(mockFindings, context);
            const guidance = disabledGuidance.generateGuidance(mockFindings, context);
            const consolidation = disabledConsolidation.consolidateFindings(mockFindings, context);

            // Should provide fallback results
            expect(aiResult.findings).toHaveLength(3);
            expect(aiResult.metadata.fallbackUsed).toBe(true);

            expect(guidance).toBeNull();
            expect(consolidation).toBeNull();
        });

        test('should maintain data consistency across services', async () => {
            const context = { target: { type: 'repository' } };

            const aiResult = await aiAnalysisService.analyzeFindings(mockFindings, context);
            const consolidation = findingConsolidationService.consolidateFindings(aiResult.findings, context);

            // Verify finding IDs are preserved in AI analysis
            const originalIds = mockFindings.map(f => f.id);
            const aiIds = aiResult.findings.map(f => f.id);

            expect(aiIds).toEqual(expect.arrayContaining(originalIds));

            // Verify finding counts match for AI analysis
            expect(aiResult.findings).toHaveLength(mockFindings.length);
            expect(consolidation.originalFindings).toBe(mockFindings.length);

            // Verify consolidation preserves findings (may be grouped)
            const consolidationIds = consolidation.groups.flatMap(g => g.findings.map(f => f.id));
            expect(consolidationIds.length).toBeGreaterThan(0);
            expect(consolidationIds.length).toBeLessThanOrEqual(originalIds.length);

            // All consolidated findings should be from original set
            consolidationIds.forEach(id => {
                expect(originalIds).toContain(id);
            });
        });
    });

    describe('Performance and Scalability', () => {
        test('should handle large number of findings efficiently', async () => {
            const largeFindings = Array(50).fill(null).map((_, index) => ({
                id: `finding-${index}`,
                type: `Type ${index % 5}`,
                category: ['secrets', 'headers', 'owasp', 'files'][index % 4],
                severity: ['critical', 'high', 'medium', 'low'][index % 4],
                confidence: 0.5 + (index % 5) * 0.1,
                location: { file: `file${index % 10}.js`, line: index }
            }));

            const context = { target: { type: 'repository' } };

            const startTime = Date.now();

            const aiResult = await aiAnalysisService.analyzeFindings(largeFindings, context);
            const specializedGuidance = specializedGuidanceService.generateGuidance(aiResult.findings, context);
            const consolidation = findingConsolidationService.consolidateFindings(aiResult.findings, context);

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(processingTime).toBeLessThan(5000); // 5 seconds

            // Should process all findings
            expect(aiResult.findings).toHaveLength(50);
            expect(consolidation.originalFindings).toBe(50);
            expect(consolidation.groups.length).toBeGreaterThan(0);
            expect(consolidation.groups.length).toBeLessThan(50); // Should consolidate

            // Should provide comprehensive guidance
            expect(specializedGuidance.prioritizedActions.length).toBeGreaterThan(0);
            expect(consolidation.consolidatedRemediation.phases.length).toBeGreaterThan(0);
        });
    });
});