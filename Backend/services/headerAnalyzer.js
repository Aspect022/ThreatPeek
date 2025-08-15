/**
 * Header Analyzer - Analyzes HTTP security headers and configurations
 * Implements comprehensive security header validation and CORS analysis
 */

const axios = require('axios');

class HeaderAnalyzer {
    constructor() {
        this.timeout = 60000; // 60 seconds
        this.maxRedirects = 5;
    }

    /**
     * Scan a URL target for security header issues
     * @param {Object} target - Target configuration
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Array of findings
     */
    async scan(target, options = {}) {
        const { value: url } = target;
        const { timeout = this.timeout, onProgress } = options;

        console.log(`[HEADER_ANALYZER] Analyzing security headers for: ${url}`);
        console.log(`[HEADER_ANALYZER] Using timeout: ${timeout}ms`);

        try {
            // Update progress
            if (onProgress) onProgress(20);

            // Fetch headers with HEAD request first, fallback to GET if needed
            let response;
            try {
                response = await axios.head(url, {
                    timeout,
                    maxRedirects: this.maxRedirects,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/2.0; +https://threatpeek.com)'
                    }
                });
            } catch (error) {
                // Fallback to GET request if HEAD fails
                console.log(`[HEADER_ANALYZER] HEAD request failed, trying GET: ${error.message}`);
                response = await axios.get(url, {
                    timeout,
                    maxRedirects: this.maxRedirects,
                    maxContentLength: 10 * 1024 * 1024, // 10MB limit
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/2.0; +https://threatpeek.com)'
                    }
                });
            }

            if (onProgress) onProgress(50);

            // Extract and analyze headers
            const headers = this.normalizeHeaders(response.headers);
            const findings = [];

            // Analyze security headers
            findings.push(...this.analyzeCSP(headers, url));
            findings.push(...this.analyzeHSTS(headers, url));
            findings.push(...this.analyzeXXSSProtection(headers, url));
            findings.push(...this.analyzeReferrerPolicy(headers, url));
            findings.push(...this.analyzeXFrameOptions(headers, url));
            findings.push(...this.analyzeCORS(headers, url));

            if (onProgress) onProgress(100);

            console.log(`[HEADER_ANALYZER] Completed header analysis for ${url}, found ${findings.length} issues`);
            return findings;

        } catch (error) {
            console.error(`[HEADER_ANALYZER] Error analyzing headers for ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Normalize header names to lowercase for consistent analysis
     * @param {Object} headers - Raw headers object
     * @returns {Object} Normalized headers
     */
    normalizeHeaders(headers) {
        const normalized = {};
        for (const [key, value] of Object.entries(headers)) {
            normalized[key.toLowerCase()] = value;
        }
        return normalized;
    }

    /**
     * Analyze Content Security Policy (CSP) header
     * @param {Object} headers - Normalized headers
     * @param {string} url - Target URL
     * @returns {Array} Array of CSP-related findings
     */
    analyzeCSP(headers, url) {
        const findings = [];
        const csp = headers['content-security-policy'];

        if (!csp) {
            findings.push({
                type: 'Missing Content Security Policy',
                severity: 'high',
                confidence: 0.95,
                value: 'Content-Security-Policy header is missing',
                file: url,
                context: {
                    before: 'HTTP security headers analysis',
                    after: 'XSS and injection attack protection missing'
                },
                location: {
                    header: 'Content-Security-Policy',
                    status: 'missing'
                },
                pattern: {
                    id: 'missing-csp-header',
                    category: 'headers'
                },
                remediation: {
                    description: 'Implement Content Security Policy to prevent XSS attacks',
                    example: "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
                }
            });
        } else {
            // Analyze CSP configuration
            const cspFindings = this.validateCSPConfiguration(csp, url);
            findings.push(...cspFindings);
        }

        return findings;
    }

    /**
     * Validate CSP configuration for security issues
     * @param {string} csp - CSP header value
     * @param {string} url - Target URL
     * @returns {Array} Array of CSP configuration findings
     */
    validateCSPConfiguration(csp, url) {
        const findings = [];
        const cspLower = csp.toLowerCase();

        // Check for unsafe-eval
        if (cspLower.includes("'unsafe-eval'")) {
            findings.push({
                type: 'Unsafe CSP Configuration',
                severity: 'medium',
                confidence: 0.90,
                value: "CSP allows 'unsafe-eval' which can enable code injection",
                file: url,
                context: {
                    before: 'Content-Security-Policy analysis',
                    after: "Found 'unsafe-eval' directive"
                },
                location: {
                    header: 'Content-Security-Policy',
                    directive: 'unsafe-eval'
                },
                pattern: {
                    id: 'csp-unsafe-eval',
                    category: 'headers'
                },
                remediation: {
                    description: "Remove 'unsafe-eval' from CSP and use safer alternatives",
                    example: "Use specific script sources instead of 'unsafe-eval'"
                }
            });
        }

        // Check for wildcard in script-src
        if (cspLower.includes('script-src') && cspLower.includes('*')) {
            const scriptSrcMatch = csp.match(/script-src[^;]*/i);
            if (scriptSrcMatch && scriptSrcMatch[0].includes('*')) {
                findings.push({
                    type: 'Permissive CSP Script Source',
                    severity: 'high',
                    confidence: 0.85,
                    value: 'CSP script-src allows wildcard (*) which defeats XSS protection',
                    file: url,
                    context: {
                        before: 'Content-Security-Policy script-src analysis',
                        after: 'Wildcard source detected in script-src'
                    },
                    location: {
                        header: 'Content-Security-Policy',
                        directive: 'script-src'
                    },
                    pattern: {
                        id: 'csp-script-wildcard',
                        category: 'headers'
                    },
                    remediation: {
                        description: 'Replace wildcard with specific trusted domains',
                        example: "script-src 'self' https://trusted-cdn.com"
                    }
                });
            }
        }

        // Check for missing object-src restriction
        if (!cspLower.includes('object-src')) {
            findings.push({
                type: 'Missing CSP Object Source Restriction',
                severity: 'medium',
                confidence: 0.80,
                value: 'CSP missing object-src directive, plugins may be unrestricted',
                file: url,
                context: {
                    before: 'Content-Security-Policy directive analysis',
                    after: 'object-src directive not found'
                },
                location: {
                    header: 'Content-Security-Policy',
                    directive: 'object-src'
                },
                pattern: {
                    id: 'csp-missing-object-src',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add object-src directive to prevent plugin-based attacks',
                    example: "object-src 'none'"
                }
            });
        }

        return findings;
    }

    /**
     * Analyze HTTP Strict Transport Security (HSTS) header
     * @param {Object} headers - Normalized headers
     * @param {string} url - Target URL
     * @returns {Array} Array of HSTS-related findings
     */
    analyzeHSTS(headers, url) {
        const findings = [];
        const hsts = headers['strict-transport-security'];
        const isHttps = url.startsWith('https://');

        if (isHttps && !hsts) {
            findings.push({
                type: 'Missing HSTS Header',
                severity: 'medium',
                confidence: 0.90,
                value: 'Strict-Transport-Security header is missing on HTTPS site',
                file: url,
                context: {
                    before: 'HTTPS security headers analysis',
                    after: 'HSTS protection missing'
                },
                location: {
                    header: 'Strict-Transport-Security',
                    status: 'missing'
                },
                pattern: {
                    id: 'missing-hsts-header',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add HSTS header to prevent protocol downgrade attacks',
                    example: 'Strict-Transport-Security: max-age=31536000; includeSubDomains'
                }
            });
        } else if (hsts) {
            // Analyze HSTS configuration
            const hstsFindings = this.validateHSTSConfiguration(hsts, url);
            findings.push(...hstsFindings);
        }

        return findings;
    }

    /**
     * Validate HSTS configuration for security issues
     * @param {string} hsts - HSTS header value
     * @param {string} url - Target URL
     * @returns {Array} Array of HSTS configuration findings
     */
    validateHSTSConfiguration(hsts, url) {
        const findings = [];
        const hstsLower = hsts.toLowerCase();

        // Extract max-age value
        const maxAgeMatch = hstsLower.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
            const maxAge = parseInt(maxAgeMatch[1]);

            // Check if max-age is too short (less than 6 months)
            const sixMonths = 6 * 30 * 24 * 60 * 60; // 6 months in seconds
            if (maxAge < sixMonths) {
                findings.push({
                    type: 'Weak HSTS Configuration',
                    severity: 'low',
                    confidence: 0.85,
                    value: `HSTS max-age is too short (${maxAge} seconds), should be at least 6 months`,
                    file: url,
                    context: {
                        before: 'Strict-Transport-Security analysis',
                        after: `max-age=${maxAge} detected`
                    },
                    location: {
                        header: 'Strict-Transport-Security',
                        directive: 'max-age'
                    },
                    pattern: {
                        id: 'hsts-short-max-age',
                        category: 'headers'
                    },
                    remediation: {
                        description: 'Increase HSTS max-age to at least 6 months (15768000 seconds)',
                        example: 'Strict-Transport-Security: max-age=31536000; includeSubDomains'
                    }
                });
            }
        } else {
            findings.push({
                type: 'Invalid HSTS Configuration',
                severity: 'medium',
                confidence: 0.95,
                value: 'HSTS header present but missing required max-age directive',
                file: url,
                context: {
                    before: 'Strict-Transport-Security validation',
                    after: 'max-age directive not found'
                },
                location: {
                    header: 'Strict-Transport-Security',
                    directive: 'max-age'
                },
                pattern: {
                    id: 'hsts-missing-max-age',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add max-age directive to HSTS header',
                    example: 'Strict-Transport-Security: max-age=31536000'
                }
            });
        }

        // Check for includeSubDomains
        if (!hstsLower.includes('includesubdomains')) {
            findings.push({
                type: 'HSTS Missing Subdomain Protection',
                severity: 'low',
                confidence: 0.75,
                value: 'HSTS header missing includeSubDomains directive',
                file: url,
                context: {
                    before: 'Strict-Transport-Security subdomain analysis',
                    after: 'includeSubDomains directive not found'
                },
                location: {
                    header: 'Strict-Transport-Security',
                    directive: 'includeSubDomains'
                },
                pattern: {
                    id: 'hsts-missing-subdomains',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add includeSubDomains to protect all subdomains',
                    example: 'Strict-Transport-Security: max-age=31536000; includeSubDomains'
                }
            });
        }

        return findings;
    }

    /**
     * Analyze X-XSS-Protection header
     * @param {Object} headers - Normalized headers
     * @param {string} url - Target URL
     * @returns {Array} Array of X-XSS-Protection related findings
     */
    analyzeXXSSProtection(headers, url) {
        const findings = [];
        const xssProtection = headers['x-xss-protection'];

        if (!xssProtection) {
            findings.push({
                type: 'Missing X-XSS-Protection Header',
                severity: 'medium',
                confidence: 0.85,
                value: 'X-XSS-Protection header is missing',
                file: url,
                context: {
                    before: 'XSS protection headers analysis',
                    after: 'Browser XSS filtering not enabled'
                },
                location: {
                    header: 'X-XSS-Protection',
                    status: 'missing'
                },
                pattern: {
                    id: 'missing-xss-protection-header',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add X-XSS-Protection header to enable browser XSS filtering',
                    example: 'X-XSS-Protection: 1; mode=block'
                }
            });
        } else {
            // Analyze X-XSS-Protection configuration
            const xssFindings = this.validateXXSSProtectionConfiguration(xssProtection, url);
            findings.push(...xssFindings);
        }

        return findings;
    }

    /**
     * Validate X-XSS-Protection configuration
     * @param {string} xssProtection - X-XSS-Protection header value
     * @param {string} url - Target URL
     * @returns {Array} Array of X-XSS-Protection configuration findings
     */
    validateXXSSProtectionConfiguration(xssProtection, url) {
        const findings = [];
        const xssLower = xssProtection.toLowerCase().trim();

        // Check if XSS protection is disabled
        if (xssLower === '0') {
            findings.push({
                type: 'Disabled XSS Protection',
                severity: 'medium',
                confidence: 0.90,
                value: 'X-XSS-Protection is explicitly disabled (set to 0)',
                file: url,
                context: {
                    before: 'X-XSS-Protection configuration analysis',
                    after: 'XSS filtering disabled'
                },
                location: {
                    header: 'X-XSS-Protection',
                    value: '0'
                },
                pattern: {
                    id: 'xss-protection-disabled',
                    category: 'headers'
                },
                remediation: {
                    description: 'Enable XSS protection or remove header to use browser default',
                    example: 'X-XSS-Protection: 1; mode=block'
                }
            });
        } else if (xssLower === '1' && !xssLower.includes('mode=block')) {
            // XSS protection enabled but without block mode
            findings.push({
                type: 'Weak XSS Protection Configuration',
                severity: 'low',
                confidence: 0.75,
                value: 'X-XSS-Protection enabled but missing mode=block directive',
                file: url,
                context: {
                    before: 'X-XSS-Protection mode analysis',
                    after: 'mode=block directive not found'
                },
                location: {
                    header: 'X-XSS-Protection',
                    directive: 'mode=block'
                },
                pattern: {
                    id: 'xss-protection-weak-mode',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add mode=block to prevent XSS attacks more effectively',
                    example: 'X-XSS-Protection: 1; mode=block'
                }
            });
        }

        return findings;
    }

    /**
     * Analyze Referrer-Policy header
     * @param {Object} headers - Normalized headers
     * @param {string} url - Target URL
     * @returns {Array} Array of Referrer-Policy related findings
     */
    analyzeReferrerPolicy(headers, url) {
        const findings = [];
        const referrerPolicy = headers['referrer-policy'];

        if (!referrerPolicy) {
            findings.push({
                type: 'Missing Referrer-Policy Header',
                severity: 'low',
                confidence: 0.80,
                value: 'Referrer-Policy header is missing',
                file: url,
                context: {
                    before: 'Referrer policy headers analysis',
                    after: 'Referrer information may leak to external sites'
                },
                location: {
                    header: 'Referrer-Policy',
                    status: 'missing'
                },
                pattern: {
                    id: 'missing-referrer-policy-header',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add Referrer-Policy header to control referrer information disclosure',
                    example: 'Referrer-Policy: strict-origin-when-cross-origin'
                }
            });
        } else {
            // Analyze Referrer-Policy configuration
            const referrerFindings = this.validateReferrerPolicyConfiguration(referrerPolicy, url);
            findings.push(...referrerFindings);
        }

        return findings;
    }

    /**
     * Validate Referrer-Policy configuration
     * @param {string} referrerPolicy - Referrer-Policy header value
     * @param {string} url - Target URL
     * @returns {Array} Array of Referrer-Policy configuration findings
     */
    validateReferrerPolicyConfiguration(referrerPolicy, url) {
        const findings = [];
        const policyLower = referrerPolicy.toLowerCase().trim();

        // Check for unsafe referrer policies
        const unsafePolicies = ['unsafe-url', 'no-referrer-when-downgrade'];
        if (unsafePolicies.includes(policyLower)) {
            findings.push({
                type: 'Permissive Referrer Policy',
                severity: 'low',
                confidence: 0.75,
                value: `Referrer-Policy '${referrerPolicy}' may leak sensitive information`,
                file: url,
                context: {
                    before: 'Referrer-Policy configuration analysis',
                    after: `Policy '${referrerPolicy}' detected`
                },
                location: {
                    header: 'Referrer-Policy',
                    value: referrerPolicy
                },
                pattern: {
                    id: 'referrer-policy-permissive',
                    category: 'headers'
                },
                remediation: {
                    description: 'Use a more restrictive referrer policy to prevent information leakage',
                    example: 'Referrer-Policy: strict-origin-when-cross-origin'
                }
            });
        }

        return findings;
    }

    /**
     * Analyze X-Frame-Options header for clickjacking protection
     * @param {Object} headers - Normalized headers
     * @param {string} url - Target URL
     * @returns {Array} Array of X-Frame-Options related findings
     */
    analyzeXFrameOptions(headers, url) {
        const findings = [];
        const xFrameOptions = headers['x-frame-options'];

        if (!xFrameOptions) {
            findings.push({
                type: 'Missing X-Frame-Options Header',
                severity: 'medium',
                confidence: 0.85,
                value: 'X-Frame-Options header is missing',
                file: url,
                context: {
                    before: 'Clickjacking protection headers analysis',
                    after: 'Page can be embedded in frames, potential clickjacking risk'
                },
                location: {
                    header: 'X-Frame-Options',
                    status: 'missing'
                },
                pattern: {
                    id: 'missing-x-frame-options-header',
                    category: 'headers'
                },
                remediation: {
                    description: 'Add X-Frame-Options header to prevent clickjacking attacks',
                    example: 'X-Frame-Options: DENY'
                }
            });
        } else {
            // Analyze X-Frame-Options configuration
            const frameFindings = this.validateXFrameOptionsConfiguration(xFrameOptions, url);
            findings.push(...frameFindings);
        }

        return findings;
    }

    /**
     * Validate X-Frame-Options configuration
     * @param {string} xFrameOptions - X-Frame-Options header value
     * @param {string} url - Target URL
     * @returns {Array} Array of X-Frame-Options configuration findings
     */
    validateXFrameOptionsConfiguration(xFrameOptions, url) {
        const findings = [];
        const optionsUpper = xFrameOptions.toUpperCase().trim();

        // Check for valid values
        const validOptions = ['DENY', 'SAMEORIGIN'];
        const allowFromPattern = /^ALLOW-FROM\s+https?:\/\/.+/i;

        if (!validOptions.includes(optionsUpper) && !allowFromPattern.test(xFrameOptions)) {
            findings.push({
                type: 'Invalid X-Frame-Options Configuration',
                severity: 'medium',
                confidence: 0.90,
                value: `X-Frame-Options has invalid value: '${xFrameOptions}'`,
                file: url,
                context: {
                    before: 'X-Frame-Options validation',
                    after: `Invalid value '${xFrameOptions}' detected`
                },
                location: {
                    header: 'X-Frame-Options',
                    value: xFrameOptions
                },
                pattern: {
                    id: 'x-frame-options-invalid',
                    category: 'headers'
                },
                remediation: {
                    description: 'Use valid X-Frame-Options values: DENY, SAMEORIGIN, or ALLOW-FROM uri',
                    example: 'X-Frame-Options: DENY'
                }
            });
        } else if (optionsUpper === 'SAMEORIGIN') {
            // SAMEORIGIN is less secure than DENY
            findings.push({
                type: 'Permissive X-Frame-Options Configuration',
                severity: 'low',
                confidence: 0.70,
                value: 'X-Frame-Options set to SAMEORIGIN allows same-origin framing',
                file: url,
                context: {
                    before: 'X-Frame-Options security analysis',
                    after: 'SAMEORIGIN policy detected'
                },
                location: {
                    header: 'X-Frame-Options',
                    value: 'SAMEORIGIN'
                },
                pattern: {
                    id: 'x-frame-options-sameorigin',
                    category: 'headers'
                },
                remediation: {
                    description: 'Consider using DENY for maximum clickjacking protection if framing is not needed',
                    example: 'X-Frame-Options: DENY'
                }
            });
        }

        return findings;
    }

    /**
     * Analyze CORS (Cross-Origin Resource Sharing) configuration
     * @param {Object} headers - Normalized headers
     * @param {string} url - Target URL
     * @returns {Array} Array of CORS-related findings
     */
    analyzeCORS(headers, url) {
        const findings = [];
        const corsOrigin = headers['access-control-allow-origin'];
        const corsMethods = headers['access-control-allow-methods'];
        const corsHeaders = headers['access-control-allow-headers'];
        const corsCredentials = headers['access-control-allow-credentials'];

        // Analyze Access-Control-Allow-Origin
        if (corsOrigin) {
            const corsOriginFindings = this.validateCORSOrigin(corsOrigin, url);
            findings.push(...corsOriginFindings);
        }

        // Analyze Access-Control-Allow-Methods
        if (corsMethods) {
            const corsMethodsFindings = this.validateCORSMethods(corsMethods, url);
            findings.push(...corsMethodsFindings);
        }

        // Analyze dangerous combination of wildcard origin with credentials
        if (corsOrigin === '*' && corsCredentials && corsCredentials.toLowerCase() === 'true') {
            findings.push({
                type: 'Dangerous CORS Configuration',
                severity: 'high',
                confidence: 0.95,
                value: 'CORS allows wildcard origin (*) with credentials enabled',
                file: url,
                context: {
                    before: 'CORS credentials and origin analysis',
                    after: 'Wildcard origin with credentials detected'
                },
                location: {
                    header: 'Access-Control-Allow-Origin',
                    value: '*',
                    relatedHeader: 'Access-Control-Allow-Credentials'
                },
                pattern: {
                    id: 'cors-wildcard-with-credentials',
                    category: 'headers'
                },
                remediation: {
                    description: 'Remove wildcard origin when credentials are allowed, specify exact origins instead',
                    example: 'Access-Control-Allow-Origin: https://trusted-domain.com'
                }
            });
        }

        // Analyze overly permissive headers
        if (corsHeaders && corsHeaders.includes('*')) {
            findings.push({
                type: 'Permissive CORS Headers Configuration',
                severity: 'medium',
                confidence: 0.80,
                value: 'CORS allows all headers (*) which may expose sensitive data',
                file: url,
                context: {
                    before: 'CORS headers configuration analysis',
                    after: 'Wildcard headers detected'
                },
                location: {
                    header: 'Access-Control-Allow-Headers',
                    value: corsHeaders
                },
                pattern: {
                    id: 'cors-permissive-headers',
                    category: 'headers'
                },
                remediation: {
                    description: 'Specify only the headers that are actually needed instead of using wildcard',
                    example: 'Access-Control-Allow-Headers: Content-Type, Authorization'
                }
            });
        }

        return findings;
    }

    /**
     * Validate CORS Access-Control-Allow-Origin configuration
     * @param {string} corsOrigin - CORS origin header value
     * @param {string} url - Target URL
     * @returns {Array} Array of CORS origin findings
     */
    validateCORSOrigin(corsOrigin, url) {
        const findings = [];

        // Check for wildcard origin
        if (corsOrigin === '*') {
            findings.push({
                type: 'Overly Permissive CORS Origin',
                severity: 'medium',
                confidence: 0.85,
                value: 'CORS allows requests from any origin (*)',
                file: url,
                context: {
                    before: 'CORS origin policy analysis',
                    after: 'Wildcard origin detected'
                },
                location: {
                    header: 'Access-Control-Allow-Origin',
                    value: '*'
                },
                pattern: {
                    id: 'cors-wildcard-origin',
                    category: 'headers'
                },
                remediation: {
                    description: 'Specify trusted origins instead of using wildcard to prevent unauthorized cross-origin requests',
                    example: 'Access-Control-Allow-Origin: https://trusted-domain.com'
                }
            });
        }

        // Check for null origin (can be dangerous)
        if (corsOrigin === 'null') {
            findings.push({
                type: 'Dangerous CORS Null Origin',
                severity: 'high',
                confidence: 0.90,
                value: 'CORS allows null origin which can be exploited by attackers',
                file: url,
                context: {
                    before: 'CORS origin validation',
                    after: 'Null origin detected'
                },
                location: {
                    header: 'Access-Control-Allow-Origin',
                    value: 'null'
                },
                pattern: {
                    id: 'cors-null-origin',
                    category: 'headers'
                },
                remediation: {
                    description: 'Remove null origin support and specify trusted domains instead',
                    example: 'Access-Control-Allow-Origin: https://trusted-domain.com'
                }
            });
        }

        // Check for multiple origins (not standard compliant)
        if (corsOrigin.includes(',')) {
            findings.push({
                type: 'Invalid CORS Multiple Origins',
                severity: 'medium',
                confidence: 0.85,
                value: 'CORS header contains multiple origins, which is not standard compliant',
                file: url,
                context: {
                    before: 'CORS origin format validation',
                    after: 'Multiple origins detected in single header'
                },
                location: {
                    header: 'Access-Control-Allow-Origin',
                    value: corsOrigin
                },
                pattern: {
                    id: 'cors-multiple-origins',
                    category: 'headers'
                },
                remediation: {
                    description: 'Use server-side logic to dynamically set single origin based on request',
                    example: 'Dynamically set Access-Control-Allow-Origin based on Origin header validation'
                }
            });
        }

        return findings;
    }

    /**
     * Validate CORS Access-Control-Allow-Methods configuration
     * @param {string} corsMethods - CORS methods header value
     * @param {string} url - Target URL
     * @returns {Array} Array of CORS methods findings
     */
    validateCORSMethods(corsMethods, url) {
        const findings = [];
        const methodsUpper = corsMethods.toUpperCase();

        // Check for overly permissive methods
        const dangerousMethods = ['DELETE', 'PUT', 'PATCH'];
        const allowedDangerousMethods = dangerousMethods.filter(method => methodsUpper.includes(method));

        if (allowedDangerousMethods.length > 0) {
            findings.push({
                type: 'Permissive CORS Methods',
                severity: 'medium',
                confidence: 0.75,
                value: `CORS allows potentially dangerous methods: ${allowedDangerousMethods.join(', ')}`,
                file: url,
                context: {
                    before: 'CORS methods configuration analysis',
                    after: `Dangerous methods detected: ${allowedDangerousMethods.join(', ')}`
                },
                location: {
                    header: 'Access-Control-Allow-Methods',
                    value: corsMethods
                },
                pattern: {
                    id: 'cors-dangerous-methods',
                    category: 'headers'
                },
                remediation: {
                    description: 'Only allow necessary HTTP methods and ensure proper authentication for destructive operations',
                    example: 'Access-Control-Allow-Methods: GET, POST'
                }
            });
        }

        // Check for wildcard methods (not standard but some servers might support)
        if (methodsUpper.includes('*')) {
            findings.push({
                type: 'Wildcard CORS Methods',
                severity: 'high',
                confidence: 0.90,
                value: 'CORS allows all HTTP methods (*)',
                file: url,
                context: {
                    before: 'CORS methods wildcard analysis',
                    after: 'Wildcard methods detected'
                },
                location: {
                    header: 'Access-Control-Allow-Methods',
                    value: corsMethods
                },
                pattern: {
                    id: 'cors-wildcard-methods',
                    category: 'headers'
                },
                remediation: {
                    description: 'Specify only the HTTP methods that are actually needed',
                    example: 'Access-Control-Allow-Methods: GET, POST, PUT'
                }
            });
        }

        return findings;
    }
}

module.exports = new HeaderAnalyzer();