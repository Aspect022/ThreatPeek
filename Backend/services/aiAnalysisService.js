/**
 * AI Analysis Service - Provides contextual vulnerability explanations and remediation guidance
 * Integrates AI analysis for impact assessment and risk scoring
 */

class AIAnalysisService {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        this.model = options.model || 'gpt-3.5-turbo';
        this.maxTokens = options.maxTokens || 500;
        this.temperature = options.temperature || 0.3;
        this.timeout = options.timeout || 30000;

        // Cache for analysis results to avoid redundant API calls
        this.analysisCache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 1000;
        this.cacheMaxAge = options.cacheMaxAge || 24 * 60 * 60 * 1000; // 24 hours

        // Fallback explanations when AI is not available
        this.fallbackExplanations = this.initializeFallbackExplanations();

        // Risk scoring weights
        this.riskWeights = {
            severity: { critical: 10, high: 7, medium: 4, low: 1 },
            confidence: { multiplier: 1.0 },
            category: {
                secrets: 1.5,
                owasp: 1.3,
                files: 1.2,
                headers: 0.8,
                misconfig: 1.0
            }
        };
    }

    /**
     * Analyze findings and provide AI-enhanced explanations
     * @param {Array} findings - Security findings to analyze
     * @param {Object} context - Additional context (target, scan type, etc.)
     * @returns {Promise<Object>} Enhanced findings with AI analysis
     */
    async analyzeFindings(findings, context = {}) {
        if (!findings || findings.length === 0) {
            return { findings, analysis: null };
        }

        if (!this.enabled) {
            return this.getFallbackAnalysis(findings, context);
        }

        try {
            const enhancedFindings = await Promise.all(
                findings.map(finding => this.analyzeFinding(finding, context))
            );

            const overallAnalysis = await this.generateOverallAnalysis(enhancedFindings, context);

            return {
                findings: enhancedFindings,
                analysis: overallAnalysis,
                metadata: {
                    analyzedAt: new Date().toISOString(),
                    aiEnabled: this.enabled,
                    model: this.model,
                    totalFindings: findings.length
                }
            };
        } catch (error) {
            console.error('AI analysis failed, using fallback:', error.message);
            return this.getFallbackAnalysis(findings, context);
        }
    }

    /**
     * Analyze a single finding with AI enhancement
     * @param {Object} finding - Security finding to analyze
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} Enhanced finding with AI analysis
     */
    async analyzeFinding(finding, context) {
        const cacheKey = this.generateCacheKey(finding);

        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return { ...finding, aiAnalysis: cached };
        }

        try {
            const analysis = await this.generateFindingAnalysis(finding, context);

            // Cache the result
            this.setCache(cacheKey, analysis);

            return {
                ...finding,
                aiAnalysis: analysis,
                riskScore: this.calculateRiskScore(finding, analysis)
            };
        } catch (error) {
            console.error(`AI analysis failed for finding ${finding.id}:`, error.message);

            // Use fallback analysis
            const fallbackAnalysis = this.getFallbackFindingAnalysis(finding);
            return {
                ...finding,
                aiAnalysis: fallbackAnalysis,
                riskScore: this.calculateRiskScore(finding, fallbackAnalysis)
            };
        }
    }

    /**
     * Generate AI analysis for a specific finding
     * @param {Object} finding - Security finding
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} AI analysis result
     */
    async generateFindingAnalysis(finding, context) {
        const prompt = this.buildAnalysisPrompt(finding, context);

        // For now, we'll use a mock AI response since we don't have OpenAI integration
        // In a real implementation, this would call the OpenAI API
        const aiResponse = await this.mockAIResponse(prompt, finding);

        return {
            explanation: aiResponse.explanation,
            impact: aiResponse.impact,
            remediation: aiResponse.remediation,
            references: aiResponse.references,
            confidence: aiResponse.confidence || 0.8,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Build analysis prompt for AI
     * @param {Object} finding - Security finding
     * @param {Object} context - Additional context
     * @returns {string} Formatted prompt
     */
    buildAnalysisPrompt(finding, context) {
        const { type, severity, category, value, location } = finding;
        const { target, scanType } = context;

        return `
Analyze this security finding and provide detailed explanation and remediation:

Finding Details:
- Type: ${type}
- Severity: ${severity}
- Category: ${category}
- Value: ${value ? value.substring(0, 50) + '...' : 'N/A'}
- Location: ${location?.file || 'Unknown'}
- Target: ${target?.value || 'Unknown'}
- Scan Type: ${scanType || 'Unknown'}

Please provide:
1. Clear explanation of what this finding means
2. Potential security impact and risks
3. Specific step-by-step remediation instructions
4. Relevant security references or standards
5. Confidence level in this analysis (0-1)

Format the response as JSON with keys: explanation, impact, remediation, references, confidence.
`;
    }

    /**
     * Mock AI response for development/testing
     * @param {string} prompt - Analysis prompt
     * @param {Object} finding - Security finding
     * @returns {Promise<Object>} Mock AI response
     */
    async mockAIResponse(prompt, finding) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));

        const { type, severity, category } = finding;

        // Generate contextual response based on finding type
        if (category === 'secrets') {
            return this.generateSecretAnalysis(finding);
        } else if (category === 'files') {
            return this.generateFileAnalysis(finding);
        } else if (category === 'headers') {
            return this.generateHeaderAnalysis(finding);
        } else if (category === 'owasp') {
            return this.generateOwaspAnalysis(finding);
        } else {
            return this.generateGenericAnalysis(finding);
        }
    }

    /**
     * Generate analysis for secret findings
     * @param {Object} finding - Secret finding
     * @returns {Object} Analysis result
     */
    generateSecretAnalysis(finding) {
        const secretType = finding.type || 'API Key';

        return {
            explanation: `This appears to be an exposed ${secretType} that could provide unauthorized access to external services. Exposed secrets are one of the most critical security vulnerabilities as they can lead to data breaches, service abuse, and financial losses.`,

            impact: {
                severity: 'Critical',
                description: `An attacker who obtains this ${secretType} could potentially access associated services, read sensitive data, make unauthorized API calls, or incur charges on your account. The impact depends on the permissions associated with this credential.`,
                businessRisk: 'High - Potential for data breach, service disruption, and financial impact'
            },

            remediation: {
                immediate: [
                    `Immediately revoke/rotate this ${secretType} in the service provider's dashboard`,
                    'Remove the exposed credential from your codebase',
                    'Check access logs for any unauthorized usage'
                ],
                longTerm: [
                    'Implement environment variables or secure secret management (e.g., AWS Secrets Manager, HashiCorp Vault)',
                    'Add the credential pattern to your .gitignore file',
                    'Set up automated secret scanning in your CI/CD pipeline',
                    'Implement least-privilege access principles for API keys'
                ],
                codeExample: `// Instead of hardcoding:\nconst apiKey = "${finding.value?.substring(0, 20)}...";\n\n// Use environment variables:\nconst apiKey = process.env.${secretType.toUpperCase().replace(/\s+/g, '_')}_API_KEY;`
            },

            references: [
                'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/',
                'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
                'https://docs.github.com/en/code-security/secret-scanning'
            ],

            confidence: 0.9
        };
    }

    /**
     * Generate analysis for file exposure findings
     * @param {Object} finding - File finding
     * @returns {Object} Analysis result
     */
    generateFileAnalysis(finding) {
        const fileName = finding.location?.file || finding.value || 'sensitive file';

        return {
            explanation: `This finding indicates that a sensitive file (${fileName}) is accessible via HTTP request. Exposed configuration files, backup files, or development artifacts can reveal sensitive information about your application's structure, credentials, or internal workings.`,

            impact: {
                severity: finding.severity === 'critical' ? 'Critical' : 'High',
                description: 'Exposed files can reveal application secrets, database credentials, internal paths, debugging information, or source code that attackers can use to plan further attacks.',
                businessRisk: 'Medium to High - Information disclosure leading to potential system compromise'
            },

            remediation: {
                immediate: [
                    `Remove or restrict access to ${fileName}`,
                    'Check if the file contains any sensitive information',
                    'Verify that similar files are not also exposed'
                ],
                longTerm: [
                    'Configure web server to deny access to sensitive file patterns',
                    'Implement proper .htaccess or nginx rules',
                    'Use a proper deployment process that excludes development files',
                    'Regular security audits of exposed endpoints'
                ],
                codeExample: `# Apache .htaccess example:\n<Files ".env">\n    Order allow,deny\n    Deny from all\n</Files>\n\n# Nginx example:\nlocation ~ /\\.(env|git|DS_Store) {\n    deny all;\n    return 404;\n}`
            },

            references: [
                'https://owasp.org/www-project-top-ten/2017/A06_2017-Security_Misconfiguration',
                'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/04-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information'
            ],

            confidence: 0.85
        };
    }

    /**
     * Generate analysis for security header findings
     * @param {Object} finding - Header finding
     * @returns {Object} Analysis result
     */
    generateHeaderAnalysis(finding) {
        const headerName = finding.type || 'security header';

        return {
            explanation: `This finding indicates a missing or misconfigured security header (${headerName}). Security headers are HTTP response headers that help protect web applications from common attacks by instructing browsers how to behave when handling your site's content.`,

            impact: {
                severity: finding.severity === 'high' ? 'High' : 'Medium',
                description: `Missing ${headerName} can leave your application vulnerable to attacks like XSS, clickjacking, MIME-type sniffing, or information leakage through referrer headers.`,
                businessRisk: 'Medium - Increased vulnerability to client-side attacks'
            },

            remediation: {
                immediate: [
                    `Configure ${headerName} header in your web server or application`,
                    'Test the header implementation using browser developer tools',
                    'Verify the header appears in all responses'
                ],
                longTerm: [
                    'Implement a comprehensive security header policy',
                    'Use security header testing tools regularly',
                    'Consider using a Content Security Policy (CSP)',
                    'Monitor for new security header recommendations'
                ],
                codeExample: this.getHeaderCodeExample(headerName)
            },

            references: [
                'https://owasp.org/www-project-secure-headers/',
                'https://securityheaders.com/',
                'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers'
            ],

            confidence: 0.8
        };
    }

    /**
     * Generate analysis for OWASP findings
     * @param {Object} finding - OWASP finding
     * @returns {Object} Analysis result
     */
    generateOwaspAnalysis(finding) {
        const owaspCategory = finding.type || 'OWASP vulnerability';

        return {
            explanation: `This finding represents a potential OWASP Top 10 vulnerability (${owaspCategory}). The OWASP Top 10 represents the most critical web application security risks that organizations should be aware of and address.`,

            impact: {
                severity: finding.severity || 'High',
                description: 'OWASP Top 10 vulnerabilities represent the most common and impactful security risks in web applications, potentially leading to data breaches, unauthorized access, or system compromise.',
                businessRisk: 'High - Direct threat to application security and data integrity'
            },

            remediation: {
                immediate: [
                    'Review the specific vulnerability details and affected code',
                    'Implement input validation and output encoding',
                    'Apply security patches and updates'
                ],
                longTerm: [
                    'Implement secure coding practices',
                    'Regular security testing and code reviews',
                    'Follow OWASP security guidelines',
                    'Implement defense-in-depth security measures'
                ],
                codeExample: '// Implement proper input validation and sanitization\n// Use parameterized queries for database operations\n// Apply principle of least privilege'
            },

            references: [
                'https://owasp.org/www-project-top-ten/',
                'https://cheatsheetseries.owasp.org/',
                'https://owasp.org/www-project-web-security-testing-guide/'
            ],

            confidence: 0.75
        };
    }

    /**
     * Generate generic analysis for unknown finding types
     * @param {Object} finding - Generic finding
     * @returns {Object} Analysis result
     */
    generateGenericAnalysis(finding) {
        return {
            explanation: `This security finding indicates a potential vulnerability or misconfiguration that requires attention. The specific nature of the issue should be reviewed in the context of your application's security requirements.`,

            impact: {
                severity: finding.severity || 'Medium',
                description: 'The impact of this finding depends on the specific vulnerability type and your application context. It should be reviewed and addressed according to your security policies.',
                businessRisk: 'Variable - Requires manual assessment'
            },

            remediation: {
                immediate: [
                    'Review the finding details and context',
                    'Assess the actual risk in your environment',
                    'Implement appropriate security controls'
                ],
                longTerm: [
                    'Establish security review processes',
                    'Implement regular security assessments',
                    'Follow security best practices for your technology stack'
                ]
            },

            references: [
                'https://owasp.org/',
                'https://cwe.mitre.org/',
                'https://nvd.nist.gov/'
            ],

            confidence: 0.6
        };
    }

    /**
     * Get code example for security header implementation
     * @param {string} headerName - Name of the security header
     * @returns {string} Code example
     */
    getHeaderCodeExample(headerName) {
        const examples = {
            'Content-Security-Policy': `// Express.js example:\napp.use((req, res, next) => {\n    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'");\n    next();\n});`,

            'X-Frame-Options': `// Express.js example:\napp.use((req, res, next) => {\n    res.setHeader('X-Frame-Options', 'DENY');\n    next();\n});`,

            'Strict-Transport-Security': `// Express.js example:\napp.use((req, res, next) => {\n    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');\n    next();\n});`,

            'X-XSS-Protection': `// Express.js example:\napp.use((req, res, next) => {\n    res.setHeader('X-XSS-Protection', '1; mode=block');\n    next();\n});`
        };

        return examples[headerName] || `// Configure ${headerName} header in your web server or application framework`;
    }

    /**
     * Generate overall analysis for all findings
     * @param {Array} enhancedFindings - Findings with AI analysis
     * @param {Object} context - Scan context
     * @returns {Promise<Object>} Overall analysis
     */
    async generateOverallAnalysis(enhancedFindings, context) {
        const totalFindings = enhancedFindings.length;
        const criticalCount = enhancedFindings.filter(f => f.severity === 'critical').length;
        const highCount = enhancedFindings.filter(f => f.severity === 'high').length;

        const overallRiskScore = this.calculateOverallRiskScore(enhancedFindings);
        const prioritizedRecommendations = this.generatePrioritizedRecommendations(enhancedFindings);

        return {
            summary: {
                totalFindings,
                criticalCount,
                highCount,
                overallRiskScore,
                riskLevel: this.getRiskLevel(overallRiskScore)
            },

            keyInsights: [
                `Found ${totalFindings} security issues requiring attention`,
                criticalCount > 0 ? `${criticalCount} critical issues need immediate remediation` : null,
                highCount > 0 ? `${highCount} high-priority issues should be addressed soon` : null,
                'Regular security scanning is recommended to maintain security posture'
            ].filter(Boolean),

            recommendations: prioritizedRecommendations,

            nextSteps: [
                'Address critical and high-severity findings first',
                'Implement automated security scanning in CI/CD pipeline',
                'Establish regular security review processes',
                'Consider security training for development team'
            ],

            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Calculate risk score for a finding
     * @param {Object} finding - Security finding
     * @param {Object} analysis - AI analysis
     * @returns {number} Risk score (0-100)
     */
    calculateRiskScore(finding, analysis) {
        const severityScore = this.riskWeights.severity[finding.severity] || 4;
        const confidenceMultiplier = (finding.confidence || 0.5) * this.riskWeights.confidence.multiplier;
        const categoryMultiplier = this.riskWeights.category[finding.category] || 1.0;
        const aiConfidence = analysis?.confidence || 0.7;

        const baseScore = severityScore * confidenceMultiplier * categoryMultiplier * aiConfidence;

        // Normalize to 0-100 scale
        return Math.min(100, Math.round(baseScore * 10));
    }

    /**
     * Calculate overall risk score for all findings
     * @param {Array} findings - All findings
     * @returns {number} Overall risk score (0-100)
     */
    calculateOverallRiskScore(findings) {
        if (findings.length === 0) return 0;

        const totalRisk = findings.reduce((sum, finding) => sum + (finding.riskScore || 0), 0);
        const averageRisk = totalRisk / findings.length;

        // Apply multiplier for volume of findings
        const volumeMultiplier = Math.min(2.0, 1 + (findings.length / 50));

        return Math.min(100, Math.round(averageRisk * volumeMultiplier));
    }

    /**
     * Get risk level from risk score
     * @param {number} riskScore - Risk score (0-100)
     * @returns {string} Risk level
     */
    getRiskLevel(riskScore) {
        if (riskScore >= 80) return 'Critical';
        if (riskScore >= 60) return 'High';
        if (riskScore >= 40) return 'Medium';
        return 'Low';
    }

    /**
     * Generate prioritized recommendations
     * @param {Array} findings - Enhanced findings
     * @returns {Array} Prioritized recommendations
     */
    generatePrioritizedRecommendations(findings) {
        const recommendations = [];

        // Group findings by category
        const categories = {};
        findings.forEach(finding => {
            const category = finding.category;
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(finding);
        });

        // Generate category-specific recommendations
        Object.entries(categories).forEach(([category, categoryFindings]) => {
            const criticalCount = categoryFindings.filter(f => f.severity === 'critical').length;
            const highCount = categoryFindings.filter(f => f.severity === 'high').length;

            if (criticalCount > 0 || highCount > 0) {
                recommendations.push({
                    category,
                    priority: criticalCount > 0 ? 'Critical' : 'High',
                    title: this.getCategoryRecommendationTitle(category),
                    description: `Address ${criticalCount + highCount} high-priority ${category} issues`,
                    findingCount: categoryFindings.length,
                    estimatedEffort: this.estimateRemediationEffort(categoryFindings)
                });
            }
        });

        // Sort by priority and impact
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'Critical': 3, 'High': 2, 'Medium': 1, 'Low': 0 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Get recommendation title for category
     * @param {string} category - Finding category
     * @returns {string} Recommendation title
     */
    getCategoryRecommendationTitle(category) {
        const titles = {
            secrets: 'Secure Exposed Credentials',
            files: 'Protect Sensitive Files',
            headers: 'Implement Security Headers',
            owasp: 'Address OWASP Vulnerabilities',
            misconfig: 'Fix Security Misconfigurations'
        };

        return titles[category] || 'Address Security Issues';
    }

    /**
     * Estimate remediation effort
     * @param {Array} findings - Category findings
     * @returns {string} Effort estimate
     */
    estimateRemediationEffort(findings) {
        const totalFindings = findings.length;
        const criticalCount = findings.filter(f => f.severity === 'critical').length;

        if (criticalCount > 5 || totalFindings > 20) return 'High';
        if (criticalCount > 0 || totalFindings > 10) return 'Medium';
        return 'Low';
    }

    /**
     * Get fallback analysis when AI is not available
     * @param {Array} findings - Security findings
     * @param {Object} context - Scan context
     * @returns {Object} Fallback analysis
     */
    getFallbackAnalysis(findings, context) {
        const enhancedFindings = findings.map(finding => ({
            ...finding,
            aiAnalysis: this.getFallbackFindingAnalysis(finding),
            riskScore: this.calculateRiskScore(finding, this.getFallbackFindingAnalysis(finding))
        }));

        return {
            findings: enhancedFindings,
            analysis: {
                summary: {
                    totalFindings: findings.length,
                    criticalCount: findings.filter(f => f.severity === 'critical').length,
                    highCount: findings.filter(f => f.severity === 'high').length,
                    overallRiskScore: this.calculateOverallRiskScore(enhancedFindings),
                    riskLevel: 'Manual Review Required'
                },
                keyInsights: ['AI analysis unavailable - using fallback explanations'],
                recommendations: ['Review findings manually', 'Enable AI analysis for enhanced guidance'],
                nextSteps: ['Address critical findings first', 'Implement security best practices']
            },
            metadata: {
                analyzedAt: new Date().toISOString(),
                aiEnabled: false,
                fallbackUsed: true,
                totalFindings: findings.length
            }
        };
    }

    /**
     * Get fallback analysis for a single finding
     * @param {Object} finding - Security finding
     * @returns {Object} Fallback analysis
     */
    getFallbackFindingAnalysis(finding) {
        const category = finding.category || 'unknown';
        const fallback = this.fallbackExplanations[category] || this.fallbackExplanations.default;

        return {
            explanation: fallback.explanation,
            impact: fallback.impact,
            remediation: fallback.remediation,
            references: fallback.references,
            confidence: 0.6,
            generatedAt: new Date().toISOString(),
            fallback: true
        };
    }

    /**
     * Initialize fallback explanations for when AI is not available
     * @returns {Object} Fallback explanations by category
     */
    initializeFallbackExplanations() {
        return {
            secrets: {
                explanation: 'This appears to be an exposed API key or secret that could provide unauthorized access to external services.',
                impact: { severity: 'Critical', description: 'Exposed secrets can lead to unauthorized access and data breaches.' },
                remediation: { immediate: ['Rotate the exposed credential', 'Remove from codebase'], longTerm: ['Implement proper secret management'] },
                references: ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/']
            },
            files: {
                explanation: 'This finding indicates that a sensitive file is accessible via HTTP request.',
                impact: { severity: 'High', description: 'Exposed files can reveal sensitive configuration or application details.' },
                remediation: { immediate: ['Remove or restrict file access'], longTerm: ['Configure proper access controls'] },
                references: ['https://owasp.org/www-project-top-ten/2017/A06_2017-Security_Misconfiguration']
            },
            headers: {
                explanation: 'This finding indicates a missing or misconfigured security header.',
                impact: { severity: 'Medium', description: 'Missing security headers can leave applications vulnerable to various attacks.' },
                remediation: { immediate: ['Configure the missing security header'], longTerm: ['Implement comprehensive security header policy'] },
                references: ['https://owasp.org/www-project-secure-headers/']
            },
            owasp: {
                explanation: 'This finding represents a potential OWASP Top 10 vulnerability.',
                impact: { severity: 'High', description: 'OWASP vulnerabilities represent critical security risks.' },
                remediation: { immediate: ['Review and address the specific vulnerability'], longTerm: ['Follow OWASP security guidelines'] },
                references: ['https://owasp.org/www-project-top-ten/']
            },
            default: {
                explanation: 'This security finding requires manual review to determine its impact and remediation.',
                impact: { severity: 'Medium', description: 'Manual assessment required to determine actual risk.' },
                remediation: { immediate: ['Review finding details'], longTerm: ['Implement appropriate security controls'] },
                references: ['https://owasp.org/']
            }
        };
    }

    /**
     * Generate cache key for finding analysis
     * @param {Object} finding - Security finding
     * @returns {string} Cache key
     */
    generateCacheKey(finding) {
        const key = `${finding.type}_${finding.category}_${finding.severity}`;
        return Buffer.from(key).toString('base64').substring(0, 32);
    }

    /**
     * Get analysis from cache
     * @param {string} key - Cache key
     * @returns {Object|null} Cached analysis or null
     */
    getFromCache(key) {
        const cached = this.analysisCache.get(key);
        if (!cached) return null;

        // Check if cache entry is expired
        if (Date.now() - cached.timestamp > this.cacheMaxAge) {
            this.analysisCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Set analysis in cache
     * @param {string} key - Cache key
     * @param {Object} data - Analysis data
     */
    setCache(key, data) {
        // Clean cache if it's getting too large
        if (this.analysisCache.size >= this.cacheMaxSize) {
            const oldestKey = this.analysisCache.keys().next().value;
            this.analysisCache.delete(oldestKey);
        }

        this.analysisCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        this.analysisCache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.analysisCache.size,
            maxSize: this.cacheMaxSize,
            maxAge: this.cacheMaxAge
        };
    }
}

module.exports = { AIAnalysisService };