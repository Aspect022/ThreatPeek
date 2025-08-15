/**
 * Tests for Finding Consolidation Service
 * Tests finding consolidation, grouping logic, and frontend-specific guidance
 */

const { FindingConsolidationService } = require('../services/findingConsolidationService');

describe('FindingConsolidationService', () => {
    let consolidationService;
    let mockFindings;

    beforeEach(() => {
        consolidationService = new FindingConsolidationService({
            enabled: true,
            groupingStrategies: ['category', 'severity', 'location', 'type'],
            consolidationThreshold: 2,
            includeFrontendGuidance: true
        });

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
                type: 'GitHub Token',
                category: 'secrets',
                severity: 'critical',
                confidence: 0.95,
                location: { file: 'config.js', line: 20 }
            },
            {
                id: 'finding-3',
                type: 'Missing CSP header',
                category: 'headers',
                severity: 'medium',
                confidence: 0.8,
                location: { file: 'response headers', line: null }
            },
            {
                id: 'finding-4',
                type: 'Missing HSTS header',
                category: 'headers',
                severity: 'medium',
                confidence: 0.8,
                location: { file: 'response headers', line: null }
            },
            {
                id: 'finding-5',
                type: 'A01: Broken Access Control',
                category: 'owasp',
                severity: 'high',
                confidence: 0.85,
                location: { file: 'auth.js', line: 45 }
            },
            {
                id: 'finding-6',
                type: 'A03: Injection',
                category: 'owasp',
                severity: 'high',
                confidence: 0.8,
                location: { file: 'database.js', line: 120 }
            },
            {
                id: 'finding-7',
                type: 'Exposed .env file',
                category: 'files',
                severity: 'high',
                confidence: 0.9,
                location: { file: '.env', line: 1 }
            }
        ];
    });

    describe('consolidateFindings', () => {
        test('should consolidate findings into logical groups', () => {
            const context = {
                target: { type: 'repository', value: 'https://github.com/user/repo' }
            };

            const consolidation = consolidationService.consolidateFindings(mockFindings, context);

            expect(consolidation).toBeDefined();
            expect(consolidation.originalFindings).toBe(7);
            expect(consolidation.groups).toBeInstanceOf(Array);
            expect(consolidation.groups.length).toBeGreaterThan(0);
            expect(consolidation.consolidatedRemediation).toBeDefined();
            expect(consolidation.statistics).toBeDefined();
            expect(consolidation.metadata).toBeDefined();

            // Should have groups for secrets, headers, and owasp (all meet threshold of 2)
            const categoryGroups = consolidation.groups.map(g => g.category);
            expect(categoryGroups).toContain('secrets');
            expect(categoryGroups).toContain('headers');
            expect(categoryGroups).toContain('owasp');
        });

        test('should return null when disabled', () => {
            consolidationService.enabled = false;
            const consolidation = consolidationService.consolidateFindings(mockFindings, {});
            expect(consolidation).toBeNull();
        });

        test('should return null for empty findings', () => {
            const consolidation = consolidationService.consolidateFindings([], {});
            expect(consolidation).toBeNull();
        });

        test('should include frontend guidance when enabled', () => {
            const consolidation = consolidationService.consolidateFindings(mockFindings, {});
            expect(consolidation.frontendGuidance).toBeDefined();
        });

        test('should not include frontend guidance when disabled', () => {
            consolidationService.includeFrontendGuidance = false;
            const consolidation = consolidationService.consolidateFindings(mockFindings, {});
            expect(consolidation.frontendGuidance).toBeNull();
        });
    });

    describe('grouping strategies', () => {
        test('should group findings by category correctly', () => {
            const grouped = consolidationService.groupByCategory(mockFindings);

            expect(grouped).toHaveProperty('secrets');
            expect(grouped).toHaveProperty('headers');
            expect(grouped).toHaveProperty('owasp');
            expect(grouped).toHaveProperty('files');

            expect(grouped.secrets.count).toBe(2);
            expect(grouped.headers.count).toBe(2);
            expect(grouped.owasp.count).toBe(2);
            expect(grouped.files.count).toBe(1);

            expect(grouped.secrets.maxSeverity).toBe('critical');
            expect(grouped.headers.maxSeverity).toBe('medium');
            expect(grouped.owasp.maxSeverity).toBe('high');
        });

        test('should group findings by severity correctly', () => {
            const grouped = consolidationService.groupBySeverity(mockFindings);

            expect(grouped).toHaveProperty('critical');
            expect(grouped).toHaveProperty('high');
            expect(grouped).toHaveProperty('medium');

            expect(grouped.critical.count).toBe(2);
            expect(grouped.high.count).toBe(3);
            expect(grouped.medium.count).toBe(2);
        });

        test('should group findings by location correctly', () => {
            const grouped = consolidationService.groupByLocation(mockFindings);

            const keys = Object.keys(grouped);
            expect(keys).toContain('config.js');
            expect(keys).toContain('response headers');
            expect(keys).toContain('auth.js');
            expect(keys).toContain('database.js');
            expect(keys).toContain('.env');

            expect(grouped['config.js'].count).toBe(2);
            expect(grouped['response headers'].count).toBe(2);
        });

        test('should group findings by type correctly', () => {
            const grouped = consolidationService.groupByType(mockFindings);

            expect(grouped).toHaveProperty('AWS Access Key');
            expect(grouped).toHaveProperty('GitHub Token');
            expect(grouped).toHaveProperty('Missing CSP header');
            expect(grouped).toHaveProperty('Missing HSTS header');

            expect(grouped['AWS Access Key'].count).toBe(1);
            expect(grouped['Missing CSP header'].count).toBe(1);
        });

        test('should group findings by pattern correctly', () => {
            const grouped = consolidationService.groupByPattern(mockFindings);

            expect(Object.keys(grouped).length).toBeGreaterThan(0);

            // Each pattern should have at least one finding
            Object.values(grouped).forEach(group => {
                expect(group.count).toBeGreaterThan(0);
                expect(group.findings).toBeInstanceOf(Array);
                expect(group.description).toBeDefined();
            });
        });

        test('should group findings by remediation strategy correctly', () => {
            const grouped = consolidationService.groupByRemediationStrategy(mockFindings);

            expect(grouped).toHaveProperty('credential-rotation');
            expect(grouped).toHaveProperty('security-headers');
            expect(grouped).toHaveProperty('vulnerability-patching');

            expect(grouped['credential-rotation'].count).toBe(2); // secrets
            expect(grouped['security-headers'].count).toBe(2); // headers
            expect(grouped['vulnerability-patching'].count).toBe(2); // owasp
        });
    });

    describe('consolidated groups creation', () => {
        test('should create consolidated groups with proper structure', () => {
            const groupedFindings = consolidationService.applyGroupingStrategies(mockFindings, {});
            const groups = consolidationService.createConsolidatedGroups(groupedFindings, {});

            expect(groups).toBeInstanceOf(Array);
            expect(groups.length).toBeGreaterThan(0);

            groups.forEach(group => {
                expect(group).toHaveProperty('id');
                expect(group).toHaveProperty('title');
                expect(group).toHaveProperty('description');
                expect(group).toHaveProperty('category');
                expect(group).toHaveProperty('findings');
                expect(group).toHaveProperty('count');
                expect(group).toHaveProperty('severity');
                expect(group).toHaveProperty('confidence');
                expect(group).toHaveProperty('subGroups');
                expect(group).toHaveProperty('consolidatedRemediation');
                expect(group).toHaveProperty('estimatedEffort');
                expect(group).toHaveProperty('priority');

                expect(group.findings).toBeInstanceOf(Array);
                expect(group.count).toBe(group.findings.length);
                expect(group.subGroups).toBeInstanceOf(Array);
            });
        });

        test('should create high-impact group for critical and high findings', () => {
            const groupedFindings = consolidationService.applyGroupingStrategies(mockFindings, {});
            const groups = consolidationService.createConsolidatedGroups(groupedFindings, {});

            const highImpactGroup = groups.find(g => g.id === 'group-high-impact');
            expect(highImpactGroup).toBeDefined();
            expect(highImpactGroup.severity).toBe('critical');
            expect(highImpactGroup.priority).toBe(1);
            expect(highImpactGroup.count).toBe(5); // 2 critical + 3 high
        });

        test('should sort groups by priority', () => {
            const groupedFindings = consolidationService.applyGroupingStrategies(mockFindings, {});
            const groups = consolidationService.createConsolidatedGroups(groupedFindings, {});

            // Groups should be sorted by priority (lower number = higher priority)
            for (let i = 1; i < groups.length; i++) {
                expect(groups[i].priority).toBeGreaterThanOrEqual(groups[i - 1].priority);
            }
        });
    });

    describe('sub-groups creation', () => {
        test('should create sub-groups by type', () => {
            const findings = mockFindings.filter(f => f.category === 'secrets');
            const subGroups = consolidationService.createSubGroups(findings, 'type');

            expect(subGroups).toBeInstanceOf(Array);
            expect(subGroups.length).toBe(0); // Both secrets are different types, so no sub-grouping
        });

        test('should create sub-groups by location', () => {
            const findings = mockFindings.filter(f => f.location?.file === 'config.js');
            const subGroups = consolidationService.createSubGroups(findings, 'location');

            expect(subGroups).toBeInstanceOf(Array);
            if (subGroups.length > 0) {
                subGroups.forEach(subGroup => {
                    expect(subGroup).toHaveProperty('id');
                    expect(subGroup).toHaveProperty('title');
                    expect(subGroup).toHaveProperty('findings');
                    expect(subGroup).toHaveProperty('count');
                });
            }
        });
    });

    describe('consolidated remediation generation', () => {
        test('should generate consolidated remediation with phases', () => {
            const groupedFindings = consolidationService.applyGroupingStrategies(mockFindings, {});
            const groups = consolidationService.createConsolidatedGroups(groupedFindings, {});
            const remediation = consolidationService.generateConsolidatedRemediation(groups, {});

            expect(remediation).toBeDefined();
            expect(remediation).toHaveProperty('overview');
            expect(remediation).toHaveProperty('phases');
            expect(remediation).toHaveProperty('totalEstimatedEffort');
            expect(remediation).toHaveProperty('timeline');
            expect(remediation).toHaveProperty('dependencies');
            expect(remediation).toHaveProperty('resources');

            expect(remediation.phases).toBeInstanceOf(Array);
            expect(remediation.phases.length).toBeGreaterThan(0);

            // Should have critical phase for critical findings
            const criticalPhase = remediation.phases.find(p => p.priority === 'critical');
            expect(criticalPhase).toBeDefined();
            expect(criticalPhase.timeframe).toContain('Immediate');
        });

        test('should include appropriate actions in each phase', () => {
            const groupedFindings = consolidationService.applyGroupingStrategies(mockFindings, {});
            const groups = consolidationService.createConsolidatedGroups(groupedFindings, {});
            const remediation = consolidationService.generateConsolidatedRemediation(groups, {});

            remediation.phases.forEach(phase => {
                expect(phase).toHaveProperty('phase');
                expect(phase).toHaveProperty('title');
                expect(phase).toHaveProperty('timeframe');
                expect(phase).toHaveProperty('priority');
                expect(phase).toHaveProperty('actions');
                expect(phase).toHaveProperty('estimatedEffort');
                expect(phase).toHaveProperty('dependencies');

                expect(phase.actions).toBeInstanceOf(Array);
                expect(phase.actions.length).toBeGreaterThan(0);
            });
        });
    });

    describe('frontend guidance generation', () => {
        test('should generate frontend guidance for frontend-related findings', () => {
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

            const guidance = consolidationService.generateFrontendGuidance(frontendFindings, {});

            expect(guidance).toBeDefined();
            expect(guidance).toHaveProperty('overview');
            expect(guidance).toHaveProperty('uiComponents');
            expect(guidance).toHaveProperty('userExperience');
            expect(guidance).toHaveProperty('implementation');
            expect(guidance).toHaveProperty('testing');
            expect(guidance).toHaveProperty('monitoring');
        });

        test('should return null for non-frontend findings', () => {
            const backendFindings = [
                {
                    id: 'backend-1',
                    type: 'Database Password',
                    category: 'secrets',
                    severity: 'critical',
                    location: { file: 'server.py' }
                }
            ];

            const guidance = consolidationService.generateFrontendGuidance(backendFindings, {});
            expect(guidance).toBeNull();
        });
    });

    describe('statistics calculation', () => {
        test('should calculate consolidation statistics correctly', () => {
            const groupedFindings = consolidationService.applyGroupingStrategies(mockFindings, {});
            const groups = consolidationService.createConsolidatedGroups(groupedFindings, {});
            const stats = consolidationService.calculateConsolidationStatistics(mockFindings, groups);

            expect(stats).toBeDefined();
            expect(stats.originalCount).toBe(7);
            expect(stats.groupCount).toBe(groups.length);
            expect(stats.consolidationRatio).toBeGreaterThan(0);
            expect(stats.averageGroupSize).toBeGreaterThan(0);
            expect(stats.largestGroup).toBeGreaterThan(0);
            expect(stats.smallestGroup).toBeGreaterThan(0);
            expect(stats).toHaveProperty('groupDistribution');
            expect(stats).toHaveProperty('severityDistribution');
            expect(stats).toHaveProperty('categoryDistribution');
        });
    });

    describe('helper methods', () => {
        test('should extract location key correctly', () => {
            const finding1 = { location: { file: 'test.js' } };
            const finding2 = { file: 'test.js' };
            const finding3 = { location: { url: 'https://example.com' } };
            const finding4 = {};

            expect(consolidationService.extractLocationKey(finding1)).toBe('test.js');
            expect(consolidationService.extractLocationKey(finding2)).toBe('test.js');
            expect(consolidationService.extractLocationKey(finding3)).toBe('https://example.com');
            expect(consolidationService.extractLocationKey(finding4)).toBe('unknown');
        });

        test('should get file type correctly', () => {
            expect(consolidationService.getFileType('test.js')).toBe('javascript');
            expect(consolidationService.getFileType('test.ts')).toBe('typescript');
            expect(consolidationService.getFileType('test.html')).toBe('html');
            expect(consolidationService.getFileType('test.css')).toBe('stylesheet');
            expect(consolidationService.getFileType('config.json')).toBe('configuration');
            expect(consolidationService.getFileType('.env')).toBe('environment');
            expect(consolidationService.getFileType('unknown.xyz')).toBe('unknown');
        });

        test('should get maximum severity correctly', () => {
            expect(consolidationService.getMaxSeverity(['low', 'medium', 'high'])).toBe('high');
            expect(consolidationService.getMaxSeverity(['critical', 'low'])).toBe('critical');
            expect(consolidationService.getMaxSeverity(['medium'])).toBe('medium');
        });

        test('should identify common patterns correctly', () => {
            const sameTypeFindings = [
                { type: 'API Key', category: 'secrets' },
                { type: 'API Key', category: 'secrets' }
            ];

            const sameLocationFindings = [
                { location: { file: 'config.js' } },
                { location: { file: 'config.js' } }
            ];

            expect(consolidationService.identifyCommonPattern(sameTypeFindings)).toContain('Multiple instances of API Key');
            expect(consolidationService.identifyCommonPattern(sameLocationFindings)).toContain('Multiple issues in config.js');
        });

        test('should get remediation strategy correctly', () => {
            expect(consolidationService.getRemediationStrategy({ category: 'secrets' })).toBe('credential-rotation');
            expect(consolidationService.getRemediationStrategy({ category: 'headers' })).toBe('security-headers');
            expect(consolidationService.getRemediationStrategy({ category: 'files' })).toBe('access-control');
            expect(consolidationService.getRemediationStrategy({ category: 'owasp' })).toBe('vulnerability-patching');
            expect(consolidationService.getRemediationStrategy({ severity: 'critical' })).toBe('immediate-action');
        });

        test('should calculate remediation effort correctly', () => {
            const highEffortFindings = Array(25).fill({ severity: 'critical' });
            const mediumEffortFindings = Array(10).fill({ severity: 'high' });
            const lowEffortFindings = Array(3).fill({ severity: 'medium' });

            expect(consolidationService.calculateRemediationEffort(highEffortFindings)).toBe('high');
            expect(consolidationService.calculateRemediationEffort(mediumEffortFindings)).toBe('medium');
            expect(consolidationService.calculateRemediationEffort(lowEffortFindings)).toBe('low');
        });

        test('should calculate average confidence correctly', () => {
            const findings = [
                { confidence: 0.8 },
                { confidence: 0.6 },
                { confidence: 0.9 }
            ];

            const avgConfidence = consolidationService.calculateAverageConfidence(findings);
            expect(avgConfidence).toBeCloseTo(0.77, 2);
        });

        test('should get category group titles and descriptions', () => {
            expect(consolidationService.getCategoryGroupTitle('secrets')).toContain('Secrets');
            expect(consolidationService.getCategoryGroupTitle('headers')).toContain('Header');
            expect(consolidationService.getCategoryGroupTitle('owasp')).toContain('OWASP');

            expect(consolidationService.getCategoryGroupDescription('secrets')).toContain('credentials');
            expect(consolidationService.getCategoryGroupDescription('headers')).toContain('headers');
            expect(consolidationService.getCategoryGroupDescription('owasp')).toContain('OWASP');
        });
    });

    describe('frontend-specific functionality', () => {
        test('should identify frontend findings correctly', () => {
            const mixedFindings = [
                { id: '1', location: { file: 'app.js' } },
                { id: '2', location: { file: 'styles.css' } },
                { id: '3', location: { file: 'index.html' } },
                { id: '4', location: { file: 'server.py' } },
                { id: '5', category: 'headers', type: 'Missing CSP' },
                { id: '6', type: 'XSS Vulnerability' }
            ];

            const frontendFindings = consolidationService.identifyFrontendFindings(mixedFindings);

            expect(frontendFindings.length).toBeGreaterThan(0);
            expect(frontendFindings.length).toBeLessThan(mixedFindings.length);

            // Should include JS, CSS, HTML files and header/XSS findings
            const frontendIds = frontendFindings.map(f => f.id);
            expect(frontendIds).toContain('1'); // app.js
            expect(frontendIds).toContain('2'); // styles.css
            expect(frontendIds).toContain('3'); // index.html
            expect(frontendIds).toContain('5'); // headers
            expect(frontendIds).toContain('6'); // XSS
            expect(frontendIds).not.toContain('4'); // server.py
        });

        test('should assess UI impact correctly', () => {
            const xssFindings = { type: 'XSS Vulnerability' };
            const cspFindings = { type: 'Missing CSP header' };
            const headerFindings = { category: 'headers', type: 'Missing HSTS' };
            const otherFindings = { category: 'secrets', type: 'API Key' };

            expect(consolidationService.assessUIImpact(xssFindings)).toBe('high');
            expect(consolidationService.assessUIImpact(cspFindings)).toBe('high');
            expect(consolidationService.assessUIImpact(headerFindings)).toBe('medium');
            expect(consolidationService.assessUIImpact(otherFindings)).toBe('low');
        });

        test('should generate UI component guidance', () => {
            const findings = [{ location: { file: 'component.js' } }];
            const guidance = consolidationService.generateUIComponentGuidance(findings);

            expect(guidance).toHaveProperty('affectedComponents');
            expect(guidance).toHaveProperty('recommendations');
            expect(guidance.affectedComponents).toContain('component.js');
            expect(guidance.recommendations).toBeInstanceOf(Array);
        });

        test('should generate UX guidance', () => {
            const findings = [{ type: 'Security Issue' }];
            const guidance = consolidationService.generateUXGuidance(findings);

            expect(guidance).toHaveProperty('userImpact');
            expect(guidance).toHaveProperty('recommendations');
            expect(guidance.recommendations).toBeInstanceOf(Array);
        });

        test('should generate frontend testing guidance', () => {
            const findings = [{ type: 'XSS' }];
            const guidance = consolidationService.generateFrontendTestingGuidance(findings);

            expect(guidance).toHaveProperty('testTypes');
            expect(guidance).toHaveProperty('tools');
            expect(guidance).toHaveProperty('recommendations');
            expect(guidance.testTypes).toBeInstanceOf(Array);
            expect(guidance.tools).toBeInstanceOf(Array);
            expect(guidance.recommendations).toBeInstanceOf(Array);
        });

        test('should generate frontend monitoring guidance', () => {
            const findings = [{ type: 'CSP Violation' }];
            const guidance = consolidationService.generateFrontendMonitoringGuidance(findings);

            expect(guidance).toHaveProperty('metrics');
            expect(guidance).toHaveProperty('tools');
            expect(guidance).toHaveProperty('recommendations');
            expect(guidance.metrics).toBeInstanceOf(Array);
            expect(guidance.tools).toBeInstanceOf(Array);
            expect(guidance.recommendations).toBeInstanceOf(Array);
        });
    });

    describe('integration scenarios', () => {
        test('should handle large number of findings efficiently', () => {
            const largeFindings = Array(100).fill(null).map((_, index) => ({
                id: `finding-${index}`,
                type: `Type ${index % 10}`,
                category: ['secrets', 'headers', 'owasp', 'files'][index % 4],
                severity: ['critical', 'high', 'medium', 'low'][index % 4],
                confidence: 0.5 + (index % 5) * 0.1,
                location: { file: `file${index % 20}.js` }
            }));

            const consolidation = consolidationService.consolidateFindings(largeFindings, {});

            expect(consolidation).toBeDefined();
            expect(consolidation.originalFindings).toBe(100);
            expect(consolidation.groups.length).toBeGreaterThan(0);
            expect(consolidation.groups.length).toBeLessThan(100); // Should consolidate
            expect(consolidation.statistics.consolidationRatio).toBeGreaterThan(1);
        });

        test('should handle findings with missing properties gracefully', () => {
            const incompleteFindings = [
                { id: '1' }, // Missing most properties
                { id: '2', type: 'Test', category: 'secrets' }, // Missing severity, confidence, location
                { id: '3', severity: 'high' }, // Missing type, category
                { id: '4', type: 'Complete', category: 'headers', severity: 'medium', confidence: 0.8, location: { file: 'test.js' } }
            ];

            const consolidation = consolidationService.consolidateFindings(incompleteFindings, {});

            expect(consolidation).toBeDefined();
            expect(consolidation.originalFindings).toBe(4);
            expect(consolidation.groups.length).toBeGreaterThan(0);
        });

        test('should provide appropriate guidance for different contexts', () => {
            const urlContext = { target: { type: 'url', value: 'https://example.com' } };
            const repoContext = { target: { type: 'repository', value: 'https://github.com/user/repo' } };

            const urlConsolidation = consolidationService.consolidateFindings(mockFindings, urlContext);
            const repoConsolidation = consolidationService.consolidateFindings(mockFindings, repoContext);

            expect(urlConsolidation.metadata.context).toBe(urlContext);
            expect(repoConsolidation.metadata.context).toBe(repoContext);

            // Both should have similar structure but potentially different guidance
            expect(urlConsolidation.groups.length).toBe(repoConsolidation.groups.length);
        });
    });
});