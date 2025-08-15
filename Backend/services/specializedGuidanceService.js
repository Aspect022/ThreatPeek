/**
 * Specialized Guidance Service - Provides detailed remediation guidance
 * Includes security misconfiguration guidance, OWASP-specific advice, and git-workflow-aware steps
 */

class SpecializedGuidanceService {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.includeCodeExamples = options.includeCodeExamples !== false;
        this.includeGitWorkflow = options.includeGitWorkflow !== false;
        this.includeOwaspReferences = options.includeOwaspReferences !== false;

        // Initialize guidance templates
        this.securityMisconfigurationGuidance = this.initializeSecurityMisconfigurationGuidance();
        this.owaspGuidance = this.initializeOwaspGuidance();
        this.gitWorkflowGuidance = this.initializeGitWorkflowGuidance();
        this.codeExamples = this.initializeCodeExamples();
    }

    /**
     * Generate specialized guidance for findings
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context (target, scan type, etc.)
     * @returns {Object} Specialized guidance
     */
    generateGuidance(findings, context = {}) {
        if (!this.enabled || !findings || findings.length === 0) {
            return null;
        }

        const guidance = {
            securityMisconfigurations: this.generateSecurityMisconfigurationGuidance(findings, context),
            owaspRemediation: this.generateOwaspRemediation(findings, context),
            gitWorkflowSteps: this.generateGitWorkflowSteps(findings, context),
            codeExamples: this.generateCodeExamples(findings, context),
            prioritizedActions: this.generatePrioritizedActions(findings, context),
            metadata: {
                generatedAt: new Date().toISOString(),
                totalFindings: findings.length,
                context: context
            }
        };

        return guidance;
    }

    /**
     * Generate security misconfiguration implementation guidance
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Object} Security misconfiguration guidance
     */
    generateSecurityMisconfigurationGuidance(findings, context) {
        const misconfigurations = findings.filter(f =>
            f.category === 'headers' || f.category === 'misconfig' || f.category === 'files'
        );

        if (misconfigurations.length === 0) {
            return null;
        }

        const guidance = {
            overview: 'Security misconfigurations are among the most common vulnerabilities. Here\'s how to address them:',
            categories: {},
            implementationSteps: [],
            bestPractices: []
        };

        // Group by specific misconfiguration types
        const groupedMisconfigs = this.groupMisconfigurationsByType(misconfigurations);

        Object.entries(groupedMisconfigs).forEach(([type, typeFindings]) => {
            const typeGuidance = this.securityMisconfigurationGuidance[type];
            if (typeGuidance) {
                guidance.categories[type] = {
                    description: typeGuidance.description,
                    findings: typeFindings.length,
                    severity: this.getMaxSeverity(typeFindings),
                    implementation: typeGuidance.implementation,
                    codeExample: typeGuidance.codeExample,
                    testing: typeGuidance.testing,
                    references: typeGuidance.references
                };

                // Add implementation steps
                guidance.implementationSteps.push(...typeGuidance.implementationSteps);
            }
        });

        // Add general best practices
        guidance.bestPractices = [
            'Implement security headers as early as possible in your application lifecycle',
            'Use automated testing to verify security configurations',
            'Regularly audit your security settings using tools like SecurityHeaders.com',
            'Follow the principle of defense in depth',
            'Keep security configurations in version control',
            'Document security decisions and their rationale'
        ];

        return guidance;
    }

    /**
     * Generate OWASP-specific remediation advice
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Object} OWASP remediation guidance
     */
    generateOwaspRemediation(findings, context) {
        const owaspFindings = findings.filter(f => f.category === 'owasp');

        if (owaspFindings.length === 0) {
            return null;
        }

        const guidance = {
            overview: 'OWASP Top 10 vulnerabilities require specific remediation approaches. Follow these guidelines:',
            categories: {},
            complianceChecklist: [],
            references: {
                owaspTop10: 'https://owasp.org/www-project-top-ten/',
                cheatSheets: 'https://cheatsheetseries.owasp.org/',
                testingGuide: 'https://owasp.org/www-project-web-security-testing-guide/'
            }
        };

        // Group by OWASP category
        const groupedOwasp = this.groupOwaspByCategory(owaspFindings);

        Object.entries(groupedOwasp).forEach(([category, categoryFindings]) => {
            const owaspGuidance = this.owaspGuidance[category];
            if (owaspGuidance) {
                guidance.categories[category] = {
                    title: owaspGuidance.title,
                    description: owaspGuidance.description,
                    findings: categoryFindings.length,
                    severity: this.getMaxSeverity(categoryFindings),
                    remediation: owaspGuidance.remediation,
                    prevention: owaspGuidance.prevention,
                    testing: owaspGuidance.testing,
                    codeExamples: owaspGuidance.codeExamples,
                    references: owaspGuidance.references
                };

                // Add to compliance checklist
                guidance.complianceChecklist.push(...owaspGuidance.complianceChecklist);
            }
        });

        return guidance;
    }

    /**
     * Generate git-workflow-aware remediation steps
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Object} Git workflow guidance
     */
    generateGitWorkflowSteps(findings, context) {
        if (!this.includeGitWorkflow) {
            return null;
        }

        const isRepositoryScan = context.target?.type === 'repository';
        const hasSecrets = findings.some(f => f.category === 'secrets');
        const hasFiles = findings.some(f => f.category === 'files');

        const guidance = {
            overview: 'Follow these git-workflow-aware steps to remediate security issues:',
            immediateActions: [],
            repositoryCleanup: [],
            preventionMeasures: [],
            workflowIntegration: []
        };

        // Immediate actions based on finding types
        if (hasSecrets) {
            guidance.immediateActions.push(
                '🚨 CRITICAL: Rotate all exposed secrets immediately',
                '🔍 Check git history for secret exposure using: git log --all --full-history -- "*secret*"',
                '📋 Audit recent commits for other potential secrets',
                '🔐 Verify that rotated secrets are not in use elsewhere'
            );
        }

        if (hasFiles) {
            guidance.immediateActions.push(
                '📁 Remove exposed sensitive files from web-accessible directories',
                '🔒 Add sensitive file patterns to .gitignore',
                '🧹 Clean up any backup or temporary files'
            );
        }

        // Repository cleanup steps
        if (isRepositoryScan && hasSecrets) {
            guidance.repositoryCleanup = [
                {
                    step: 'Remove secrets from git history',
                    commands: [
                        '# Use git-filter-repo to remove secrets (recommended)',
                        'git filter-repo --path-glob "*secret*" --invert-paths',
                        '',
                        '# Alternative: Use BFG Repo-Cleaner',
                        'java -jar bfg.jar --replace-text passwords.txt',
                        'git reflog expire --expire=now --all',
                        'git gc --prune=now --aggressive'
                    ],
                    warning: '⚠️ This rewrites git history. Coordinate with your team before proceeding.'
                },
                {
                    step: 'Force push cleaned repository',
                    commands: [
                        'git push --force-with-lease origin main',
                        '# Notify team members to re-clone the repository'
                    ],
                    warning: '⚠️ All team members will need to re-clone the repository.'
                }
            ];
        }

        // Prevention measures
        guidance.preventionMeasures = [
            {
                category: 'Pre-commit hooks',
                description: 'Prevent secrets from being committed',
                implementation: [
                    'Install pre-commit framework: pip install pre-commit',
                    'Add .pre-commit-config.yaml with secret detection',
                    'Run: pre-commit install'
                ],
                codeExample: this.getPreCommitConfigExample()
            },
            {
                category: 'CI/CD Integration',
                description: 'Add security scanning to your pipeline',
                implementation: [
                    'Add secret scanning to CI/CD pipeline',
                    'Implement security gates before deployment',
                    'Set up automated security notifications'
                ],
                codeExample: this.getCiCdSecurityExample()
            },
            {
                category: 'Developer Education',
                description: 'Train team on secure development practices',
                implementation: [
                    'Conduct security awareness training',
                    'Create secure coding guidelines',
                    'Establish security review processes'
                ]
            }
        ];

        // Workflow integration
        guidance.workflowIntegration = [
            'Add security scanning to pull request checks',
            'Implement automated dependency vulnerability scanning',
            'Set up security monitoring and alerting',
            'Create incident response procedures for security findings',
            'Establish regular security review meetings'
        ];

        return guidance;
    }

    /**
     * Generate code examples for remediation
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Object} Code examples
     */
    generateCodeExamples(findings, context) {
        if (!this.includeCodeExamples) {
            return null;
        }

        const examples = {
            securityHeaders: {},
            secretManagement: {},
            inputValidation: {},
            accessControl: {}
        };

        findings.forEach(finding => {
            const category = finding.category;
            const type = finding.type;

            if (category === 'headers') {
                // Map finding types to code example keys
                let exampleKey = null;
                if (type.includes('CSP') || type.includes('Content-Security-Policy')) {
                    exampleKey = 'Content-Security-Policy';
                } else if (type.includes('HSTS') || type.includes('Strict-Transport-Security')) {
                    exampleKey = 'Strict-Transport-Security';
                } else if (type.includes('X-Frame-Options')) {
                    exampleKey = 'X-Frame-Options';
                }

                if (exampleKey && this.codeExamples.securityHeaders[exampleKey]) {
                    examples.securityHeaders[type] = this.codeExamples.securityHeaders[exampleKey];
                }
            } else if (category === 'secrets') {
                // Map secret types to generic examples
                let exampleKey = null;
                if (type.includes('API Key') || type.includes('Access Key')) {
                    exampleKey = 'API Key';
                } else if (type.includes('Password') || type.includes('Database')) {
                    exampleKey = 'Database Password';
                }

                if (exampleKey && this.codeExamples.secretManagement[exampleKey]) {
                    examples.secretManagement[type] = this.codeExamples.secretManagement[exampleKey];
                }
            } else if (category === 'owasp') {
                if (type.includes('Injection')) {
                    const injectionExample = this.codeExamples.inputValidation['SQL Injection'];
                    if (injectionExample) {
                        examples.inputValidation[type] = injectionExample;
                    }
                } else if (type.includes('Access Control')) {
                    const accessExample = this.codeExamples.accessControl['Authorization Middleware'];
                    if (accessExample) {
                        examples.accessControl[type] = accessExample;
                    }
                }
            }
        });

        return examples;
    }

    /**
     * Generate prioritized actions based on findings
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Array} Prioritized actions
     */
    generatePrioritizedActions(findings, context) {
        const actions = [];

        // Critical actions (secrets, critical OWASP)
        const criticalFindings = findings.filter(f => f.severity === 'critical');
        if (criticalFindings.length > 0) {
            actions.push({
                priority: 'CRITICAL',
                timeframe: 'Immediate (within hours)',
                title: 'Address Critical Security Issues',
                description: `${criticalFindings.length} critical issues require immediate attention`,
                actions: [
                    'Rotate any exposed credentials immediately',
                    'Remove sensitive data from public access',
                    'Apply emergency security patches',
                    'Notify security team and stakeholders'
                ]
            });
        }

        // High priority actions
        const highFindings = findings.filter(f => f.severity === 'high');
        if (highFindings.length > 0) {
            actions.push({
                priority: 'HIGH',
                timeframe: 'Short-term (within days)',
                title: 'Resolve High-Priority Vulnerabilities',
                description: `${highFindings.length} high-priority issues need prompt resolution`,
                actions: [
                    'Implement missing security controls',
                    'Fix access control vulnerabilities',
                    'Update security configurations',
                    'Conduct security testing'
                ]
            });
        }

        // Medium priority actions
        const mediumFindings = findings.filter(f => f.severity === 'medium');
        if (mediumFindings.length > 0) {
            actions.push({
                priority: 'MEDIUM',
                timeframe: 'Medium-term (within weeks)',
                title: 'Improve Security Posture',
                description: `${mediumFindings.length} medium-priority improvements available`,
                actions: [
                    'Implement additional security headers',
                    'Enhance input validation',
                    'Improve error handling',
                    'Update security documentation'
                ]
            });
        }

        // Long-term improvements
        actions.push({
            priority: 'LOW',
            timeframe: 'Long-term (ongoing)',
            title: 'Establish Security Best Practices',
            description: 'Build sustainable security practices',
            actions: [
                'Implement automated security testing',
                'Establish security review processes',
                'Provide security training for developers',
                'Create security monitoring and alerting'
            ]
        });

        return actions;
    }

    /**
     * Group misconfigurations by type
     * @param {Array} misconfigurations - Misconfiguration findings
     * @returns {Object} Grouped misconfigurations
     */
    groupMisconfigurationsByType(misconfigurations) {
        const grouped = {};

        misconfigurations.forEach(finding => {
            const type = this.getMisconfigurationType(finding);
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(finding);
        });

        return grouped;
    }

    /**
     * Get misconfiguration type from finding
     * @param {Object} finding - Security finding
     * @returns {string} Misconfiguration type
     */
    getMisconfigurationType(finding) {
        if (finding.category === 'headers') {
            if (finding.type.includes('CSP') || finding.type.includes('Content-Security-Policy')) {
                return 'csp';
            } else if (finding.type.includes('HSTS') || finding.type.includes('Strict-Transport-Security')) {
                return 'hsts';
            } else if (finding.type.includes('X-Frame-Options')) {
                return 'xFrameOptions';
            } else if (finding.type.includes('X-XSS-Protection')) {
                return 'xssProtection';
            } else if (finding.type.includes('Referrer-Policy')) {
                return 'referrerPolicy';
            }
        } else if (finding.category === 'files') {
            return 'exposedFiles';
        } else if (finding.category === 'misconfig') {
            return 'generalMisconfig';
        }

        return 'other';
    }

    /**
     * Group OWASP findings by category
     * @param {Array} owaspFindings - OWASP findings
     * @returns {Object} Grouped OWASP findings
     */
    groupOwaspByCategory(owaspFindings) {
        const grouped = {};

        owaspFindings.forEach(finding => {
            const category = this.getOwaspCategory(finding);
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(finding);
        });

        return grouped;
    }

    /**
     * Get OWASP category from finding
     * @param {Object} finding - OWASP finding
     * @returns {string} OWASP category
     */
    getOwaspCategory(finding) {
        const type = finding.type || '';

        if (type.includes('A01') || type.includes('Access Control')) {
            return 'A01';
        } else if (type.includes('A02') || type.includes('Cryptographic')) {
            return 'A02';
        } else if (type.includes('A03') || type.includes('Injection')) {
            return 'A03';
        } else if (type.includes('A04') || type.includes('Insecure Design')) {
            return 'A04';
        } else if (type.includes('A05') || type.includes('Security Misconfiguration')) {
            return 'A05';
        } else if (type.includes('A06') || type.includes('Vulnerable Components')) {
            return 'A06';
        } else if (type.includes('A07') || type.includes('Authentication')) {
            return 'A07';
        } else if (type.includes('A08') || type.includes('Software Integrity')) {
            return 'A08';
        } else if (type.includes('A09') || type.includes('Logging')) {
            return 'A09';
        } else if (type.includes('A10') || type.includes('SSRF')) {
            return 'A10';
        }

        return 'general';
    }

    /**
     * Get maximum severity from findings
     * @param {Array} findings - Security findings
     * @returns {string} Maximum severity
     */
    getMaxSeverity(findings) {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        let maxSeverity = 'low';
        let maxValue = 1;

        findings.forEach(finding => {
            const severity = finding.severity || 'medium';
            const value = severityOrder[severity] || 2;
            if (value > maxValue) {
                maxValue = value;
                maxSeverity = severity;
            }
        });

        return maxSeverity;
    }

    /**
     * Get pre-commit configuration example
     * @returns {string} Pre-commit config
     */
    getPreCommitConfigExample() {
        return `# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
  - repo: https://github.com/gitguardian/ggshield
    rev: v1.25.0
    hooks:
      - id: ggshield
        language: python
        stages: [commit]`;
    }

    /**
     * Get CI/CD security example
     * @returns {string} CI/CD config
     */
    getCiCdSecurityExample() {
        return `# GitHub Actions example
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: auto`;
    }

    /**
     * Initialize security misconfiguration guidance
     * @returns {Object} Security misconfiguration guidance templates
     */
    initializeSecurityMisconfigurationGuidance() {
        return {
            csp: {
                description: 'Content Security Policy (CSP) helps prevent XSS attacks by controlling resource loading',
                implementation: [
                    'Define a restrictive CSP policy',
                    'Start with a report-only policy to test',
                    'Gradually tighten the policy',
                    'Monitor CSP violation reports'
                ],
                implementationSteps: [
                    'Add CSP header to all HTTP responses',
                    'Test CSP policy in report-only mode',
                    'Analyze violation reports and adjust policy',
                    'Deploy enforcing CSP policy'
                ],
                codeExample: `// Express.js CSP implementation
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none';"
    );
    next();
});`,
                testing: [
                    'Use browser developer tools to check CSP violations',
                    'Test with CSP Evaluator: https://csp-evaluator.withgoogle.com/',
                    'Monitor CSP reports in production'
                ],
                references: [
                    'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
                    'https://csp.withgoogle.com/docs/index.html'
                ]
            },

            hsts: {
                description: 'HTTP Strict Transport Security (HSTS) enforces secure HTTPS connections',
                implementation: [
                    'Enable HSTS on all HTTPS responses',
                    'Set appropriate max-age value',
                    'Consider includeSubDomains directive',
                    'Consider HSTS preload list submission'
                ],
                implementationSteps: [
                    'Configure HSTS header in web server',
                    'Test HSTS functionality',
                    'Monitor HSTS compliance',
                    'Submit to HSTS preload list if appropriate'
                ],
                codeExample: `// Express.js HSTS implementation
app.use((req, res, next) => {
    if (req.secure) {
        res.setHeader('Strict-Transport-Security', 
            'max-age=31536000; includeSubDomains; preload'
        );
    }
    next();
});`,
                testing: [
                    'Verify HSTS header presence on HTTPS responses',
                    'Test with SSL Labs: https://www.ssllabs.com/ssltest/',
                    'Check HSTS preload status'
                ],
                references: [
                    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security',
                    'https://hstspreload.org/'
                ]
            },

            xFrameOptions: {
                description: 'X-Frame-Options prevents clickjacking attacks by controlling frame embedding',
                implementation: [
                    'Set X-Frame-Options to DENY or SAMEORIGIN',
                    'Use frame-ancestors CSP directive as modern alternative',
                    'Test frame embedding behavior',
                    'Consider legitimate framing requirements'
                ],
                implementationSteps: [
                    'Add X-Frame-Options header to responses',
                    'Test clickjacking protection',
                    'Verify legitimate functionality still works',
                    'Monitor for frame-related issues'
                ],
                codeExample: `// Express.js X-Frame-Options implementation
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    // Alternative: res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});`,
                testing: [
                    'Test frame embedding in different browsers',
                    'Verify clickjacking protection works',
                    'Check for legitimate functionality breaks'
                ],
                references: [
                    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
                    'https://owasp.org/www-community/attacks/Clickjacking'
                ]
            },

            exposedFiles: {
                description: 'Exposed sensitive files can reveal configuration details and secrets',
                implementation: [
                    'Remove sensitive files from web-accessible directories',
                    'Configure web server to deny access to sensitive patterns',
                    'Use proper deployment processes',
                    'Implement file access monitoring'
                ],
                implementationSteps: [
                    'Audit web-accessible directories for sensitive files',
                    'Configure web server access controls',
                    'Update deployment processes',
                    'Set up monitoring for file access attempts'
                ],
                codeExample: `# Apache .htaccess example
<FilesMatch "\\.(env|git|DS_Store|log|bak|backup|old)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Nginx example
location ~ /\\.(env|git|DS_Store) {
    deny all;
    return 404;
}`,
                testing: [
                    'Attempt to access common sensitive file paths',
                    'Use automated scanners to check for exposed files',
                    'Monitor web server logs for access attempts'
                ],
                references: [
                    'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information'
                ]
            }
        };
    }

    /**
     * Initialize OWASP guidance
     * @returns {Object} OWASP guidance templates
     */
    initializeOwaspGuidance() {
        return {
            A01: {
                title: 'A01:2021 – Broken Access Control',
                description: 'Access control enforces policy such that users cannot act outside of their intended permissions',
                remediation: [
                    'Implement proper authorization checks',
                    'Use deny by default principle',
                    'Implement proper session management',
                    'Log access control failures'
                ],
                prevention: [
                    'Implement centralized access control mechanisms',
                    'Use attribute-based or role-based access control',
                    'Minimize CORS usage',
                    'Rate limit API access'
                ],
                testing: [
                    'Test horizontal and vertical privilege escalation',
                    'Verify access controls on all endpoints',
                    'Test session management functionality'
                ],
                codeExamples: {
                    middleware: `// Express.js authorization middleware
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        next();
    };
};

// Usage
app.get('/admin', authorize(['admin']), (req, res) => {
    // Admin only endpoint
});`
                },
                complianceChecklist: [
                    'All endpoints have proper authorization checks',
                    'Access control failures are logged and monitored',
                    'Principle of least privilege is enforced',
                    'Session management is secure'
                ],
                references: [
                    'https://owasp.org/Top10/A01_2021-Broken_Access_Control/',
                    'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'
                ]
            },

            A02: {
                title: 'A02:2021 – Cryptographic Failures',
                description: 'Failures related to cryptography which often leads to sensitive data exposure',
                remediation: [
                    'Encrypt sensitive data at rest and in transit',
                    'Use strong, up-to-date cryptographic algorithms',
                    'Implement proper key management',
                    'Avoid storing unnecessary sensitive data'
                ],
                prevention: [
                    'Classify data and apply appropriate protection',
                    'Use TLS for all sensitive communications',
                    'Use proper password hashing algorithms',
                    'Implement secure random number generation'
                ],
                testing: [
                    'Verify encryption of sensitive data',
                    'Test TLS configuration',
                    'Audit cryptographic implementations'
                ],
                codeExamples: {
                    encryption: `// Node.js encryption example
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const secretKey = crypto.randomBytes(32);

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, secretKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}`
                },
                complianceChecklist: [
                    'All sensitive data is encrypted',
                    'Strong cryptographic algorithms are used',
                    'Keys are properly managed and rotated',
                    'TLS is properly configured'
                ],
                references: [
                    'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/',
                    'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html'
                ]
            },

            A03: {
                title: 'A03:2021 – Injection',
                description: 'Application is vulnerable to injection when user-supplied data is not validated, filtered, or sanitized',
                remediation: [
                    'Use parameterized queries or prepared statements',
                    'Validate and sanitize all user inputs',
                    'Use allowlist input validation',
                    'Escape special characters for output contexts'
                ],
                prevention: [
                    'Use safe APIs that avoid interpreters',
                    'Implement positive server-side input validation',
                    'Use LIMIT and other SQL controls',
                    'Implement proper error handling'
                ],
                testing: [
                    'Test all input parameters for injection',
                    'Use automated scanning tools',
                    'Perform manual penetration testing'
                ],
                codeExamples: {
                    sqlInjection: `// Secure database query example
const mysql = require('mysql2/promise');

// BAD - Vulnerable to SQL injection
const badQuery = \`SELECT * FROM users WHERE id = \${userId}\`;

// GOOD - Using parameterized queries
const safeQuery = 'SELECT * FROM users WHERE id = ?';
const [rows] = await connection.execute(safeQuery, [userId]);`,

                    inputValidation: `// Input validation example
const validator = require('validator');

function validateUserInput(input) {
    // Sanitize input
    const sanitized = validator.escape(input);
    
    // Validate format
    if (!validator.isLength(sanitized, { min: 1, max: 100 })) {
        throw new Error('Invalid input length');
    }
    
    // Additional validation rules
    if (!validator.matches(sanitized, /^[a-zA-Z0-9\\s]+$/)) {
        throw new Error('Invalid characters in input');
    }
    
    return sanitized;
}`
                },
                complianceChecklist: [
                    'All user inputs are validated and sanitized',
                    'Parameterized queries are used for database access',
                    'Output encoding is implemented',
                    'Error messages do not reveal sensitive information'
                ],
                references: [
                    'https://owasp.org/Top10/A03_2021-Injection/',
                    'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'
                ]
            }
        };
    }

    /**
     * Initialize git workflow guidance
     * @returns {Object} Git workflow guidance templates
     */
    initializeGitWorkflowGuidance() {
        return {
            secretRemoval: {
                title: 'Remove Secrets from Git History',
                description: 'Completely remove exposed secrets from git repository history',
                steps: [
                    'Identify all commits containing secrets',
                    'Use git-filter-repo or BFG to clean history',
                    'Force push cleaned repository',
                    'Notify team to re-clone repository'
                ],
                commands: [
                    'git filter-repo --path-glob "*secret*" --invert-paths',
                    'git push --force-with-lease origin main'
                ],
                warnings: [
                    'This rewrites git history and affects all team members',
                    'All team members must re-clone the repository',
                    'Coordinate with team before executing'
                ]
            },

            preventionSetup: {
                title: 'Set Up Prevention Measures',
                description: 'Implement measures to prevent future security issues',
                steps: [
                    'Install pre-commit hooks for secret detection',
                    'Add security scanning to CI/CD pipeline',
                    'Set up automated security notifications',
                    'Create security review processes'
                ]
            }
        };
    }

    /**
     * Initialize code examples
     * @returns {Object} Code example templates
     */
    initializeCodeExamples() {
        return {
            securityHeaders: {
                'Content-Security-Policy': `// Express.js CSP header
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
    next();
});`,

                'X-Frame-Options': `// Express.js X-Frame-Options header
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});`,

                'Strict-Transport-Security': `// Express.js HSTS header
app.use((req, res, next) => {
    if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});`
            },

            secretManagement: {
                'API Key': `// Secure API key management
// BAD - Hardcoded API key
const apiKey = 'sk_live_abcd1234...';

// GOOD - Environment variable
const apiKey = process.env.API_KEY;

// BETTER - Secure secret management
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

async function getApiKey() {
    const [version] = await client.accessSecretVersion({
        name: 'projects/my-project/secrets/api-key/versions/latest',
    });
    return version.payload.data.toString();
}`,

                'Database Password': `// Secure database connection
// BAD - Hardcoded password
const dbConfig = {
    host: 'localhost',
    user: 'admin',
    password: 'hardcoded_password',
    database: 'myapp'
};

// GOOD - Environment variables
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};`
            },

            inputValidation: {
                'SQL Injection': `// Prevent SQL injection
const mysql = require('mysql2/promise');

// BAD - String concatenation
const query = \`SELECT * FROM users WHERE email = '\${email}'\`;

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE email = ?';
const [rows] = await connection.execute(query, [email]);`,

                'XSS Prevention': `// Prevent XSS attacks
const validator = require('validator');

// Sanitize user input
function sanitizeInput(input) {
    return validator.escape(input);
}

// Use in template rendering
app.get('/profile', (req, res) => {
    const username = sanitizeInput(req.query.username);
    res.render('profile', { username });
});`
            },

            accessControl: {
                'Authorization Middleware': `// Role-based access control
const authorize = (requiredRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (requiredRoles.length > 0) {
            const hasRole = requiredRoles.some(role => req.user.roles.includes(role));
            if (!hasRole) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        }

        next();
    };
};

// Usage
app.get('/admin', authorize(['admin']), (req, res) => {
    // Admin-only endpoint
});`
            }
        };
    }
}

module.exports = { SpecializedGuidanceService };