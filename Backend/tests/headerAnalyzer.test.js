/**
 * Header Analyzer Tests
 * Tests for HTTP security header analysis functionality
 */

const headerAnalyzer = require('../services/headerAnalyzer');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('HeaderAnalyzer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('scan method', () => {
        it('should analyze headers using HEAD request', async () => {
            const mockHeaders = {
                'content-security-policy': "default-src 'self'",
                'strict-transport-security': 'max-age=31536000; includeSubDomains'
            };

            mockedAxios.head.mockResolvedValue({
                headers: mockHeaders
            });

            const target = { value: 'https://example.com' };
            const results = await headerAnalyzer.scan(target);

            expect(mockedAxios.head).toHaveBeenCalledWith('https://example.com', {
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/2.0; +https://threatpeek.com)'
                }
            });

            expect(Array.isArray(results)).toBe(true);
        });

        it('should fallback to GET request if HEAD fails', async () => {
            const mockHeaders = {
                'content-security-policy': "default-src 'self'"
            };

            mockedAxios.head.mockRejectedValue(new Error('HEAD not allowed'));
            mockedAxios.get.mockResolvedValue({
                headers: mockHeaders
            });

            const target = { value: 'https://example.com' };
            const results = await headerAnalyzer.scan(target);

            expect(mockedAxios.head).toHaveBeenCalled();
            expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com', {
                timeout: 15000,
                maxRedirects: 5,
                maxContentLength: 1024,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/2.0; +https://threatpeek.com)'
                }
            });

            expect(Array.isArray(results)).toBe(true);
        });

        it('should call progress callback if provided', async () => {
            const mockHeaders = {};
            mockedAxios.head.mockResolvedValue({ headers: mockHeaders });

            const progressCallback = jest.fn();
            const target = { value: 'https://example.com' };

            await headerAnalyzer.scan(target, { onProgress: progressCallback });

            expect(progressCallback).toHaveBeenCalledWith(20);
            expect(progressCallback).toHaveBeenCalledWith(50);
            expect(progressCallback).toHaveBeenCalledWith(100);
        });

        it('should throw error if request fails completely', async () => {
            mockedAxios.head.mockRejectedValue(new Error('Network error'));
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            const target = { value: 'https://example.com' };

            await expect(headerAnalyzer.scan(target)).rejects.toThrow('Network error');
        });
    });

    describe('normalizeHeaders method', () => {
        it('should convert header names to lowercase', () => {
            const headers = {
                'Content-Security-Policy': "default-src 'self'",
                'STRICT-TRANSPORT-SECURITY': 'max-age=31536000',
                'X-Frame-Options': 'DENY'
            };

            const normalized = headerAnalyzer.normalizeHeaders(headers);

            expect(normalized).toEqual({
                'content-security-policy': "default-src 'self'",
                'strict-transport-security': 'max-age=31536000',
                'x-frame-options': 'DENY'
            });
        });
    });

    describe('analyzeCSP method', () => {
        it('should detect missing CSP header', () => {
            const headers = {};
            const findings = headerAnalyzer.analyzeCSP(headers, 'https://example.com');

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({
                type: 'Missing Content Security Policy',
                severity: 'high',
                confidence: 0.95,
                pattern: {
                    id: 'missing-csp-header',
                    category: 'headers'
                }
            });
        });

        it('should validate CSP configuration when present', () => {
            const headers = {
                'content-security-policy': "default-src 'self'; script-src 'unsafe-eval'"
            };
            const findings = headerAnalyzer.analyzeCSP(headers, 'https://example.com');

            // Should find unsafe-eval issue
            const unsafeEvalFinding = findings.find(f => f.pattern.id === 'csp-unsafe-eval');
            expect(unsafeEvalFinding).toBeDefined();
            expect(unsafeEvalFinding.severity).toBe('medium');
        });

        it('should detect wildcard in script-src', () => {
            const headers = {
                'content-security-policy': "default-src 'self'; script-src *"
            };
            const findings = headerAnalyzer.analyzeCSP(headers, 'https://example.com');

            const wildcardFinding = findings.find(f => f.pattern.id === 'csp-script-wildcard');
            expect(wildcardFinding).toBeDefined();
            expect(wildcardFinding.severity).toBe('high');
        });

        it('should detect missing object-src directive', () => {
            const headers = {
                'content-security-policy': "default-src 'self'; script-src 'self'"
            };
            const findings = headerAnalyzer.analyzeCSP(headers, 'https://example.com');

            const objectSrcFinding = findings.find(f => f.pattern.id === 'csp-missing-object-src');
            expect(objectSrcFinding).toBeDefined();
            expect(objectSrcFinding.severity).toBe('medium');
        });
    });

    describe('analyzeHSTS method', () => {
        it('should detect missing HSTS on HTTPS site', () => {
            const headers = {};
            const findings = headerAnalyzer.analyzeHSTS(headers, 'https://example.com');

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({
                type: 'Missing HSTS Header',
                severity: 'medium',
                confidence: 0.90,
                pattern: {
                    id: 'missing-hsts-header',
                    category: 'headers'
                }
            });
        });

        it('should not flag missing HSTS on HTTP site', () => {
            const headers = {};
            const findings = headerAnalyzer.analyzeHSTS(headers, 'http://example.com');

            expect(findings).toHaveLength(0);
        });

        it('should validate HSTS configuration when present', () => {
            const headers = {
                'strict-transport-security': 'max-age=3600'
            };
            const findings = headerAnalyzer.analyzeHSTS(headers, 'https://example.com');

            // Should find short max-age issue
            const shortMaxAgeFinding = findings.find(f => f.pattern.id === 'hsts-short-max-age');
            expect(shortMaxAgeFinding).toBeDefined();
            expect(shortMaxAgeFinding.severity).toBe('low');
        });

        it('should detect missing max-age directive', () => {
            const headers = {
                'strict-transport-security': 'includeSubDomains'
            };
            const findings = headerAnalyzer.analyzeHSTS(headers, 'https://example.com');

            const missingMaxAgeFinding = findings.find(f => f.pattern.id === 'hsts-missing-max-age');
            expect(missingMaxAgeFinding).toBeDefined();
            expect(missingMaxAgeFinding.severity).toBe('medium');
        });

        it('should detect missing includeSubDomains', () => {
            const headers = {
                'strict-transport-security': 'max-age=31536000'
            };
            const findings = headerAnalyzer.analyzeHSTS(headers, 'https://example.com');

            const missingSubdomainsFinding = findings.find(f => f.pattern.id === 'hsts-missing-subdomains');
            expect(missingSubdomainsFinding).toBeDefined();
            expect(missingSubdomainsFinding.severity).toBe('low');
        });

        it('should not flag properly configured HSTS', () => {
            const headers = {
                'strict-transport-security': 'max-age=31536000; includeSubDomains'
            };
            const findings = headerAnalyzer.analyzeHSTS(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });
    });

    describe('validateCSPConfiguration method', () => {
        it('should handle complex CSP policies', () => {
            const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://trusted.com; object-src 'none'";
            const findings = headerAnalyzer.validateCSPConfiguration(csp, 'https://example.com');

            // Should not flag missing object-src since it's present
            const objectSrcFinding = findings.find(f => f.pattern.id === 'csp-missing-object-src');
            expect(objectSrcFinding).toBeUndefined();
        });

        it('should be case insensitive', () => {
            const csp = "DEFAULT-SRC 'SELF'; SCRIPT-SRC 'UNSAFE-EVAL'";
            const findings = headerAnalyzer.validateCSPConfiguration(csp, 'https://example.com');

            const unsafeEvalFinding = findings.find(f => f.pattern.id === 'csp-unsafe-eval');
            expect(unsafeEvalFinding).toBeDefined();
        });
    });

    describe('validateHSTSConfiguration method', () => {
        it('should handle various max-age formats', () => {
            const testCases = [
                { hsts: 'max-age=31536000', expectedFindings: 1 }, // missing includeSubDomains
                { hsts: 'max-age=31536000; includeSubDomains', expectedFindings: 0 }, // perfect
                { hsts: 'includeSubDomains; max-age=31536000', expectedFindings: 0 }, // order doesn't matter
                { hsts: 'max-age=3600; includeSubDomains', expectedFindings: 1 } // short max-age
            ];

            testCases.forEach(({ hsts, expectedFindings }) => {
                const findings = headerAnalyzer.validateHSTSConfiguration(hsts, 'https://example.com');
                expect(findings).toHaveLength(expectedFindings);
            });
        });

        it('should be case insensitive', () => {
            const hsts = 'MAX-AGE=31536000; INCLUDESUBDOMAINS';
            const findings = headerAnalyzer.validateHSTSConfiguration(hsts, 'https://example.com');

            expect(findings).toHaveLength(0);
        });
    });

    describe('analyzeXXSSProtection method', () => {
        it('should detect missing X-XSS-Protection header', () => {
            const headers = {};
            const findings = headerAnalyzer.analyzeXXSSProtection(headers, 'https://example.com');

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({
                type: 'Missing X-XSS-Protection Header',
                severity: 'medium',
                confidence: 0.85,
                pattern: {
                    id: 'missing-xss-protection-header',
                    category: 'headers'
                }
            });
        });

        it('should detect disabled XSS protection', () => {
            const headers = {
                'x-xss-protection': '0'
            };
            const findings = headerAnalyzer.analyzeXXSSProtection(headers, 'https://example.com');

            const disabledFinding = findings.find(f => f.pattern.id === 'xss-protection-disabled');
            expect(disabledFinding).toBeDefined();
            expect(disabledFinding.severity).toBe('medium');
        });

        it('should detect weak XSS protection configuration', () => {
            const headers = {
                'x-xss-protection': '1'
            };
            const findings = headerAnalyzer.analyzeXXSSProtection(headers, 'https://example.com');

            const weakFinding = findings.find(f => f.pattern.id === 'xss-protection-weak-mode');
            expect(weakFinding).toBeDefined();
            expect(weakFinding.severity).toBe('low');
        });

        it('should not flag properly configured XSS protection', () => {
            const headers = {
                'x-xss-protection': '1; mode=block'
            };
            const findings = headerAnalyzer.analyzeXXSSProtection(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });
    });

    describe('analyzeReferrerPolicy method', () => {
        it('should detect missing Referrer-Policy header', () => {
            const headers = {};
            const findings = headerAnalyzer.analyzeReferrerPolicy(headers, 'https://example.com');

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({
                type: 'Missing Referrer-Policy Header',
                severity: 'low',
                confidence: 0.80,
                pattern: {
                    id: 'missing-referrer-policy-header',
                    category: 'headers'
                }
            });
        });

        it('should detect permissive referrer policies', () => {
            const testCases = ['unsafe-url', 'no-referrer-when-downgrade'];

            testCases.forEach(policy => {
                const headers = {
                    'referrer-policy': policy
                };
                const findings = headerAnalyzer.analyzeReferrerPolicy(headers, 'https://example.com');

                const permissiveFinding = findings.find(f => f.pattern.id === 'referrer-policy-permissive');
                expect(permissiveFinding).toBeDefined();
                expect(permissiveFinding.severity).toBe('low');
            });
        });

        it('should not flag secure referrer policies', () => {
            const securePolicy = 'strict-origin-when-cross-origin';
            const headers = {
                'referrer-policy': securePolicy
            };
            const findings = headerAnalyzer.analyzeReferrerPolicy(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });
    });

    describe('analyzeXFrameOptions method', () => {
        it('should detect missing X-Frame-Options header', () => {
            const headers = {};
            const findings = headerAnalyzer.analyzeXFrameOptions(headers, 'https://example.com');

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({
                type: 'Missing X-Frame-Options Header',
                severity: 'medium',
                confidence: 0.85,
                pattern: {
                    id: 'missing-x-frame-options-header',
                    category: 'headers'
                }
            });
        });

        it('should detect invalid X-Frame-Options values', () => {
            const headers = {
                'x-frame-options': 'INVALID_VALUE'
            };
            const findings = headerAnalyzer.analyzeXFrameOptions(headers, 'https://example.com');

            const invalidFinding = findings.find(f => f.pattern.id === 'x-frame-options-invalid');
            expect(invalidFinding).toBeDefined();
            expect(invalidFinding.severity).toBe('medium');
        });

        it('should detect permissive SAMEORIGIN configuration', () => {
            const headers = {
                'x-frame-options': 'SAMEORIGIN'
            };
            const findings = headerAnalyzer.analyzeXFrameOptions(headers, 'https://example.com');

            const sameoriginFinding = findings.find(f => f.pattern.id === 'x-frame-options-sameorigin');
            expect(sameoriginFinding).toBeDefined();
            expect(sameoriginFinding.severity).toBe('low');
        });

        it('should not flag DENY configuration', () => {
            const headers = {
                'x-frame-options': 'DENY'
            };
            const findings = headerAnalyzer.analyzeXFrameOptions(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });

        it('should accept valid ALLOW-FROM configuration', () => {
            const headers = {
                'x-frame-options': 'ALLOW-FROM https://trusted.com'
            };
            const findings = headerAnalyzer.analyzeXFrameOptions(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });

        it('should be case insensitive', () => {
            const headers = {
                'x-frame-options': 'deny'
            };
            const findings = headerAnalyzer.analyzeXFrameOptions(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });
    });

    describe('validateXXSSProtectionConfiguration method', () => {
        it('should handle various XSS protection configurations', () => {
            const testCases = [
                { value: '0', expectedFindings: 1 }, // disabled
                { value: '1', expectedFindings: 1 }, // weak mode
                { value: '1; mode=block', expectedFindings: 0 }, // proper
                { value: '1; MODE=BLOCK', expectedFindings: 0 } // case insensitive
            ];

            testCases.forEach(({ value, expectedFindings }) => {
                const findings = headerAnalyzer.validateXXSSProtectionConfiguration(value, 'https://example.com');
                expect(findings).toHaveLength(expectedFindings);
            });
        });
    });

    describe('validateReferrerPolicyConfiguration method', () => {
        it('should handle various referrer policy configurations', () => {
            const testCases = [
                { policy: 'unsafe-url', expectedFindings: 1 },
                { policy: 'no-referrer-when-downgrade', expectedFindings: 1 },
                { policy: 'strict-origin-when-cross-origin', expectedFindings: 0 },
                { policy: 'no-referrer', expectedFindings: 0 },
                { policy: 'same-origin', expectedFindings: 0 }
            ];

            testCases.forEach(({ policy, expectedFindings }) => {
                const findings = headerAnalyzer.validateReferrerPolicyConfiguration(policy, 'https://example.com');
                expect(findings).toHaveLength(expectedFindings);
            });
        });
    });

    describe('validateXFrameOptionsConfiguration method', () => {
        it('should handle various X-Frame-Options configurations', () => {
            const testCases = [
                { value: 'DENY', expectedFindings: 0 },
                { value: 'SAMEORIGIN', expectedFindings: 1 }, // permissive warning
                { value: 'ALLOW-FROM https://example.com', expectedFindings: 0 },
                { value: 'INVALID', expectedFindings: 1 }, // invalid
                { value: 'deny', expectedFindings: 0 } // case insensitive
            ];

            testCases.forEach(({ value, expectedFindings }) => {
                const findings = headerAnalyzer.validateXFrameOptionsConfiguration(value, 'https://example.com');
                expect(findings).toHaveLength(expectedFindings);
            });
        });
    });

    describe('analyzeCORS method', () => {
        it('should detect wildcard CORS origin', () => {
            const headers = {
                'access-control-allow-origin': '*'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const wildcardFinding = findings.find(f => f.pattern.id === 'cors-wildcard-origin');
            expect(wildcardFinding).toBeDefined();
            expect(wildcardFinding.severity).toBe('medium');
        });

        it('should detect dangerous CORS configuration with wildcard and credentials', () => {
            const headers = {
                'access-control-allow-origin': '*',
                'access-control-allow-credentials': 'true'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const dangerousFinding = findings.find(f => f.pattern.id === 'cors-wildcard-with-credentials');
            expect(dangerousFinding).toBeDefined();
            expect(dangerousFinding.severity).toBe('high');
        });

        it('should detect null origin vulnerability', () => {
            const headers = {
                'access-control-allow-origin': 'null'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const nullOriginFinding = findings.find(f => f.pattern.id === 'cors-null-origin');
            expect(nullOriginFinding).toBeDefined();
            expect(nullOriginFinding.severity).toBe('high');
        });

        it('should detect permissive CORS methods', () => {
            const headers = {
                'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const dangerousMethodsFinding = findings.find(f => f.pattern.id === 'cors-dangerous-methods');
            expect(dangerousMethodsFinding).toBeDefined();
            expect(dangerousMethodsFinding.severity).toBe('medium');
        });

        it('should detect wildcard CORS methods', () => {
            const headers = {
                'access-control-allow-methods': '*'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const wildcardMethodsFinding = findings.find(f => f.pattern.id === 'cors-wildcard-methods');
            expect(wildcardMethodsFinding).toBeDefined();
            expect(wildcardMethodsFinding.severity).toBe('high');
        });

        it('should detect permissive CORS headers', () => {
            const headers = {
                'access-control-allow-headers': '*'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const permissiveHeadersFinding = findings.find(f => f.pattern.id === 'cors-permissive-headers');
            expect(permissiveHeadersFinding).toBeDefined();
            expect(permissiveHeadersFinding.severity).toBe('medium');
        });

        it('should detect multiple origins in single header', () => {
            const headers = {
                'access-control-allow-origin': 'https://example.com, https://test.com'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            const multipleOriginsFinding = findings.find(f => f.pattern.id === 'cors-multiple-origins');
            expect(multipleOriginsFinding).toBeDefined();
            expect(multipleOriginsFinding.severity).toBe('medium');
        });

        it('should not flag secure CORS configurations', () => {
            const headers = {
                'access-control-allow-origin': 'https://trusted-domain.com',
                'access-control-allow-methods': 'GET, POST',
                'access-control-allow-headers': 'Content-Type, Authorization',
                'access-control-allow-credentials': 'true'
            };
            const findings = headerAnalyzer.analyzeCORS(headers, 'https://example.com');

            expect(findings).toHaveLength(0);
        });
    });

    describe('validateCORSOrigin method', () => {
        it('should handle various CORS origin configurations', () => {
            const testCases = [
                { origin: '*', expectedFindings: 1 }, // wildcard
                { origin: 'null', expectedFindings: 1 }, // null origin
                { origin: 'https://example.com, https://test.com', expectedFindings: 1 }, // multiple origins
                { origin: 'https://trusted-domain.com', expectedFindings: 0 } // secure
            ];

            testCases.forEach(({ origin, expectedFindings }) => {
                const findings = headerAnalyzer.validateCORSOrigin(origin, 'https://example.com');
                expect(findings).toHaveLength(expectedFindings);
            });
        });
    });

    describe('validateCORSMethods method', () => {
        it('should handle various CORS methods configurations', () => {
            const testCases = [
                { methods: 'GET, POST', expectedFindings: 0 }, // safe methods
                { methods: 'GET, POST, DELETE', expectedFindings: 1 }, // dangerous methods
                { methods: 'GET, POST, PUT, PATCH, DELETE', expectedFindings: 1 }, // multiple dangerous
                { methods: '*', expectedFindings: 1 }, // wildcard
                { methods: 'get, post, delete', expectedFindings: 1 } // case insensitive
            ];

            testCases.forEach(({ methods, expectedFindings }) => {
                const findings = headerAnalyzer.validateCORSMethods(methods, 'https://example.com');
                expect(findings).toHaveLength(expectedFindings);
            });
        });
    });
});