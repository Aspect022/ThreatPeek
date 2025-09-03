/**
 * Result Formatter Tests - Enhanced result formatting and filtering
 * Tests filtering, confidence scoring, and consolidated reporting
 */

const { ResultFormatter } = require('../services/resultFormatter');

describe('ResultFormatter', () => {
    let resultFormatter;
    let mockScanResults;

    beforeEach(() => {
        resultFormatter = new ResultFormatter();

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
            progress: {
                phases: [
                    { type: 'url', status: 'completed' },
                    { type: 'files', status: 'completed' }
                ]
            },
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
                    },
                    {
                        category: 'headers',
                        scanType: 'headers',
                        findings: [
                            {
                                id: 'header-1',
                                type: 'missing_csp',
                                severity: 'low',
                                confidence: 0.6,
                                title: 'Missing Content Security Policy',
                                description: 'CSP header not found',
                                file: 'https://example.com',
                                location: { file: 'https://example.com' }
                            }
                        ],
                        summary: {
                            totalFindings: 1,
                            criticalCount: 0,
                            highCount: 0,
                            mediumCount: 0,
                            lowCount: 1
                        }
                    }
                ],
                summary: {
                    totalFindings: 4,
                    criticalCount: 1,
                    highCount: 1,
                    mediumCount: 1,
                    lowCount: 1,
                    categoryCounts: {
                        secrets: 2,
                        files: 1,
                        headers: 1
                    },
                    averageConfidence: 0.75,
                    confidenceDistribution: {
                        high: 2,
                        medium: 1,
                        low: 1
                    }
                }
            },
            errors: []
        };
    });

    describe('formatResults', () => {
        test('should return formatted results without filters', () => {
            const result = resultFormatter.formatResults(mockScanResults);

            expect(result.scanId).toBe('test-scan-123');
            expect(result.results.categories).toHaveLength(3);
            expect(result.results.summary.totalFindings).toBe(4);
            expect(result.results.metadata).toBeDefined();
            expect(result.results.metadata.totalBeforeFiltering).toBe(4);
            expect(result.results.metadata.totalAfterFiltering).toBe(4);
        });

        test('should filter by severity level', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                severity: 'critical'
            });

            expect(result.results.summary.totalFindings).toBe(1);
            expect(result.results.categories).toHaveLength(1);
            expect(result.results.categories[0].category).toBe('secrets');
            expect(result.results.categories[0].findings[0].severity).toBe('critical');
        });

        test('should filter by multiple severity levels', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                severity: ['critical', 'high']
            });

            expect(result.results.summary.totalFindings).toBe(2);
            expect(result.results.categories).toHaveLength(1);
            expect(result.results.categories[0].category).toBe('secrets');
        });

        test('should filter by category', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                category: 'files'
            });

            expect(result.results.summary.totalFindings).toBe(1);
            expect(result.results.categories).toHaveLength(1);
            expect(result.results.categories[0].category).toBe('files');
        });

        test('should filter by multiple categories', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                category: ['secrets', 'headers']
            });

            expect(result.results.summary.totalFindings).toBe(3);
            expect(result.results.categories).toHaveLength(2);
        });

        test('should filter by confidence threshold', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                confidenceThreshold: 0.8
            });

            expect(result.results.summary.totalFindings).toBe(2);
            // Should include findings with confidence >= 0.8 (0.9 and 0.8)
        });

        test('should combine multiple filters', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                severity: ['critical', 'high'],
                category: 'secrets',
                confidenceThreshold: 0.8
            });

            expect(result.results.summary.totalFindings).toBe(1);
            expect(result.results.categories[0].findings[0].confidence).toBe(0.9);
        });

        test('should sort findings by severity', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                sortBy: 'severity',
                sortOrder: 'desc'
            });

            const secretsCategory = result.results.categories.find(cat => cat.category === 'secrets');
            expect(secretsCategory.findings[0].severity).toBe('critical');
            expect(secretsCategory.findings[1].severity).toBe('high');
        });

        test('should sort findings by confidence', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                sortBy: 'confidence',
                sortOrder: 'desc'
            });

            const secretsCategory = result.results.categories.find(cat => cat.category === 'secrets');
            expect(secretsCategory.findings[0].confidence).toBe(0.9);
            expect(secretsCategory.findings[1].confidence).toBe(0.7);
        });

        test('should sort findings by file location', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                sortBy: 'file',
                sortOrder: 'asc'
            });

            const secretsCategory = result.results.categories.find(cat => cat.category === 'secrets');
            expect(secretsCategory.findings[0].file).toBe('/config/database.js');
            expect(secretsCategory.findings[1].file).toBe('/js/config.js');
        });

        test('should apply pagination', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                limit: 2,
                offset: 0
            });

            expect(result.results.summary.totalFindings).toBe(2);
        });

        test('should remove context when requested', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                includeContext: false
            });

            const secretsCategory = result.results.categories.find(cat => cat.category === 'secrets');
            expect(secretsCategory.findings[0].context).toBeUndefined();
        });

        test('should handle empty results', () => {
            const emptyResults = {
                ...mockScanResults,
                results: {
                    categories: [],
                    summary: {
                        totalFindings: 0,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 0,
                        lowCount: 0
                    }
                }
            };

            const result = resultFormatter.formatResults(emptyResults);
            expect(result.results.summary.totalFindings).toBe(0);
            expect(result.results.categories).toHaveLength(0);
        });
    });

    describe('createConsolidatedReport', () => {
        test('should create consolidated report with default grouping', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults);

            expect(report.scanId).toBe('test-scan-123');
            expect(report.overview).toBeDefined();
            expect(report.overview.totalFindings).toBe(4);
            expect(report.overview.riskLevel).toBe('critical');
            expect(report.findings).toBeDefined();
            expect(report.recommendations).toBeDefined();
        });

        test('should group findings by severity', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults, {
                groupBy: 'severity'
            });

            expect(report.findings.critical).toBeDefined();
            expect(report.findings.high).toBeDefined();
            expect(report.findings.medium).toBeDefined();
            expect(report.findings.low).toBeDefined();
            expect(report.findings.critical.count).toBe(1);
        });

        test('should group findings by type', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults, {
                groupBy: 'type'
            });

            expect(report.findings.api_key).toBeDefined();
            expect(report.findings.database_url).toBeDefined();
            expect(report.findings.exposed_config).toBeDefined();
        });

        test('should group findings by file', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults, {
                groupBy: 'file'
            });

            expect(report.findings['/js/config.js']).toBeDefined();
            expect(report.findings['/config/database.js']).toBeDefined();
            expect(report.findings['/.env']).toBeDefined();
        });

        test('should include recommendations', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults, {
                includeRecommendations: true
            });

            expect(report.recommendations).toBeDefined();
            expect(report.recommendations.length).toBeGreaterThan(0);

            const criticalRec = report.recommendations.find(r => r.priority === 'critical');
            expect(criticalRec).toBeDefined();
            expect(criticalRec.title).toContain('Critical Security Issues');
        });

        test('should exclude recommendations when requested', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults, {
                includeRecommendations: false
            });

            expect(report.recommendations).toBeUndefined();
        });

        test('should calculate risk level correctly', () => {
            // Test critical risk level
            expect(resultFormatter.calculateRiskLevel({ criticalCount: 1, highCount: 0, mediumCount: 0 })).toBe('critical');

            // Test high risk level
            expect(resultFormatter.calculateRiskLevel({ criticalCount: 0, highCount: 6, mediumCount: 0 })).toBe('high');

            // Test medium risk level
            expect(resultFormatter.calculateRiskLevel({ criticalCount: 0, highCount: 2, mediumCount: 5 })).toBe('medium');

            // Test low risk level
            expect(resultFormatter.calculateRiskLevel({ criticalCount: 0, highCount: 0, mediumCount: 2 })).toBe('low');
        });

        test('should calculate scan coverage', () => {
            const coverage = resultFormatter.calculateScanCoverage(mockScanResults);
            expect(coverage).toBe(100); // Both phases completed
        });
    });

    describe('confidence score calculation and display', () => {
        test('should calculate average confidence correctly', () => {
            const summary = resultFormatter.calculateSummary(mockScanResults.results.categories);
            expect(summary.averageConfidence).toBe(0.75); // (0.9 + 0.7 + 0.8 + 0.6) / 4
        });

        test('should calculate confidence distribution', () => {
            const summary = resultFormatter.calculateSummary(mockScanResults.results.categories);
            // Confidence values: 0.9 (high), 0.7 (medium), 0.8 (high), 0.6 (medium)
            expect(summary.confidenceDistribution.high).toBe(2); // >= 0.8 (0.9, 0.8)
            expect(summary.confidenceDistribution.medium).toBe(2); // 0.5-0.79 (0.7, 0.6)
            expect(summary.confidenceDistribution.low).toBe(0); // < 0.5 (none)
        });

        test('should handle missing confidence scores', () => {
            const resultsWithoutConfidence = {
                ...mockScanResults,
                results: {
                    categories: [{
                        category: 'test',
                        findings: [
                            { severity: 'high' }, // No confidence score
                            { severity: 'medium', confidence: 0.7 }
                        ]
                    }]
                }
            };

            const summary = resultFormatter.calculateSummary(resultsWithoutConfidence.results.categories);
            expect(summary.averageConfidence).toBe(0.6); // (0.5 + 0.7) / 2
        });
    });

    describe('validateFilterOptions', () => {
        test('should validate severity levels', () => {
            const validation = resultFormatter.validateFilterOptions({
                severity: 'invalid'
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid severity level: invalid');
        });

        test('should validate confidence threshold', () => {
            const validation = resultFormatter.validateFilterOptions({
                confidenceThreshold: 1.5
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Confidence threshold must be a number between 0 and 1');
        });

        test('should validate sort options', () => {
            const validation = resultFormatter.validateFilterOptions({
                sortBy: 'invalid',
                sortOrder: 'invalid'
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid sort field: invalid');
            expect(validation.errors).toContain('Sort order must be "asc" or "desc"');
        });

        test('should pass valid options', () => {
            const validation = resultFormatter.validateFilterOptions({
                severity: ['critical', 'high'],
                category: 'secrets',
                confidenceThreshold: 0.8,
                sortBy: 'severity',
                sortOrder: 'desc'
            });

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        test('should warn about unknown categories', () => {
            const validation = resultFormatter.validateFilterOptions({
                category: 'unknown_category'
            });

            expect(validation.isValid).toBe(true);
            expect(validation.warnings).toContain('Unknown category: unknown_category');
        });

        test('should validate advanced filter options', () => {
            const validation = resultFormatter.validateFilterOptions({
                filePattern: '[invalid regex',
                minConfidence: 1.5,
                maxConfidence: -0.5
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid file pattern: must be a valid regular expression');
            expect(validation.errors).toContain('Minimum confidence must be a number between 0 and 1');
            expect(validation.errors).toContain('Maximum confidence must be a number between 0 and 1');
        });

        test('should validate confidence range consistency', () => {
            const validation = resultFormatter.validateFilterOptions({
                minConfidence: 0.8,
                maxConfidence: 0.5
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Minimum confidence cannot be greater than maximum confidence');
        });
    });

    describe('edge cases and error handling', () => {
        test('should handle malformed scan results', () => {
            const malformedResults = {
                scanId: 'test',
                results: {
                    categories: [
                        {
                            category: 'test',
                            findings: [
                                { /* missing required fields */ }
                            ]
                        }
                    ],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 0,
                        lowCount: 0
                    }
                }
            };

            expect(() => {
                resultFormatter.formatResults(malformedResults);
            }).not.toThrow();
        });

        test('should handle null/undefined values gracefully', () => {
            const resultsWithNulls = {
                ...mockScanResults,
                results: {
                    categories: [{
                        category: 'test',
                        findings: [
                            {
                                severity: null,
                                confidence: undefined,
                                file: null,
                                type: undefined
                            }
                        ]
                    }],
                    summary: {
                        totalFindings: 1,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 0,
                        lowCount: 0
                    }
                }
            };

            const result = resultFormatter.formatResults(resultsWithNulls);
            expect(result.results.summary.totalFindings).toBe(1);
        });

        test('should handle very large result sets', () => {
            const largeResults = {
                ...mockScanResults,
                results: {
                    categories: [{
                        category: 'test',
                        findings: Array(1000).fill().map((_, i) => ({
                            id: `finding-${i}`,
                            severity: 'medium',
                            confidence: 0.5,
                            type: 'test',
                            file: `/file${i}.js`
                        }))
                    }],
                    summary: {
                        totalFindings: 1000,
                        criticalCount: 0,
                        highCount: 0,
                        mediumCount: 1000,
                        lowCount: 0
                    }
                }
            };

            const result = resultFormatter.formatResults(largeResults, { limit: 100 });
            expect(result.results.summary.totalFindings).toBe(100);
        });
    });

    describe('performance tests', () => {
        test('should format large result sets efficiently', () => {
            const largeResults = {
                ...mockScanResults,
                results: {
                    categories: Array(10).fill().map((_, catIndex) => ({
                        category: `category-${catIndex}`,
                        findings: Array(100).fill().map((_, findingIndex) => ({
                            id: `finding-${catIndex}-${findingIndex}`,
                            severity: ['critical', 'high', 'medium', 'low'][findingIndex % 4],
                            confidence: Math.random(),
                            type: 'test',
                            file: `/file${findingIndex}.js`
                        }))
                    })),
                    summary: {
                        totalFindings: 1000,
                        criticalCount: 250,
                        highCount: 250,
                        mediumCount: 250,
                        lowCount: 250
                    }
                }
            };

            const startTime = Date.now();
            const result = resultFormatter.formatResults(largeResults);
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
            expect(result.results.summary.totalFindings).toBeGreaterThan(0);
            expect(result.results.categories.length).toBe(10);
        });
    });

    describe('enhanced confidence display', () => {
        test('should add confidence display information to findings', () => {
            const result = resultFormatter.formatResults(mockScanResults);

            const secretsCategory = result.results.categories.find(cat => cat.category === 'secrets');
            const finding = secretsCategory.findings[0];

            expect(finding.confidenceDisplay).toBeDefined();
            expect(finding.confidenceDisplay.score).toBeDefined();
            expect(finding.confidenceDisplay.percentage).toBeDefined();
            expect(finding.confidenceDisplay.level).toBeDefined();
            expect(finding.confidenceDisplay.badge).toBeDefined();
            expect(finding.confidenceDisplay.description).toBeDefined();
        });

        test('should calculate confidence levels correctly', () => {
            expect(resultFormatter.getConfidenceLevel(0.9)).toBe('high');
            expect(resultFormatter.getConfidenceLevel(0.7)).toBe('medium');
            expect(resultFormatter.getConfidenceLevel(0.3)).toBe('low');
        });

        test('should provide appropriate confidence badges', () => {
            const highBadge = resultFormatter.getConfidenceBadge(0.9);
            expect(highBadge.color).toBe('green');
            expect(highBadge.text).toBe('High Confidence');

            const mediumBadge = resultFormatter.getConfidenceBadge(0.6);
            expect(mediumBadge.color).toBe('yellow');

            const lowBadge = resultFormatter.getConfidenceBadge(0.3);
            expect(lowBadge.color).toBe('red');
        });

        test('should provide meaningful confidence descriptions', () => {
            expect(resultFormatter.getConfidenceDescription(0.95)).toContain('Very likely');
            expect(resultFormatter.getConfidenceDescription(0.85)).toContain('Likely');
            expect(resultFormatter.getConfidenceDescription(0.6)).toContain('manual verification');
            expect(resultFormatter.getConfidenceDescription(0.2)).toContain('false positive');
        });
    });

    describe('advanced filtering', () => {
        test('should filter by file pattern', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                filePattern: '\\.js$'
            });

            expect(result.results.summary.totalFindings).toBe(2);
            result.results.categories.forEach(category => {
                category.findings.forEach(finding => {
                    expect(finding.file || finding.location?.file || '').toMatch(/\.js$/);
                });
            });
        });

        test('should filter by issue type', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                issueType: 'api_key'
            });

            expect(result.results.summary.totalFindings).toBe(1);
            expect(result.results.categories[0].findings[0].type).toBe('api_key');
        });

        test('should exclude specific files', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                excludeFiles: ['config\\.js$']
            });

            const remainingFiles = [];
            result.results.categories.forEach(category => {
                category.findings.forEach(finding => {
                    remainingFiles.push(finding.file || finding.location?.file || '');
                });
            });

            expect(remainingFiles.some(file => file.includes('config.js'))).toBe(false);
        });

        test('should filter by confidence range', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                minConfidence: 0.8,
                maxConfidence: 0.95
            });

            result.results.categories.forEach(category => {
                category.findings.forEach(finding => {
                    const confidence = finding.confidence || 0.5;
                    expect(confidence).toBeGreaterThanOrEqual(0.8);
                    expect(confidence).toBeLessThanOrEqual(0.95);
                });
            });
        });

        test('should combine advanced filters', () => {
            const result = resultFormatter.formatResults(mockScanResults, {
                filePattern: '\\.js$',
                issueType: ['api_key', 'database_url'],
                minConfidence: 0.7
            });

            expect(result.results.summary.totalFindings).toBeGreaterThan(0);
            result.results.categories.forEach(category => {
                category.findings.forEach(finding => {
                    expect(finding.file || finding.location?.file || '').toMatch(/\.js$/);
                    expect(['api_key', 'database_url']).toContain(finding.type);
                    expect(finding.confidence || 0.5).toBeGreaterThanOrEqual(0.7);
                });
            });
        });
    });

    describe('consolidated reporting enhancements', () => {
        test('should include detailed metadata in consolidated reports', () => {
            const report = resultFormatter.createConsolidatedReport(mockScanResults);

            expect(report.metadata).toBeDefined();
            expect(report.metadata.scanTypes).toBeDefined();
            expect(report.metadata.totalCategories).toBe(3);
            expect(report.metadata.hasErrors).toBe(false);
        });

        test('should calculate top categories correctly', () => {
            const topCategories = resultFormatter.getTopCategories(mockScanResults.results.categories);

            expect(topCategories).toHaveLength(3);
            expect(topCategories[0].category).toBe('secrets'); // Highest count
            expect(topCategories[0].count).toBe(2);
        });

        test('should generate category-specific recommendations', () => {
            const secretsCategory = mockScanResults.results.categories.find(cat => cat.category === 'secrets');
            const recommendation = resultFormatter.getCategoryRecommendation(secretsCategory);

            expect(recommendation).toBeDefined();
            expect(recommendation.priority).toBe('critical');
            expect(recommendation.title).toContain('Secure Exposed Secrets');
        });

        test('should handle reports with errors', () => {
            const resultsWithErrors = {
                ...mockScanResults,
                errors: [
                    {
                        phase: 'url_scan',
                        error: 'Network timeout',
                        timestamp: '2024-01-01T10:02:00Z',
                        recoverable: true
                    }
                ]
            };

            const report = resultFormatter.createConsolidatedReport(resultsWithErrors);

            expect(report.errors).toBeDefined();
            expect(report.errors).toHaveLength(1);
            expect(report.errors[0].phase).toBe('url_scan');
            expect(report.metadata.hasErrors).toBe(true);
        });
    });
});
