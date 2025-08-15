/**
 * OWASP Checker - Implements OWASP Top 10 baseline security checks
 * Focuses on A01: Broken Access Control, A02: Cryptographic Failures, A03: Injection
 */

const axios = require('axios');
const { allPatterns } = require('../utils/enhancedPatternDefinitions');

class OWASPChecker {
    constructor() {
        this.adminPaths = [
            '/admin',
            '/admin/',
            '/admin/login',
            '/admin/dashboard',
            '/administrator',
            '/wp-admin',
            '/wp-admin/',
            '/phpmyadmin',
            '/phpmyadmin/',
            '/cpanel',
            '/control-panel',
            '/management',
            '/manager',
            '/console',
            '/backend',
            '/admin-panel',
            '/admin_panel',
            '/adminpanel',
            '/login',
            '/signin',
            '/auth',
            '/dashboard'
        ];

        this.sensitiveFilePaths = [
            '/.htaccess',
            '/.htpasswd',
            '/web.config',
            '/config.php',
            '/config.json',
            '/settings.json',
            '/app.config',
            '/database.yml',
            '/secrets.yml',
            '/credentials.json',
            '/backup.sql',
            '/dump.sql',
            '/users.sql',
            '/admin.sql'
        ];

        // A01: Access Control patterns
        this.accessControlPatterns = [
            {
                id: 'exposed-admin-interface',
                name: 'Exposed Admin Interface',
                category: 'owasp-a01',
                severity: 'high',
                description: 'Admin interface accessible without proper authentication'
            },
            {
                id: 'unrestricted-file-access',
                name: 'Unrestricted File Access',
                category: 'owasp-a01',
                severity: 'critical',
                description: 'Sensitive files accessible without authentication'
            },
            {
                id: 'directory-traversal',
                name: 'Directory Traversal Vulnerability',
                category: 'owasp-a01',
                severity: 'high',
                description: 'Potential directory traversal patterns detected'
            }
        ];

        // A02: Cryptographic Failures patterns
        this.cryptographicPatterns = [
            {
                id: 'weak-encryption',
                name: 'Weak Encryption Algorithm',
                category: 'owasp-a02',
                severity: 'high',
                regex: /(?:md5|sha1|des|rc4|ssl\s*v[12]|tls\s*v1\.0)/gi,
                description: 'Weak or deprecated cryptographic algorithms detected'
            },
            {
                id: 'hardcoded-crypto-key',
                name: 'Hardcoded Cryptographic Key',
                category: 'owasp-a02',
                severity: 'critical',
                regex: /(?:crypto[_-]?key|encryption[_-]?key|secret[_-]?key)[:\s='"]*([\w+/=]{16,})/gi,
                description: 'Hardcoded cryptographic keys found in code'
            },
            {
                id: 'insecure-random',
                name: 'Insecure Random Number Generation',
                category: 'owasp-a02',
                severity: 'medium',
                regex: /Math\.random\(\)|Random\(\)|rand\(\)/gi,
                description: 'Insecure random number generation for cryptographic purposes'
            }
        ];

        // A03: Injection patterns
        this.injectionPatterns = [
            {
                id: 'sql-injection-js',
                name: 'SQL Injection in JavaScript',
                category: 'owasp-a03',
                severity: 'critical',
                regex: /(?:query|execute|exec|prepare)\s*\(\s*['"`].*?['"`]\s*\+.*?\)/gi,
                description: 'Potential SQL injection vulnerability in JavaScript code'
            },
            {
                id: 'sql-injection-error',
                name: 'SQL Injection Error Pattern',
                category: 'owasp-a03',
                severity: 'high',
                regex: /(?:mysql_|ora-|microsoft|odbc|jdbc|sql\s+server).*error/gi,
                description: 'SQL error messages that may indicate injection vulnerabilities'
            },
            {
                id: 'nosql-injection',
                name: 'NoSQL Injection Pattern',
                category: 'owasp-a03',
                severity: 'high',
                regex: /\$(?:where|ne|gt|lt|gte|lte|in|nin|regex|exists)/gi,
                description: 'Potential NoSQL injection patterns detected'
            },
            {
                id: 'command-injection',
                name: 'Command Injection Pattern',
                category: 'owasp-a03',
                severity: 'critical',
                regex: /(?:exec|system|shell_exec|passthru|eval)\s*\(\s*.*\+/gi,
                description: 'Potential command injection vulnerability'
            }
        ];
    }

    async scan(target, options = {}) {
        const { value: url } = target;
        const { onProgress, content } = options;
        const findings = [];

        console.log(`[OWASP_CHECKER] Starting OWASP baseline scan for: ${url}`);

        try {
            // A01: Broken Access Control checks
            if (onProgress) onProgress(10);
            const accessControlFindings = await this.checkAccessControl(url, content);
            findings.push(...accessControlFindings);

            // A02: Cryptographic Failures checks
            if (onProgress) onProgress(40);
            const cryptoFindings = await this.checkCryptographicFailures(url, content);
            findings.push(...cryptoFindings);

            // A03: Injection checks
            if (onProgress) onProgress(70);
            const injectionFindings = await this.checkInjectionVulnerabilities(url, content);
            findings.push(...injectionFindings);

            if (onProgress) onProgress(100);

            console.log(`[OWASP_CHECKER] Found ${findings.length} OWASP-related issues`);
            return findings;

        } catch (error) {
            console.error('[OWASP_CHECKER] Error during scan:', error.message);
            return [];
        }
    }

    async checkAccessControl(url, content) {
        const findings = [];

        try {
            // Check for exposed admin interfaces
            const adminFindings = await this.checkExposedAdminInterfaces(url);
            findings.push(...adminFindings);

            // Check for unrestricted file access
            const fileAccessFindings = await this.checkUnrestrictedFileAccess(url);
            findings.push(...fileAccessFindings);

            // Check for directory traversal patterns in content
            if (content) {
                const traversalFindings = this.checkDirectoryTraversalPatterns(url, content);
                findings.push(...traversalFindings);
            }

        } catch (error) {
            console.error('[OWASP_CHECKER] Error in access control checks:', error.message);
        }

        return findings;
    }

    async checkExposedAdminInterfaces(baseUrl) {
        const findings = [];
        const timeout = 30000; // 30 seconds

        for (const adminPath of this.adminPaths) {
            try {
                const testUrl = new URL(adminPath, baseUrl).toString();

                const response = await axios.get(testUrl, {
                    timeout,
                    validateStatus: (status) => status < 500, // Don't throw on 4xx
                    headers: {
                        'User-Agent': 'ThreatPeek-Scanner/1.0'
                    }
                });

                // Check if admin interface is accessible (200, 302, or contains admin-related content)
                if (response.status === 200 || response.status === 302) {
                    const content = response.data?.toLowerCase() || '';
                    const isAdminInterface = content.includes('admin') ||
                        content.includes('login') ||
                        content.includes('dashboard') ||
                        content.includes('username') ||
                        content.includes('password');

                    if (isAdminInterface) {
                        findings.push({
                            type: 'OWASP A01: Exposed Admin Interface',
                            severity: 'high',
                            confidence: 0.8,
                            value: testUrl,
                            file: testUrl,
                            context: {
                                before: `HTTP ${response.status}`,
                                after: 'Admin interface accessible'
                            },
                            pattern: {
                                id: 'exposed-admin-interface',
                                category: 'owasp-a01'
                            },
                            description: 'Admin interface is accessible and may lack proper authentication controls',
                            remediation: 'Implement proper authentication and access controls for admin interfaces'
                        });
                    }
                }
            } catch (error) {
                // Ignore connection errors, timeouts, etc.
                continue;
            }
        }

        return findings;
    }

    async checkUnrestrictedFileAccess(baseUrl) {
        const findings = [];
        const timeout = 30000; // 30 seconds

        for (const filePath of this.sensitiveFilePaths) {
            try {
                const testUrl = new URL(filePath, baseUrl).toString();

                const response = await axios.get(testUrl, {
                    timeout,
                    validateStatus: (status) => status < 500,
                    headers: {
                        'User-Agent': 'ThreatPeek-Scanner/1.0'
                    }
                });

                if (response.status === 200 && response.data) {
                    findings.push({
                        type: 'OWASP A01: Unrestricted File Access',
                        severity: 'critical',
                        confidence: 0.9,
                        value: testUrl,
                        file: testUrl,
                        context: {
                            before: `HTTP ${response.status}`,
                            after: 'Sensitive file accessible'
                        },
                        pattern: {
                            id: 'unrestricted-file-access',
                            category: 'owasp-a01'
                        },
                        description: 'Sensitive configuration file is publicly accessible',
                        remediation: 'Restrict access to sensitive files using proper server configuration'
                    });
                }
            } catch (error) {
                // Ignore connection errors, timeouts, etc.
                continue;
            }
        }

        return findings;
    }

    checkDirectoryTraversalPatterns(url, content) {
        const findings = [];
        const traversalPatterns = [
            /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/gi,
            /(?:file|path|dir|folder)[:\s='"]*(\.\.\/|\.\.\\)/gi,
            /(?:include|require|import)[:\s='"]*(\.\.\/)/gi
        ];

        for (const pattern of traversalPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                findings.push({
                    type: 'OWASP A01: Directory Traversal Pattern',
                    severity: 'high',
                    confidence: 0.7,
                    value: match[0],
                    file: url,
                    context: {
                        before: content.substring(Math.max(0, match.index - 50), match.index),
                        after: content.substring(match.index + match[0].length, match.index + match[0].length + 50)
                    },
                    pattern: {
                        id: 'directory-traversal',
                        category: 'owasp-a01'
                    },
                    description: 'Potential directory traversal pattern detected in code',
                    remediation: 'Validate and sanitize file paths, use allowlists for permitted files'
                });
            }
        }

        return findings;
    }

    async checkCryptographicFailures(url, content) {
        const findings = [];

        if (!content) return findings;

        for (const pattern of this.cryptographicPatterns) {
            if (pattern.regex) {
                const matches = content.matchAll(pattern.regex);
                for (const match of matches) {
                    findings.push({
                        type: `OWASP A02: ${pattern.name}`,
                        severity: pattern.severity,
                        confidence: 0.8,
                        value: match[0],
                        file: url,
                        context: {
                            before: content.substring(Math.max(0, match.index - 50), match.index),
                            after: content.substring(match.index + match[0].length, match.index + match[0].length + 50)
                        },
                        pattern: {
                            id: pattern.id,
                            category: pattern.category
                        },
                        description: pattern.description,
                        remediation: this.getCryptographicRemediation(pattern.id)
                    });
                }
            }
        }

        return findings;
    }

    async checkInjectionVulnerabilities(url, content) {
        const findings = [];

        if (!content) return findings;

        for (const pattern of this.injectionPatterns) {
            if (pattern.regex) {
                const matches = content.matchAll(pattern.regex);
                for (const match of matches) {
                    findings.push({
                        type: `OWASP A03: ${pattern.name}`,
                        severity: pattern.severity,
                        confidence: 0.7,
                        value: match[0],
                        file: url,
                        context: {
                            before: content.substring(Math.max(0, match.index - 50), match.index),
                            after: content.substring(match.index + match[0].length, match.index + match[0].length + 50)
                        },
                        pattern: {
                            id: pattern.id,
                            category: pattern.category
                        },
                        description: pattern.description,
                        remediation: this.getInjectionRemediation(pattern.id)
                    });
                }
            }
        }

        return findings;
    }

    getCryptographicRemediation(patternId) {
        const remediations = {
            'weak-encryption': 'Replace weak algorithms with strong alternatives: Use AES-256, SHA-256, TLS 1.2+',
            'hardcoded-crypto-key': 'Store cryptographic keys securely using environment variables or key management systems',
            'insecure-random': 'Use cryptographically secure random number generators like crypto.randomBytes()'
        };
        return remediations[patternId] || 'Review and strengthen cryptographic implementation';
    }

    getInjectionRemediation(patternId) {
        const remediations = {
            'sql-injection-js': 'Use parameterized queries or prepared statements instead of string concatenation',
            'sql-injection-error': 'Implement proper error handling and avoid exposing database errors to users',
            'nosql-injection': 'Validate and sanitize input, use proper query builders with parameter binding',
            'command-injection': 'Avoid dynamic command execution, use allowlists and input validation'
        };
        return remediations[patternId] || 'Implement proper input validation and sanitization';
    }

    // Generate OWASP compliance report
    generateComplianceReport(findings) {
        const categories = {
            'A01': { name: 'Broken Access Control', findings: [], severity: 'low' },
            'A02': { name: 'Cryptographic Failures', findings: [], severity: 'low' },
            'A03': { name: 'Injection', findings: [], severity: 'low' }
        };

        // Group findings by OWASP category
        findings.forEach(finding => {
            const category = finding.pattern?.category?.split('-')[1]?.toUpperCase();
            if (categories[category]) {
                categories[category].findings.push(finding);

                // Update category severity based on highest finding severity
                const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
                const currentLevel = severityLevels[categories[category].severity];
                const findingLevel = severityLevels[finding.severity];

                if (findingLevel > currentLevel) {
                    categories[category].severity = finding.severity;
                }
            }
        });

        // Calculate compliance score
        const totalCategories = Object.keys(categories).length;
        const passedCategories = Object.values(categories).filter(cat => cat.findings.length === 0).length;
        const complianceScore = Math.round((passedCategories / totalCategories) * 100);

        return {
            categories,
            complianceScore,
            totalFindings: findings.length,
            summary: `OWASP Top 10 Baseline Check: ${complianceScore}% compliant (${passedCategories}/${totalCategories} categories passed)`
        };
    }
}

module.exports = new OWASPChecker();