/**
 * Output Formatters Tests - Multiple export format support
 * Tests JSON, CSV, and SARIF output formats with proper transformation
 */

const { OutputFormatters } = require('../services/outputFormatters');

describe('OutputFormatters', () => {
    let outputFormatters;
    let mockScanResults;

    beforeEach(() => {
        outputFormatters = new OutputFormatters();

        // Mock scan results for testing
        mockScanResults = {
            scanId: 'test-scan-123',
            target: {
                type: 'url',
                value: 'https://example.com'
            },
            status: 'completed',
            startTime: '2024-01-01T10:00:00Z',
            endTime: '2024-01-01T10:05:00Z',
            duration: 300000,
            results: {
                categories: [
                    {
                        category: 'secrets',
                        scanType: 'url',
                        findings: [
                            {
                                id: 'secret-1',
                                type: 'api_key',
                                severity: 'critical',
                                confidence: 0.9,
                                title: 'Exposed API Key',
                                description: 'AWS API key found in JavaScript',
                                value: 'AKIA1234567890ABCDEF',
                                file: '/js/config.js',
                                line: 15,
                                location: { line: 15, column: 20, file: '/js/config.js' },
                                context: { before: 'const apiKey = "', after: '";' }
                            },
                            {
                                id: 'secret-2',
                                type: 'database_url',
                                severity: 'high',
                                confidence: 0.7,
                                title: 'Database Connection String',
                                description: 'Database URL exposed in configuration',
                                value: 'mongodb://user:pass@localhost:27017/db',
                                file: '/config/database.js',
                                line: 8,
                                location: { line: 8, column: 15, file: '/config/database.js' },
                                context: { before: 'dbUrl: "', after: '"' }
                            }
                        ],
                        summary: {
                            totalFindings: 2,
                            criticalCount: 1,
                            highCount: 1,
                            mediumCount: 0,
                            lowCount: 0
                        }
                    },
                    {
                        category: 'files',
                        scanType: 'files',
                        findings: [
                            {
                                id: 'file-1',
                                type: 'exposed_config',
                                severity: 'medium',
                                confidence: 0.8,
                                title: 'Exposed Configuration File',
                                description: '.env file accessible via HTTP',
                                file: '/.env',
                                location: { file: '/.env' },
                                context: { url: 'https://example.com/.env' }
                            }
                        ],
                        summary: {
                            totalFindings: 1,
                            criticalCount: 0,
                            highCount: 0,
                            mediumCount: 1,
                            lowCount: 0
                        }
                    }
                ],
                summary: {
                    totalFindings: 3,
                    criticalCount: 1,
                    highCount: 1,
                    mediumCount: 1,
                    lowCount: 0
                }
            }
        };
    });

    describe('formatOutput', () => {
        test('should format JSON output correctly', () => {
            const result = outputFormatters.formatOutput(mockScanResults, 'json');

            expect(result.contentType).toBe('application/json');
            expect(result.filename).toBe('scan-test-scan-123.json');
            expect(result.size).toBeGreaterThan(0);

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.scanId).toBe('test-scan-123');
            expect(parsedContent.formatMetadata).toBeDefined();
            expect(parsedContent.formatMetadata.format).toBe('json');
        });

        test('should format CSV output correctly', () => {
            const result = outputFormatters.formatOutput(mockScanResults, 'csv');

            expect(result.contentType).toBe('text/csv');
            expect(result.filename).toBe('scan-test-scan-123.csv');
            expect(result.recordCount).toBe(3);

            const lines = result.content.split('\n');
            expect(lines[0]).toContain('Scan ID,Target,Category');
            expect(lines[1]).toContain('test-scan-123,https://example.com,secrets');
        });

        test('should format SARIF output correctly', () => {
            const result = outputFormatters.formatOutput(mockScanResults, 'sarif');

            expect(result.contentType).toBe('application/json');
            expect(result.filename).toBe('scan-test-scan-123.sarif');
            expect(result.resultCount).toBe(3);

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.version).toBe('2.1.0');
            expect(parsedContent.runs).toHaveLength(1);
            expect(parsedContent.runs[0].results).toHaveLength(3);
        });

        test('should throw error for unsupported format', () => {
            expect(() => {
                outputFormatters.formatOutput(mockScanResults, 'xml');
            }).toThrow('Unsupported output format: xml');
        });
    });

    describe('JSON formatting', () => {
        test('should format JSON with pretty printing', () => {
            const result = outputFormatters.formatJSON(mockScanResults, { pretty: true });

            expect(result.content).toContain('\n');
            expect(result.content).toContain('  ');

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.scanId).toBe('test-scan-123');
        });

        test('should format JSON without metadata', () => {
            const result = outputFormatters.formatJSON(mockScanResults, { includeMetadata: false });

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.formatMetadata).toBeUndefined();
        });

        test('should include raw data when requested', () => {
            const scanResultsWithRaw = {
                ...mockScanResults,
                rawResults: { originalData: 'test' }
            };

            const result = outputFormatters.formatJSON(scanResultsWithRaw, { includeRawData: true });

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.rawResults).toBeDefined();
            expect(parsedContent.rawResults.originalData).toBe('test');
        });
    });

    describe('CSV formatting', () => {
        test('should format CSV with custom delimiter', () => {
            const result = outputFormatters.formatCSV(mockScanResults, { delimiter: ';' });

            const lines = result.content.split('\n');
            expect(lines[0]).toContain('Scan ID;Target;Category');
        });

        test('should format CSV without headers', () => {
            const result = outputFormatters.formatCSV(mockScanResults, { includeHeaders: false });

            const lines = result.content.split('\n');
            expect(lines[0]).not.toContain('Scan ID');
            expect(lines[0]).toContain('test-scan-123');
        });

        test('should include context in CSV when requested', () => {
            const result = outputFormatters.formatCSV(mockScanResults, { includeContext: true });

            const lines = result.content.split('\n');
            expect(lines[0]).toContain('Context Before,Context After');
            expect(lines[1]).toContain('const apiKey = "');
        });

        test('should escape CSV values with special characters', () => {
            const specialResults = {
                ...mockScanResults,
                results: {
                    categories: [{
                        category: 'test',
                        findings: [{
                            id: 'test-1',
                            type: 'test',
                            severity: 'medium',
                            value: 'value,with,commas',
                            description: 'Description with "quotes" and\nnewlines'
                        }]
                    }]
                }
            };

            const result = outputFormatters.formatCSV(specialResults);
            const lines = result.content.split('\n');

            expect(lines[1]).toContain('"value,with,commas"');
            expect(result.content).toContain('"Description with ""quotes"" and');
        });

        test('should handle null and undefined values', () => {
            const nullResults = {
                ...mockScanResults,
                results: {
                    categories: [{
                        category: 'test',
                        findings: [{
                            id: 'test-1',
                            type: null,
                            severity: undefined,
                            value: '',
                            file: null
                        }]
                    }]
                }
            };

            const result = outputFormatters.formatCSV(nullResults);
            expect(result.content).not.toContain('null');
            expect(result.content).not.toContain('undefined');
        });
    });

    describe('SARIF formatting', () => {
        test('should generate valid SARIF structure', () => {
            const result = outputFormatters.formatSARIF(mockScanResults);

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.version).toBe('2.1.0');
            expect(parsedContent.$schema).toContain('sarif-schema');
            expect(parsedContent.runs).toHaveLength(1);

            const run = parsedContent.runs[0];
            expect(run.tool.driver.name).toBe('ThreatPeek Enhanced Scanner');
            expect(run.results).toHaveLength(3);
        });

        test('should map severity levels to SARIF levels correctly', () => {
            expect(outputFormatters.mapSeverityToSarifLevel('critical')).toBe('error');
            expect(outputFormatters.mapSeverityToSarifLevel('high')).toBe('error');
            expect(outputFormatters.mapSeverityToSarifLevel('medium')).toBe('warning');
            expect(outputFormatters.mapSeverityToSarifLevel('low')).toBe('note');
            expect(outputFormatters.mapSeverityToSarifLevel('unknown')).toBe('warning');
        });

        test('should generate unique rule IDs', () => {
            const finding1 = { type: 'api_key' };
            const finding2 = { type: 'database_url' };
            const category = { category: 'secrets' };

            const ruleId1 = outputFormatters.generateRuleId(finding1, category);
            const ruleId2 = outputFormatters.generateRuleId(finding2, category);

            expect(ruleId1).toBe('threatpeek.secrets.api_key');
            expect(ruleId2).toBe('threatpeek.secrets.database_url');
            expect(ruleId1).not.toBe(ruleId2);
        });

        test('should generate fingerprints for deduplication', () => {
            const finding = { type: 'api_key', value: 'test', file: '/test.js', line: '10' };
            const category = { category: 'secrets' };
            const target = { value: 'https://example.com' };

            const fingerprint = outputFormatters.generateFingerprint(finding, category, target);
            expect(fingerprint).toHaveLength(16);
            expect(typeof fingerprint).toBe('string');
        });

        test('should include rules when requested', () => {
            const result = outputFormatters.formatSARIF(mockScanResults, { includeRules: true });

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.runs[0].tool.driver.rules).toBeDefined();
            expect(parsedContent.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
        });

        test('should exclude rules when not requested', () => {
            const result = outputFormatters.formatSARIF(mockScanResults, { includeRules: false });

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.runs[0].tool.driver.rules).toBeUndefined();
        });

        test('should handle custom tool information', () => {
            const result = outputFormatters.formatSARIF(mockScanResults, {
                toolName: 'Custom Scanner',
                toolVersion: '1.2.3',
                informationUri: 'https://custom.com'
            });

            const parsedContent = JSON.parse(result.content);
            const driver = parsedContent.runs[0].tool.driver;
            expect(driver.name).toBe('Custom Scanner');
            expect(driver.version).toBe('1.2.3');
            expect(driver.informationUri).toBe('https://custom.com');
        });

        test('should generate appropriate rule descriptions', () => {
            const finding = { type: 'api_key', severity: 'critical' };
            const category = { category: 'secrets' };

            const shortDesc = outputFormatters.generateRuleShortDescription(finding, category);
            const fullDesc = outputFormatters.generateRuleFullDescription(finding, category);

            expect(shortDesc).toContain('api_key detected in secrets');
            expect(fullDesc).toContain('api_key in secrets category');
            expect(fullDesc).toContain('Severity level: critical');
        });

        test('should generate appropriate rule tags', () => {
            const finding = { type: 'api_key', severity: 'critical' };
            const category = { category: 'secrets' };

            const tags = outputFormatters.generateRuleTags(finding, category);
            expect(tags).toContain('security');
            expect(tags).toContain('secrets');
            expect(tags).toContain('severity-critical');
            expect(tags).toContain('api-key');
        });
    });

    describe('validation', () => {
        test('should validate supported formats', () => {
            const validResult = outputFormatters.validateFormat('json');
            expect(validResult.isValid).toBe(true);
            expect(validResult.errors).toHaveLength(0);

            const invalidResult = outputFormatters.validateFormat('xml');
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors).toContain('Unsupported format: xml');
        });

        test('should validate CSV options', () => {
            const invalidDelimiter = outputFormatters.validateFormat('csv', { delimiter: 'abc' });
            expect(invalidDelimiter.isValid).toBe(false);
            expect(invalidDelimiter.errors).toContain('CSV delimiter must be a single character');

            const validDelimiter = outputFormatters.validateFormat('csv', { delimiter: ';' });
            expect(validDelimiter.isValid).toBe(true);
        });

        test('should validate SARIF options', () => {
            const invalidVersion = outputFormatters.validateFormat('sarif', { toolVersion: 'invalid' });
            expect(invalidVersion.isValid).toBe(true);
            expect(invalidVersion.warnings).toContain('Tool version should follow semantic versioning (x.y.z)');

            const validVersion = outputFormatters.validateFormat('sarif', { toolVersion: '1.2.3' });
            expect(validVersion.isValid).toBe(true);
            expect(validVersion.warnings).toHaveLength(0);
        });
    });

    describe('utility methods', () => {
        test('should return supported formats', () => {
            const formats = outputFormatters.getSupportedFormats();
            expect(formats).toContain('json');
            expect(formats).toContain('csv');
            expect(formats).toContain('sarif');
        });

        test('should return correct content types', () => {
            expect(outputFormatters.getContentType('json')).toBe('application/json');
            expect(outputFormatters.getContentType('csv')).toBe('text/csv');
            expect(outputFormatters.getContentType('sarif')).toBe('application/json');
            expect(outputFormatters.getContentType('unknown')).toBe('text/plain');
        });

        test('should return correct file extensions', () => {
            expect(outputFormatters.getFileExtension('json')).toBe('json');
            expect(outputFormatters.getFileExtension('csv')).toBe('csv');
            expect(outputFormatters.getFileExtension('sarif')).toBe('sarif');
            expect(outputFormatters.getFileExtension('unknown')).toBe('txt');
        });

        test('should escape CSV values correctly', () => {
            expect(outputFormatters.escapeCsvValue('simple')).toBe('simple');
            expect(outputFormatters.escapeCsvValue('value,with,commas')).toBe('"value,with,commas"');
            expect(outputFormatters.escapeCsvValue('value with "quotes"')).toBe('"value with ""quotes"""');
            expect(outputFormatters.escapeCsvValue('value\nwith\nnewlines')).toBe('"value\nwith\nnewlines"');
            expect(outputFormatters.escapeCsvValue(null)).toBe('');
            expect(outputFormatters.escapeCsvValue(undefined)).toBe('');
        });
    });

    describe('edge cases and error handling', () => {
        test('should handle empty scan results', () => {
            const emptyResults = {
                scanId: 'empty-scan',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [],
                    summary: { totalFindings: 0 }
                }
            };

            const jsonResult = outputFormatters.formatJSON(emptyResults);
            const csvResult = outputFormatters.formatCSV(emptyResults);
            const sarifResult = outputFormatters.formatSARIF(emptyResults);

            expect(JSON.parse(jsonResult.content).scanId).toBe('empty-scan');
            expect(csvResult.recordCount).toBe(0);
            expect(JSON.parse(sarifResult.content).runs[0].results).toHaveLength(0);
        });

        test('should handle malformed findings gracefully', () => {
            const malformedResults = {
                scanId: 'malformed-scan',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [{
                        category: 'test',
                        findings: [
                            { /* missing required fields */ },
                            { id: 'valid', type: 'test', severity: 'medium' }
                        ]
                    }],
                    summary: { totalFindings: 2 }
                }
            };

            expect(() => {
                outputFormatters.formatJSON(malformedResults);
                outputFormatters.formatCSV(malformedResults);
                outputFormatters.formatSARIF(malformedResults);
            }).not.toThrow();
        });

        test('should handle very large result sets', () => {
            const largeResults = {
                scanId: 'large-scan',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [{
                        category: 'test',
                        findings: Array(1000).fill().map((_, i) => ({
                            id: `finding-${i}`,
                            type: 'test',
                            severity: 'medium',
                            value: `value-${i}`,
                            file: `/file${i}.js`
                        }))
                    }],
                    summary: { totalFindings: 1000 }
                }
            };

            const startTime = Date.now();
            const csvResult = outputFormatters.formatCSV(largeResults);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(csvResult.recordCount).toBe(1000);
        });

        test('should handle special characters in all formats', () => {
            const specialResults = {
                scanId: 'special-chars-scan',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [{
                        category: 'test',
                        findings: [{
                            id: 'special-1',
                            type: 'test',
                            severity: 'medium',
                            value: 'Special chars: <>&"\'',
                            description: 'Unicode: 🔒 emoji and ñoño',
                            file: '/path/with spaces/file.js'
                        }]
                    }],
                    summary: { totalFindings: 1 }
                }
            };

            const jsonResult = outputFormatters.formatJSON(specialResults);
            const csvResult = outputFormatters.formatCSV(specialResults);
            const sarifResult = outputFormatters.formatSARIF(specialResults);

            expect(() => JSON.parse(jsonResult.content)).not.toThrow();
            expect(csvResult.content).toContain('Special chars');
            expect(() => JSON.parse(sarifResult.content)).not.toThrow();
        });
    });

    describe('backward compatibility', () => {
        test('should maintain backward compatibility with existing API response formats', () => {
            const legacyResults = {
                scanId: 'legacy-scan',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [{
                        category: 'secrets',
                        findings: [{
                            // Legacy format without some new fields
                            issue: 'API Key Found',
                            severity: 'high',
                            value: 'sk_test_123',
                            file: '/config.js'
                        }]
                    }],
                    summary: { totalFindings: 1 }
                }
            };

            const jsonResult = outputFormatters.formatJSON(legacyResults);
            const csvResult = outputFormatters.formatCSV(legacyResults);
            const sarifResult = outputFormatters.formatSARIF(legacyResults);

            expect(() => JSON.parse(jsonResult.content)).not.toThrow();
            expect(csvResult.recordCount).toBe(1);
            expect(JSON.parse(sarifResult.content).runs[0].results).toHaveLength(1);
        });

        test('should handle mixed legacy and new format findings', () => {
            const mixedResults = {
                scanId: 'mixed-scan',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [{
                        category: 'secrets',
                        findings: [
                            // Legacy format
                            { issue: 'API Key Found', severity: 'high', value: 'sk_test_123' },
                            // New format
                            { id: 'new-1', type: 'api_key', severity: 'critical', confidence: 0.9 }
                        ]
                    }],
                    summary: { totalFindings: 2 }
                }
            };

            const sarifResult = outputFormatters.formatSARIF(mixedResults);
            const parsedSarif = JSON.parse(sarifResult.content);

            expect(parsedSarif.runs[0].results).toHaveLength(2);
            expect(parsedSarif.runs[0].results[0].message.text).toContain('API Key Found');
            expect(parsedSarif.runs[0].results[1].properties.confidence).toBe(0.9);
        });
    });

    describe('performance and optimization', () => {
        test('should efficiently process large CSV exports', () => {
            const largeResults = {
                scanId: 'perf-test',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: Array(50).fill().map((_, catIndex) => ({
                        category: `category-${catIndex}`,
                        findings: Array(20).fill().map((_, findingIndex) => ({
                            id: `finding-${catIndex}-${findingIndex}`,
                            type: 'test',
                            severity: 'medium',
                            value: `value-${findingIndex}`,
                            file: `/file${findingIndex}.js`
                        }))
                    })),
                    summary: { totalFindings: 1000 }
                }
            };

            const startTime = Date.now();
            const result = outputFormatters.formatCSV(largeResults);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
            expect(result.recordCount).toBe(1000);
            expect(result.size).toBeGreaterThan(0);
        });

        test('should efficiently generate SARIF for large result sets', () => {
            const largeResults = {
                scanId: 'sarif-perf-test',
                target: { type: 'url', value: 'https://example.com' },
                results: {
                    categories: [{
                        category: 'test',
                        findings: Array(500).fill().map((_, i) => ({
                            id: `finding-${i}`,
                            type: 'test',
                            severity: 'medium',
                            value: `value-${i}`,
                            file: `/file${i}.js`,
                            line: i + 1
                        }))
                    }],
                    summary: { totalFindings: 500 }
                }
            };

            const startTime = Date.now();
            const result = outputFormatters.formatSARIF(largeResults);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
            expect(result.resultCount).toBe(500);

            const parsedContent = JSON.parse(result.content);
            expect(parsedContent.runs[0].results).toHaveLength(500);
        });
    });
});