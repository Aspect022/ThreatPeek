/**
 * Tests for Specialized Guidance Service
 * Tests security misconfiguration guidance, OWASP remediation, and git workflow steps
 */

const { SpecializedGuidanceService } = require('../services/specializedGuidanceService');

describe('SpecializedGuidanceService', () => {
    let guidanceService;
    let mockFindings;

    beforeEach(() => {
        guidanceService = new SpecializedGuidanceService({
            enabled: true,
            includeCodeExamples: true,
            includeGitWorkflow: true,
            includeOwaspReferences: true
        });

        mockFindings = [
            {
                id: 'finding-1',
                type: 'Missing CSP header',
                category: 'headers',
                severity: 'medium',
                confidence: 0.8
            },
            {
                id: 'finding-2',
                type: 'A01: Broken Access Control',
                category: 'owasp',
                severity: 'high',
                confidence: 0.9
            },
            {
                id: 'finding-3',
                type: 'AWS Access Key',
                category: 'secrets',
                severity: 'critical',
                confidence: 0.95
            },
            {
                id: 'finding-4',
                type: 'Exposed .env file',
                category: 'files',
                severity: 'high',
                confidence: 0.85
            },
            {
                id: 'finding-5',
                type: 'A03: Injection',
                category: 'owasp',
                severity: 'high',
                confidence: 0.8
            }
        ];
    });

    describe('generateGuidance', () => {
        test('should generate comprehensive guidance for all finding types', () => {
            const context = {
                target: { type: 'repository', value: 'https://github.com/user/repo' },
                scanType: 'repository'
            };

            const guidance = guidanceService.generateGuidance(mockFindings, context);

            expect(guidance).toHaveProperty('securityMisconfigurations');
            expect(guidance).toHaveProperty('owaspRemediation');
            expect(guidance).toHaveProperty('gitWorkflowSteps');
            expect(guidance).toHaveProperty('codeExamples');
            expect(guidance).toHaveProperty('prioritizedActions');
            expect(guidance).toHaveProperty('metadata');

            expect(guidance.metadata.totalFindings).toBe(5);
            expect(guidance.metadata.context).toBe(context);
        });

        test('should return null when disabled', () => {
            guidanceService.enabled = false;
            const guidance = guidanceService.generateGuidance(mockFindings, {});
            expect(guidance).toBeNull();
        });

        test('should return null for empty findings', () => {
            const guidance = guidanceService.generateGuidance([], {});
            expect(guidance).toBeNull();
        });
    });

    describe('generateSecurityMisconfigurationGuidance', () => {
        test('should generate guidance for header misconfigurations', () => {
            const headerFindings = [
                { id: '1', type: 'Missing CSP header', category: 'headers', severity: 'medium' },
                { id: '2', type: 'Missing HSTS header', category: 'headers', severity: 'medium' },
                { id: '3', type: 'Missing X-Frame-Options', category: 'headers', severity: 'low' }
            ];

            const guidance = guidanceService.generateSecurityMisconfigurationGuidance(headerFindings, {});

            expect(guidance).toBeDefined();
            expect(guidance.overview).toContain('Security misconfigurations');
            expect(guidance.categories).toHaveProperty('csp');
            expect(guidance.categories).toHaveProperty('hsts');
            expect(guidance.categories).toHaveProperty('xFrameOptions');

            expect(guidance.categories.csp.description).toContain('Content Security Policy');
            expect(guidance.categories.csp.codeExample).toContain('Content-Security-Policy');
            expect(guidance.categories.csp.implementation).toBeInstanceOf(Array);
            expect(guidance.categories.csp.testing).toBeInstanceOf(Array);
            expect(guidance.categories.csp.references).toBeInstanceOf(Array);

            expect(guidance.implementationSteps.length).toBeGreaterThan(0);
            expect(guidance.bestPractices.length).toBeGreaterThan(0);
        });

        test('should generate guidance for exposed files', () => {
            const fileFindings = [
                { id: '1', type: 'Exposed .env file', category: 'files', severity: 'critical' }
            ];

            const guidance = guidanceService.generateSecurityMisconfigurationGuidance(fileFindings, {});

            expect(guidance.categories).toHaveProperty('exposedFiles');
            expect(guidance.categories.exposedFiles.codeExample).toContain('.htaccess');
            expect(guidance.categories.exposedFiles.severity).toBe('critical');
        });

        test('should return null for non-misconfiguration findings', () => {
            const secretFindings = [
                { id: '1', type: 'API Key', category: 'secrets', severity: 'critical' }
            ];

            const guidance = guidanceService.generateSecurityMisconfigurationGuidance(secretFindings, {});
            expect(guidance).toBeNull();
        });
    });

    describe('generateOwaspRemediation', () => {
        test('should generate OWASP-specific remediation guidance', () => {
            const owaspFindings = [
                { id: '1', type: 'A01: Broken Access Control', category: 'owasp', severity: 'high' },
                { id: '2', type: 'A03: Injection', category: 'owasp', severity: 'high' }
            ];

            const guidance = guidanceService.generateOwaspRemediation(owaspFindings, {});

            expect(guidance).toBeDefined();
            expect(guidance.overview).toContain('OWASP Top 10');
            expect(guidance.categories).toHaveProperty('A01');
            expect(guidance.categories).toHaveProperty('A03');

            expect(guidance.categories.A01.title).toContain('Broken Access Control');
            expect(guidance.categories.A01.remediation).toBeInstanceOf(Array);
            expect(guidance.categories.A01.prevention).toBeInstanceOf(Array);
            expect(guidance.categories.A01.testing).toBeInstanceOf(Array);
            expect(guidance.categories.A01.codeExamples).toBeDefined();
            expect(guidance.categories.A01.references).toBeInstanceOf(Array);

            expect(guidance.categories.A03.title).toContain('Injection');
            expect(guidance.categories.A03.codeExamples.sqlInjection).toContain('parameterized');

            expect(guidance.complianceChecklist.length).toBeGreaterThan(0);
            expect(guidance.references.owaspTop10).toContain('owasp.org');
        });

        test('should return null for non-OWASP findings', () => {
            const headerFindings = [
                { id: '1', type: 'Missing CSP', category: 'headers', severity: 'medium' }
            ];

            const guidance = guidanceService.generateOwaspRemediation(headerFindings, {});
            expect(guidance).toBeNull();
        });
    });

    describe('generateGitWorkflowSteps', () => {
        test('should generate git workflow guidance for repository scans with secrets', () => {
            const context = {
                target: { type: 'repository', value: 'https://github.com/user/repo' }
            };

            const findingsWithSecrets = [
                { id: '1', category: 'secrets', severity: 'critical' },
                { id: '2', category: 'files', severity: 'high' }
            ];

            const guidance = guidanceService.generateGitWorkflowSteps(findingsWithSecrets, context);

            expect(guidance).toBeDefined();
            expect(guidance.overview).toContain('git-workflow-aware');
            expect(guidance.immediateActions.length).toBeGreaterThan(0);
            expect(guidance.repositoryCleanup.length).toBeGreaterThan(0);
            expect(guidance.preventionMeasures.length).toBeGreaterThan(0);
            expect(guidance.workflowIntegration.length).toBeGreaterThan(0);

            // Check for secret-specific actions
            const secretAction = guidance.immediateActions.find(action =>
                action.includes('Rotate all exposed secrets')
            );
            expect(secretAction).toBeDefined();

            // Check for repository cleanup steps
            const cleanupStep = guidance.repositoryCleanup.find(step =>
                step.step.includes('Remove secrets from git history')
            );
            expect(cleanupStep).toBeDefined();
            expect(cleanupStep.commands).toBeInstanceOf(Array);
            expect(cleanupStep.warning).toContain('rewrites git history');
        });

        test('should generate appropriate guidance for URL scans', () => {
            const context = {
                target: { type: 'url', value: 'https://example.com' }
            };

            const findings = [
                { id: '1', category: 'headers', severity: 'medium' }
            ];

            const guidance = guidanceService.generateGitWorkflowSteps(findings, context);

            expect(guidance).toBeDefined();
            expect(guidance.repositoryCleanup).toHaveLength(0); // No repo cleanup for URL scans
            expect(guidance.preventionMeasures.length).toBeGreaterThan(0);
        });

        test('should return null when git workflow is disabled', () => {
            guidanceService.includeGitWorkflow = false;
            const guidance = guidanceService.generateGitWorkflowSteps(mockFindings, {});
            expect(guidance).toBeNull();
        });
    });

    describe('generateCodeExamples', () => {
        test('should generate code examples for different finding types', () => {
            const examples = guidanceService.generateCodeExamples(mockFindings, {});

            expect(examples).toBeDefined();
            expect(examples).toHaveProperty('securityHeaders');
            expect(examples).toHaveProperty('secretManagement');
            expect(examples).toHaveProperty('inputValidation');
            expect(examples).toHaveProperty('accessControl');

            // Check for header examples
            expect(examples.securityHeaders).toHaveProperty('Missing CSP header');

            // Check for secret management examples
            expect(examples.secretManagement).toHaveProperty('AWS Access Key');
        });

        test('should return null when code examples are disabled', () => {
            guidanceService.includeCodeExamples = false;
            const examples = guidanceService.generateCodeExamples(mockFindings, {});
            expect(examples).toBeNull();
        });
    });

    describe('generatePrioritizedActions', () => {
        test('should generate prioritized actions based on severity', () => {
            const actions = guidanceService.generatePrioritizedActions(mockFindings, {});

            expect(actions).toBeInstanceOf(Array);
            expect(actions.length).toBeGreaterThan(0);

            // Should have critical priority action for critical findings
            const criticalAction = actions.find(action => action.priority === 'CRITICAL');
            expect(criticalAction).toBeDefined();
            expect(criticalAction.timeframe).toContain('Immediate');
            expect(criticalAction.actions).toBeInstanceOf(Array);

            // Should have high priority action for high findings
            const highAction = actions.find(action => action.priority === 'HIGH');
            expect(highAction).toBeDefined();
            expect(highAction.timeframe).toContain('Short-term');

            // Should have long-term improvements
            const longTermAction = actions.find(action => action.priority === 'LOW');
            expect(longTermAction).toBeDefined();
            expect(longTermAction.timeframe).toContain('Long-term');
        });

        test('should handle findings with no critical issues', () => {
            const lowSeverityFindings = [
                { id: '1', severity: 'medium' },
                { id: '2', severity: 'low' }
            ];

            const actions = guidanceService.generatePrioritizedActions(lowSeverityFindings, {});

            const criticalAction = actions.find(action => action.priority === 'CRITICAL');
            expect(criticalAction).toBeUndefined();

            const mediumAction = actions.find(action => action.priority === 'MEDIUM');
            expect(mediumAction).toBeDefined();
        });
    });

    describe('helper methods', () => {
        test('should group misconfigurations by type correctly', () => {
            const misconfigs = [
                { type: 'Missing CSP header', category: 'headers' },
                { type: 'Missing HSTS header', category: 'headers' },
                { type: 'Exposed .env file', category: 'files' }
            ];

            const grouped = guidanceService.groupMisconfigurationsByType(misconfigs);

            expect(grouped).toHaveProperty('csp');
            expect(grouped).toHaveProperty('hsts');
            expect(grouped).toHaveProperty('exposedFiles');
            expect(grouped.csp).toHaveLength(1);
            expect(grouped.hsts).toHaveLength(1);
            expect(grouped.exposedFiles).toHaveLength(1);
        });

        test('should get misconfiguration type correctly', () => {
            expect(guidanceService.getMisconfigurationType({
                type: 'Content-Security-Policy', category: 'headers'
            })).toBe('csp');

            expect(guidanceService.getMisconfigurationType({
                type: 'Strict-Transport-Security', category: 'headers'
            })).toBe('hsts');

            expect(guidanceService.getMisconfigurationType({
                type: 'X-Frame-Options', category: 'headers'
            })).toBe('xFrameOptions');

            expect(guidanceService.getMisconfigurationType({
                type: 'Exposed file', category: 'files'
            })).toBe('exposedFiles');
        });

        test('should group OWASP findings by category correctly', () => {
            const owaspFindings = [
                { type: 'A01: Broken Access Control' },
                { type: 'A03: Injection' },
                { type: 'A02: Cryptographic Failures' }
            ];

            const grouped = guidanceService.groupOwaspByCategory(owaspFindings);

            expect(grouped).toHaveProperty('A01');
            expect(grouped).toHaveProperty('A02');
            expect(grouped).toHaveProperty('A03');
            expect(grouped.A01).toHaveLength(1);
            expect(grouped.A02).toHaveLength(1);
            expect(grouped.A03).toHaveLength(1);
        });

        test('should get OWASP category correctly', () => {
            expect(guidanceService.getOwaspCategory({ type: 'A01: Broken Access Control' })).toBe('A01');
            expect(guidanceService.getOwaspCategory({ type: 'A02: Cryptographic Failures' })).toBe('A02');
            expect(guidanceService.getOwaspCategory({ type: 'A03: Injection' })).toBe('A03');
            expect(guidanceService.getOwaspCategory({ type: 'Unknown OWASP issue' })).toBe('general');
        });

        test('should get maximum severity correctly', () => {
            const findings = [
                { severity: 'medium' },
                { severity: 'critical' },
                { severity: 'low' },
                { severity: 'high' }
            ];

            const maxSeverity = guidanceService.getMaxSeverity(findings);
            expect(maxSeverity).toBe('critical');
        });

        test('should handle findings without severity', () => {
            const findings = [
                { severity: 'medium' },
                {}, // No severity
                { severity: 'low' }
            ];

            const maxSeverity = guidanceService.getMaxSeverity(findings);
            expect(maxSeverity).toBe('medium');
        });
    });

    describe('code example generation', () => {
        test('should provide pre-commit configuration example', () => {
            const example = guidanceService.getPreCommitConfigExample();
            expect(example).toContain('.pre-commit-config.yaml');
            expect(example).toContain('detect-secrets');
            expect(example).toContain('ggshield');
        });

        test('should provide CI/CD security example', () => {
            const example = guidanceService.getCiCdSecurityExample();
            expect(example).toContain('GitHub Actions');
            expect(example).toContain('TruffleHog');
            expect(example).toContain('Semgrep');
        });
    });

    describe('guidance templates', () => {
        test('should have comprehensive security misconfiguration guidance', () => {
            const guidance = guidanceService.securityMisconfigurationGuidance;

            expect(guidance).toHaveProperty('csp');
            expect(guidance).toHaveProperty('hsts');
            expect(guidance).toHaveProperty('xFrameOptions');
            expect(guidance).toHaveProperty('exposedFiles');

            // Check CSP guidance structure
            expect(guidance.csp).toHaveProperty('description');
            expect(guidance.csp).toHaveProperty('implementation');
            expect(guidance.csp).toHaveProperty('codeExample');
            expect(guidance.csp).toHaveProperty('testing');
            expect(guidance.csp).toHaveProperty('references');

            expect(guidance.csp.codeExample).toContain('Content-Security-Policy');
        });

        test('should have comprehensive OWASP guidance', () => {
            const guidance = guidanceService.owaspGuidance;

            expect(guidance).toHaveProperty('A01');
            expect(guidance).toHaveProperty('A02');
            expect(guidance).toHaveProperty('A03');

            // Check A01 guidance structure
            expect(guidance.A01).toHaveProperty('title');
            expect(guidance.A01).toHaveProperty('description');
            expect(guidance.A01).toHaveProperty('remediation');
            expect(guidance.A01).toHaveProperty('prevention');
            expect(guidance.A01).toHaveProperty('testing');
            expect(guidance.A01).toHaveProperty('codeExamples');
            expect(guidance.A01).toHaveProperty('references');

            expect(guidance.A01.title).toContain('Broken Access Control');
            expect(guidance.A01.codeExamples.middleware).toContain('authorize');
        });

        test('should have comprehensive code examples', () => {
            const examples = guidanceService.codeExamples;

            expect(examples).toHaveProperty('securityHeaders');
            expect(examples).toHaveProperty('secretManagement');
            expect(examples).toHaveProperty('inputValidation');
            expect(examples).toHaveProperty('accessControl');

            // Check security headers examples
            expect(examples.securityHeaders).toHaveProperty('Content-Security-Policy');
            expect(examples.securityHeaders).toHaveProperty('X-Frame-Options');
            expect(examples.securityHeaders).toHaveProperty('Strict-Transport-Security');

            // Check secret management examples
            expect(examples.secretManagement).toHaveProperty('API Key');
            expect(examples.secretManagement).toHaveProperty('Database Password');

            expect(examples.secretManagement['API Key']).toContain('process.env.API_KEY');
        });
    });

    describe('integration scenarios', () => {
        test('should handle mixed finding types appropriately', () => {
            const mixedFindings = [
                { id: '1', type: 'Missing CSP', category: 'headers', severity: 'medium' },
                { id: '2', type: 'A01: Access Control', category: 'owasp', severity: 'high' },
                { id: '3', type: 'API Key', category: 'secrets', severity: 'critical' },
                { id: '4', type: 'Exposed file', category: 'files', severity: 'high' }
            ];

            const context = { target: { type: 'repository' } };
            const guidance = guidanceService.generateGuidance(mixedFindings, context);

            expect(guidance.securityMisconfigurations).toBeDefined();
            expect(guidance.owaspRemediation).toBeDefined();
            expect(guidance.gitWorkflowSteps).toBeDefined();
            expect(guidance.codeExamples).toBeDefined();
            expect(guidance.prioritizedActions).toBeDefined();

            // Should have critical priority action
            const criticalAction = guidance.prioritizedActions.find(a => a.priority === 'CRITICAL');
            expect(criticalAction).toBeDefined();
        });

        test('should provide appropriate guidance for different scan contexts', () => {
            const urlContext = { target: { type: 'url', value: 'https://example.com' } };
            const repoContext = { target: { type: 'repository', value: 'https://github.com/user/repo' } };

            const urlGuidance = guidanceService.generateGitWorkflowSteps(mockFindings, urlContext);
            const repoGuidance = guidanceService.generateGitWorkflowSteps(mockFindings, repoContext);

            // Repository scans should have more git-specific guidance
            expect(repoGuidance.repositoryCleanup.length).toBeGreaterThan(0);
            expect(urlGuidance.repositoryCleanup.length).toBe(0);
        });
    });
});