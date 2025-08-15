/**
 * Unit tests for OWASP Checker
 * Tests A01: Broken Access Control, A02: Cryptographic Failures, A03: Injection checks
 */

const owaspChecker = require('../services/owaspChecker');
const axios = require('axios');

// Mock axios for HTTP requests
jest.mock('axios');
const mockedAxios = axios;

describe('OWASP Checker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('A01: Broken Access Control', () => {
        describe('checkExposedAdminInterfaces', () => {
            it('should detect accessible admin interface with admin content', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 200,
                    data: '<html><title>Admin Login</title><form><input name="username"><input name="password"></form></html>'
                });

                const findings = await owaspChecker.checkExposedAdminInterfaces('https://example.com');

                expect(findings).toHaveLength(1);
                expect(findings[0]).toMatchObject({
                    type: 'OWASP A01: Exposed Admin Interface',
                    severity: 'high',
                    confidence: 0.8,
                    value: 'https://example.com/admin',
                    pattern: {
                        id: 'exposed-admin-interface',
                        category: 'owasp-a01'
                    }
                });
            });

            it('should detect admin interface with redirect (302)', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 302,
                    data: '<html><title>Admin Dashboard</title></html>'
                });

                const findings = await owaspChecker.checkExposedAdminInterfaces('https://example.com');

                expect(findings).toHaveLength(1);
                expect(findings[0].type).toBe('OWASP A01: Exposed Admin Interface');
            });

            it('should not detect admin interface for 404 responses', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 404,
                    data: 'Not Found'
                });

                const findings = await owaspChecker.checkExposedAdminInterfaces('https://example.com');

                expect(findings).toHaveLength(0);
            });

            it('should not detect admin interface for non-admin content', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 200,
                    data: '<html><title>Regular Page</title><p>Welcome to our website</p></html>'
                });

                const findings = await owaspChecker.checkExposedAdminInterfaces('https://example.com');

                expect(findings).toHaveLength(0);
            });

            it('should handle network errors gracefully', async () => {
                mockedAxios.get.mockRejectedValue(new Error('Network error'));

                const findings = await owaspChecker.checkExposedAdminInterfaces('https://example.com');

                expect(findings).toHaveLength(0);
            });

            it('should test multiple admin paths', async () => {
                // Mock responses for different admin paths
                mockedAxios.get
                    .mockResolvedValueOnce({ status: 404, data: 'Not Found' }) // /admin
                    .mockResolvedValueOnce({ status: 200, data: '<title>Admin Login</title>' }) // /admin/
                    .mockResolvedValueOnce({ status: 200, data: '<form>username password</form>' }); // /admin/login

                const findings = await owaspChecker.checkExposedAdminInterfaces('https://example.com');

                expect(findings.length).toBeGreaterThan(0);
                expect(mockedAxios.get).toHaveBeenCalledTimes(owaspChecker.adminPaths.length);
            });
        });

        describe('checkUnrestrictedFileAccess', () => {
            it('should detect accessible sensitive files', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 200,
                    data: 'DB_PASSWORD=secret123\nAPI_KEY=abc123'
                });

                const findings = await owaspChecker.checkUnrestrictedFileAccess('https://example.com');

                expect(findings).toHaveLength(1);
                expect(findings[0]).toMatchObject({
                    type: 'OWASP A01: Unrestricted File Access',
                    severity: 'critical',
                    confidence: 0.9,
                    pattern: {
                        id: 'unrestricted-file-access',
                        category: 'owasp-a01'
                    }
                });
            });

            it('should not detect files that return 404', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 404,
                    data: 'Not Found'
                });

                const findings = await owaspChecker.checkUnrestrictedFileAccess('https://example.com');

                expect(findings).toHaveLength(0);
            });

            it('should not detect files with empty content', async () => {
                mockedAxios.get.mockResolvedValueOnce({
                    status: 200,
                    data: ''
                });

                const findings = await owaspChecker.checkUnrestrictedFileAccess('https://example.com');

                expect(findings).toHaveLength(0);
            });

            it('should handle network timeouts gracefully', async () => {
                mockedAxios.get.mockRejectedValue(new Error('timeout'));

                const findings = await owaspChecker.checkUnrestrictedFileAccess('https://example.com');

                expect(findings).toHaveLength(0);
            });
        });

        describe('checkDirectoryTraversalPatterns', () => {
            it('should detect directory traversal patterns', () => {
                const content = `
                    const filePath = '../../../etc/passwd';
                    include('../config/database.php');
                    require('../../secrets.json');
                `;

                const findings = owaspChecker.checkDirectoryTraversalPatterns('https://example.com', content);

                expect(findings.length).toBeGreaterThan(0);
                expect(findings[0]).toMatchObject({
                    type: 'OWASP A01: Directory Traversal Pattern',
                    severity: 'high',
                    confidence: 0.7,
                    pattern: {
                        id: 'directory-traversal',
                        category: 'owasp-a01'
                    }
                });
            });

            it('should detect URL-encoded traversal patterns', () => {
                const content = 'const path = "..%2f..%2fetc%2fpasswd";';

                const findings = owaspChecker.checkDirectoryTraversalPatterns('https://example.com', content);

                expect(findings.length).toBeGreaterThan(0);
                expect(findings[0].value).toContain('%2f');
            });

            it('should not detect false positives in legitimate paths', () => {
                const content = `
                    const normalPath = './src/components/Button.js';
                    import React from 'react';
                    const relativePath = 'assets/images/logo.png';
                `;

                const findings = owaspChecker.checkDirectoryTraversalPatterns('https://example.com', content);

                expect(findings).toHaveLength(0);
            });

            it('should provide proper context for findings', () => {
                const content = 'const maliciousPath = "../../../etc/passwd"; // This is bad';

                const findings = owaspChecker.checkDirectoryTraversalPatterns('https://example.com', content);

                expect(findings[0].context.before).toContain('maliciousPath');
                expect(findings[0].context.after).toContain('This is bad');
            });
        });
    });

    describe('A02: Cryptographic Failures', () => {
        describe('checkCryptographicFailures', () => {
            it('should detect weak encryption algorithms', async () => {
                const content = `
                    const hash = crypto.createHash('md5');
                    const cipher = crypto.createCipher('des', key);
                    const ssl = require('ssl v1.0');
                `;

                const findings = await owaspChecker.checkCryptographicFailures('https://example.com', content);

                expect(findings.length).toBeGreaterThan(0);
                const weakAlgoFinding = findings.find(f => f.type.includes('Weak Encryption'));
                expect(weakAlgoFinding).toBeDefined();
                expect(weakAlgoFinding.severity).toBe('high');
            });

            it('should detect hardcoded cryptographic keys', async () => {
                const content = `
                    const crypto_key = "abcdef1234567890abcdef1234567890";
                    const encryption_key = "mySecretKey123456789";
                `;

                const findings = await owaspChecker.checkCryptographicFailures('https://example.com', content);

                const hardcodedKeyFinding = findings.find(f => f.type.includes('Hardcoded Cryptographic Key'));
                expect(hardcodedKeyFinding).toBeDefined();
                expect(hardcodedKeyFinding.severity).toBe('critical');
            });

            it('should detect insecure random number generation', async () => {
                const content = `
                    const randomValue = Math.random();
                    const token = Math.random().toString(36);
                `;

                const findings = await owaspChecker.checkCryptographicFailures('https://example.com', content);

                const insecureRandomFinding = findings.find(f => f.type.includes('Insecure Random'));
                expect(insecureRandomFinding).toBeDefined();
                expect(insecureRandomFinding.severity).toBe('medium');
            });

            it('should return empty array for secure cryptographic code', async () => {
                const content = `
                    const hash = crypto.createHash('sha256');
                    const cipher = crypto.createCipher('aes-256-gcm', key);
                    const randomBytes = crypto.randomBytes(32);
                `;

                const findings = await owaspChecker.checkCryptographicFailures('https://example.com', content);

                expect(findings).toHaveLength(0);
            });

            it('should provide appropriate remediation guidance', async () => {
                const content = 'const hash = crypto.createHash("md5");';

                const findings = await owaspChecker.checkCryptographicFailures('https://example.com', content);

                expect(findings[0].remediation).toContain('AES-256');
                expect(findings[0].remediation).toContain('SHA-256');
            });
        });
    });

    describe('A03: Injection Vulnerabilities', () => {
        describe('checkInjectionVulnerabilities', () => {
            it('should detect SQL injection in JavaScript', async () => {
                const content = `
                    const query = "SELECT * FROM users WHERE id = " + userId;
                    db.execute("SELECT * FROM products WHERE name = '" + productName + "'");
                `;

                const findings = await owaspChecker.checkInjectionVulnerabilities('https://example.com', content);

                expect(findings.length).toBeGreaterThan(0);
                const sqlInjectionFinding = findings.find(f => f.type.includes('SQL Injection in JavaScript'));
                expect(sqlInjectionFinding).toBeDefined();
                expect(sqlInjectionFinding.severity).toBe('critical');
            });

            it('should detect SQL error patterns', async () => {
                const content = `
                    Error: mysql_fetch_array() expects parameter 1 to be resource
                    ORA-00942: table or view does not exist
                    Microsoft OLE DB Provider for ODBC Drivers error
                `;

                const findings = await owaspChecker.checkInjectionVulnerabilities('https://example.com', content);

                const errorPatternFindings = findings.filter(f => f.type.includes('SQL Injection Error'));
                expect(errorPatternFindings.length).toBeGreaterThan(0);
                expect(errorPatternFindings[0].severity).toBe('high');
            });

            it('should detect NoSQL injection patterns', async () => {
                const content = `
                    const query = { $where: userInput };
                    db.find({ $ne: null, $gt: value });
                `;

                const findings = await owaspChecker.checkInjectionVulnerabilities('https://example.com', content);

                const nosqlFinding = findings.find(f => f.type.includes('NoSQL Injection'));
                expect(nosqlFinding).toBeDefined();
                expect(nosqlFinding.severity).toBe('high');
            });

            it('should detect command injection patterns', async () => {
                const content = `
                    exec("ls -la " + userInput);
                    system("rm -rf " + fileName);
                    eval("console.log('" + userCode + "')");
                `;

                const findings = await owaspChecker.checkInjectionVulnerabilities('https://example.com', content);

                const commandInjectionFindings = findings.filter(f => f.type.includes('Command Injection'));
                expect(commandInjectionFindings.length).toBeGreaterThan(0);
                expect(commandInjectionFindings[0].severity).toBe('critical');
            });

            it('should not detect false positives in safe code', async () => {
                const content = `
                    const query = "SELECT * FROM users WHERE id = ?";
                    db.prepare(query).run(userId);
                    const safeQuery = db.prepare("SELECT * FROM products WHERE category = ?");
                `;

                const findings = await owaspChecker.checkInjectionVulnerabilities('https://example.com', content);

                expect(findings).toHaveLength(0);
            });

            it('should provide appropriate remediation guidance', async () => {
                const content = 'db.query("SELECT * FROM users WHERE id = " + id);';

                const findings = await owaspChecker.checkInjectionVulnerabilities('https://example.com', content);

                expect(findings.length).toBeGreaterThan(0);
                expect(findings[0].remediation).toContain('parameterized queries');
                expect(findings[0].remediation).toContain('prepared statements');
            });
        });
    });

    describe('Full OWASP Scan Integration', () => {
        it('should perform complete OWASP scan with all checks', async () => {
            const target = { value: 'https://example.com' };
            const content = `
                const adminPath = '/admin/login';
                const hash = crypto.createHash('md5');
                db.query("SELECT * FROM users WHERE id = " + userId);
            `;

            // Mock HTTP requests for admin interface checks
            mockedAxios.get.mockResolvedValue({
                status: 200,
                data: '<title>Admin Panel</title><form>login</form>'
            });

            const findings = await owaspChecker.scan(target, { content });

            expect(findings.length).toBeGreaterThan(0);

            // Should have findings from all three categories
            const categories = [...new Set(findings.map(f => f.pattern.category))];
            expect(categories).toContain('owasp-a01');
            expect(categories).toContain('owasp-a02');
            expect(categories).toContain('owasp-a03');
        });

        it('should handle progress callbacks', async () => {
            const target = { value: 'https://example.com' };
            const progressCallback = jest.fn();

            mockedAxios.get.mockResolvedValue({ status: 404, data: 'Not Found' });

            await owaspChecker.scan(target, { onProgress: progressCallback });

            expect(progressCallback).toHaveBeenCalledWith(10);
            expect(progressCallback).toHaveBeenCalledWith(40);
            expect(progressCallback).toHaveBeenCalledWith(70);
            expect(progressCallback).toHaveBeenCalledWith(100);
        });

        it('should handle scan errors gracefully', async () => {
            const target = { value: 'invalid-url' };

            const findings = await owaspChecker.scan(target);

            expect(findings).toEqual([]);
        });
    });

    describe('OWASP Compliance Reporting', () => {
        it('should generate compliance report with categorized findings', () => {
            const findings = [
                {
                    type: 'OWASP A01: Exposed Admin Interface',
                    severity: 'high',
                    pattern: { category: 'owasp-a01' }
                },
                {
                    type: 'OWASP A02: Weak Encryption',
                    severity: 'critical',
                    pattern: { category: 'owasp-a02' }
                },
                {
                    type: 'OWASP A03: SQL Injection',
                    severity: 'high',
                    pattern: { category: 'owasp-a03' }
                }
            ];

            const report = owaspChecker.generateComplianceReport(findings);

            expect(report.categories.A01.findings).toHaveLength(1);
            expect(report.categories.A02.findings).toHaveLength(1);
            expect(report.categories.A03.findings).toHaveLength(1);
            expect(report.complianceScore).toBe(0); // All categories have findings
            expect(report.totalFindings).toBe(3);
        });

        it('should calculate correct compliance score', () => {
            const findings = [
                {
                    type: 'OWASP A01: Exposed Admin Interface',
                    severity: 'high',
                    pattern: { category: 'owasp-a01' }
                }
            ];

            const report = owaspChecker.generateComplianceReport(findings);

            expect(report.complianceScore).toBe(67); // 2 out of 3 categories passed
        });

        it('should handle empty findings correctly', () => {
            const report = owaspChecker.generateComplianceReport([]);

            expect(report.complianceScore).toBe(100);
            expect(report.totalFindings).toBe(0);
            Object.values(report.categories).forEach(category => {
                expect(category.findings).toHaveLength(0);
                expect(category.severity).toBe('low');
            });
        });
    });
});