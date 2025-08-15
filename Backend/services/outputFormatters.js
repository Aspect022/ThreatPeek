/**
 * Output Format Handlers - Support for multiple export formats
 * Handles JSON, CSV, and SARIF output formats with proper transformation
 */

class OutputFormatters {
    constructor() {
        this.supportedFormats = ['json', 'csv', 'sarif'];
    }

    /**
     * Format results for the specified output format
     * @param {Object} scanResults - Scan results to format
     * @param {string} format - Output format (json, csv, sarif)
     * @param {Object} options - Format-specific options
     * @returns {Object} Formatted output with content and metadata
     */
    formatOutput(scanResults, format, options = {}) {
        const normalizedFormat = format.toLowerCase();

        if (!this.supportedFormats.includes(normalizedFormat)) {
            throw new Error(`Unsupported output format: ${format}`);
        }

        switch (normalizedFormat) {
            case 'json':
                return this.formatJSON(scanResults, options);
            case 'csv':
                return this.formatCSV(scanResults, options);
            case 'sarif':
                return this.formatSARIF(scanResults, options);
            default:
                throw new Error(`Format handler not implemented: ${format}`);
        }
    }

    /**
     * Format results as JSON (enhanced version of default)
     * @param {Object} scanResults - Scan results
     * @param {Object} options - JSON formatting options
     * @returns {Object} JSON formatted output
     */
    formatJSON(scanResults, options = {}) {
        const {
            pretty = false,
            includeMetadata = true,
            includeRawData = false
        } = options;

        const jsonOutput = {
            ...scanResults
        };

        // Add format metadata
        if (includeMetadata) {
            jsonOutput.formatMetadata = {
                format: 'json',
                version: '2.0',
                generatedAt: new Date().toISOString(),
                options: options
            };
        }

        // Include raw data if requested
        if (includeRawData && scanResults.rawResults) {
            jsonOutput.rawResults = scanResults.rawResults;
        }

        return {
            content: pretty ? JSON.stringify(jsonOutput, null, 2) : JSON.stringify(jsonOutput),
            contentType: 'application/json',
            filename: `scan-${scanResults.scanId}.json`,
            size: JSON.stringify(jsonOutput).length
        };
    }

    /**
     * Format results as CSV
     * @param {Object} scanResults - Scan results
     * @param {Object} options - CSV formatting options
     * @returns {Object} CSV formatted output
     */
    formatCSV(scanResults, options = {}) {
        const {
            includeHeaders = true,
            delimiter = ',',
            includeContext = false,
            flattenCategories = true
        } = options;

        const csvRows = [];

        // Define CSV headers
        const headers = [
            'Scan ID',
            'Target',
            'Category',
            'Scan Type',
            'Finding Type',
            'Severity',
            'Confidence',
            'Value',
            'File',
            'Line',
            'Description'
        ];

        if (includeContext) {
            headers.push('Context Before', 'Context After');
        }

        if (includeHeaders) {
            csvRows.push(headers.join(delimiter));
        }

        // Process each category and finding
        scanResults.results.categories.forEach(category => {
            category.findings.forEach(finding => {
                const row = [
                    this.escapeCsvValue(scanResults.scanId),
                    this.escapeCsvValue(scanResults.target.value),
                    this.escapeCsvValue(category.category),
                    this.escapeCsvValue(category.scanType || ''),
                    this.escapeCsvValue(finding.type || finding.issue || ''),
                    this.escapeCsvValue(finding.severity || 'medium'),
                    this.escapeCsvValue(finding.confidence || 'N/A'),
                    this.escapeCsvValue(finding.value || ''),
                    this.escapeCsvValue(finding.file || finding.location?.file || ''),
                    this.escapeCsvValue(finding.line || finding.location?.line || ''),
                    this.escapeCsvValue(finding.description || finding.issue || '')
                ];

                if (includeContext && finding.context) {
                    row.push(
                        this.escapeCsvValue(finding.context.before || ''),
                        this.escapeCsvValue(finding.context.after || '')
                    );
                }

                csvRows.push(row.join(delimiter));
            });
        });

        const csvContent = csvRows.join('\n');

        return {
            content: csvContent,
            contentType: 'text/csv',
            filename: `scan-${scanResults.scanId}.csv`,
            size: csvContent.length,
            recordCount: csvRows.length - (includeHeaders ? 1 : 0)
        };
    }

    /**
     * Format results as SARIF (Static Analysis Results Interchange Format)
     * @param {Object} scanResults - Scan results
     * @param {Object} options - SARIF formatting options
     * @returns {Object} SARIF formatted output
     */
    formatSARIF(scanResults, options = {}) {
        const {
            toolName = 'ThreatPeek Enhanced Scanner',
            toolVersion = '2.0.0',
            informationUri = 'https://threatpeek.com',
            includeRules = true
        } = options;

        const sarif = {
            version: '2.1.0',
            $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
            runs: [{
                tool: {
                    driver: {
                        name: toolName,
                        version: toolVersion,
                        informationUri: informationUri,
                        rules: includeRules ? this.generateSarifRules(scanResults) : undefined
                    }
                },
                invocations: [{
                    executionSuccessful: scanResults.status === 'completed',
                    startTimeUtc: scanResults.startTime,
                    endTimeUtc: scanResults.endTime,
                    machine: process.platform,
                    arguments: [scanResults.target.value]
                }],
                results: []
            }]
        };

        // Convert findings to SARIF results
        scanResults.results.categories.forEach(category => {
            category.findings.forEach(finding => {
                const sarifResult = {
                    ruleId: this.generateRuleId(finding, category),
                    level: this.mapSeverityToSarifLevel(finding.severity),
                    message: {
                        text: finding.description || finding.issue || `${finding.type || 'Security issue'} detected`
                    },
                    locations: [{
                        physicalLocation: {
                            artifactLocation: {
                                uri: finding.file || finding.location?.file || scanResults.target.value
                            },
                            region: finding.line ? {
                                startLine: parseInt(finding.line) || 1
                            } : undefined
                        }
                    }],
                    properties: {
                        category: category.category,
                        scanType: category.scanType,
                        confidence: finding.confidence,
                        value: finding.value,
                        context: finding.context
                    }
                };

                // Add fingerprint for deduplication
                sarifResult.fingerprints = {
                    threatPeekId: this.generateFingerprint(finding, category, scanResults.target)
                };

                sarif.runs[0].results.push(sarifResult);
            });
        });

        // Add run metadata
        sarif.runs[0].properties = {
            scanId: scanResults.scanId,
            target: scanResults.target,
            duration: scanResults.duration,
            totalFindings: scanResults.results.summary.totalFindings,
            scanTypes: scanResults.results.categories.map(cat => cat.scanType).filter(Boolean)
        };

        const sarifContent = JSON.stringify(sarif, null, 2);

        return {
            content: sarifContent,
            contentType: 'application/json',
            filename: `scan-${scanResults.scanId}.sarif`,
            size: sarifContent.length,
            resultCount: sarif.runs[0].results.length
        };
    }

    /**
     * Generate SARIF rules from scan results
     * @param {Object} scanResults - Scan results
     * @returns {Array} SARIF rules array
     */
    generateSarifRules(scanResults) {
        const rulesMap = new Map();

        scanResults.results.categories.forEach(category => {
            category.findings.forEach(finding => {
                const ruleId = this.generateRuleId(finding, category);

                if (!rulesMap.has(ruleId)) {
                    rulesMap.set(ruleId, {
                        id: ruleId,
                        name: finding.type || finding.issue || 'SecurityIssue',
                        shortDescription: {
                            text: this.generateRuleShortDescription(finding, category)
                        },
                        fullDescription: {
                            text: this.generateRuleFullDescription(finding, category)
                        },
                        defaultConfiguration: {
                            level: this.mapSeverityToSarifLevel(finding.severity)
                        },
                        properties: {
                            category: category.category,
                            severity: finding.severity,
                            tags: this.generateRuleTags(finding, category)
                        }
                    });
                }
            });
        });

        return Array.from(rulesMap.values());
    }

    /**
     * Generate a unique rule ID for a finding
     * @param {Object} finding - Finding object
     * @param {Object} category - Category object
     * @returns {string} Rule ID
     */
    generateRuleId(finding, category) {
        const type = finding.type || finding.issue || 'unknown';
        return `threatpeek.${category.category}.${type.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    /**
     * Generate short description for SARIF rule
     * @param {Object} finding - Finding object
     * @param {Object} category - Category object
     * @returns {string} Short description
     */
    generateRuleShortDescription(finding, category) {
        const type = finding.type || finding.issue || 'Security issue';
        return `${type} detected in ${category.category}`;
    }

    /**
     * Generate full description for SARIF rule
     * @param {Object} finding - Finding object
     * @param {Object} category - Category object
     * @returns {string} Full description
     */
    generateRuleFullDescription(finding, category) {
        const type = finding.type || finding.issue || 'security issue';
        const severity = finding.severity || 'medium';

        return `This rule detects ${type} in ${category.category} category. ` +
            `Severity level: ${severity}. ` +
            `${finding.description || 'Review the finding and take appropriate action.'}`;
    }

    /**
     * Generate tags for SARIF rule
     * @param {Object} finding - Finding object
     * @param {Object} category - Category object
     * @returns {Array} Tags array
     */
    generateRuleTags(finding, category) {
        const tags = ['security', category.category];

        if (finding.severity) {
            tags.push(`severity-${finding.severity}`);
        }

        if (finding.type) {
            tags.push(finding.type.toLowerCase().replace(/[^a-z0-9]/g, '-'));
        }

        return tags;
    }

    /**
     * Map severity to SARIF level
     * @param {string} severity - Severity level
     * @returns {string} SARIF level
     */
    mapSeverityToSarifLevel(severity) {
        const mapping = {
            critical: 'error',
            high: 'error',
            medium: 'warning',
            low: 'note'
        };
        return mapping[severity?.toLowerCase()] || 'warning';
    }

    /**
     * Generate fingerprint for finding deduplication
     * @param {Object} finding - Finding object
     * @param {Object} category - Category object
     * @param {Object} target - Scan target
     * @returns {string} Fingerprint hash
     */
    generateFingerprint(finding, category, target) {
        const crypto = require('crypto');

        const fingerprintData = [
            target.value,
            category.category,
            finding.type || finding.issue || '',
            finding.value || '',
            finding.file || '',
            finding.line || ''
        ].join('|');

        return crypto.createHash('sha256').update(fingerprintData).digest('hex').substring(0, 16);
    }

    /**
     * Escape CSV value to handle special characters
     * @param {any} value - Value to escape
     * @returns {string} Escaped CSV value
     */
    escapeCsvValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value);

        // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
    }

    /**
     * Get supported formats
     * @returns {Array} Array of supported format names
     */
    getSupportedFormats() {
        return [...this.supportedFormats];
    }

    /**
     * Validate format and options
     * @param {string} format - Format to validate
     * @param {Object} options - Options to validate
     * @returns {Object} Validation result
     */
    validateFormat(format, options = {}) {
        const errors = [];
        const warnings = [];

        // Validate format
        if (!this.supportedFormats.includes(format.toLowerCase())) {
            errors.push(`Unsupported format: ${format}`);
        }

        // Format-specific validation
        switch (format.toLowerCase()) {
            case 'csv':
                if (options.delimiter && options.delimiter.length !== 1) {
                    errors.push('CSV delimiter must be a single character');
                }
                break;

            case 'sarif':
                if (options.toolVersion && !/^\d+\.\d+\.\d+$/.test(options.toolVersion)) {
                    warnings.push('Tool version should follow semantic versioning (x.y.z)');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get format-specific content type
     * @param {string} format - Output format
     * @returns {string} Content type
     */
    getContentType(format) {
        const contentTypes = {
            json: 'application/json',
            csv: 'text/csv',
            sarif: 'application/json'
        };

        return contentTypes[format.toLowerCase()] || 'text/plain';
    }

    /**
     * Get format-specific file extension
     * @param {string} format - Output format
     * @returns {string} File extension
     */
    getFileExtension(format) {
        const extensions = {
            json: 'json',
            csv: 'csv',
            sarif: 'sarif'
        };

        return extensions[format.toLowerCase()] || 'txt';
    }
}

module.exports = { OutputFormatters };