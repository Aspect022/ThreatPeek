/**
 * Enhanced Result Formatter - Provides filtering, confidence scoring, and consolidated reporting
 * Supports multiple output formats and backward compatibility
 */

class ResultFormatter {
    constructor(options = {}) {
        this.defaultConfidenceThreshold = options.confidenceThreshold || 0.5;
        this.supportedFormats = ['json', 'csv', 'sarif'];
        this.severityLevels = ['critical', 'high', 'medium', 'low'];
        this.categories = ['secrets', 'files', 'headers', 'owasp', 'misconfig'];
    }

    /**
     * Format and filter scan results based on criteria
     * @param {Object} scanResults - Raw scan results from orchestrator
     * @param {Object} filterOptions - Filtering and formatting options
     * @returns {Object} Formatted and filtered results
     */
    formatResults(scanResults, filterOptions = {}) {
        const {
            severity = null,
            category = null,
            confidenceThreshold = this.defaultConfidenceThreshold,
            includeContext = true,
            sortBy = 'severity',
            sortOrder = 'desc',
            limit = null,
            offset = 0
        } = filterOptions;

        // Validate and normalize scan results
        if (!scanResults || !scanResults.results) {
            throw new Error('Invalid scan results: missing results object');
        }

        // Ensure required structure exists
        const normalizedResults = {
            ...scanResults,
            results: {
                categories: scanResults.results.categories || [],
                summary: scanResults.results.summary || {
                    totalFindings: 0,
                    criticalCount: 0,
                    highCount: 0,
                    mediumCount: 0,
                    lowCount: 0
                }
            }
        };

        // Deep clone to avoid modifying original results
        const formattedResults = JSON.parse(JSON.stringify(normalizedResults));

        // Apply filters
        formattedResults.results.categories = this.applyFilters(
            formattedResults.results.categories,
            { severity, category, confidenceThreshold }
        );

        // Apply advanced filters if provided
        if (filterOptions.filePattern || filterOptions.issueType || filterOptions.excludeFiles ||
            filterOptions.minConfidence !== undefined || filterOptions.maxConfidence !== undefined) {
            formattedResults.results.categories = this.applyAdvancedFilters(
                formattedResults.results.categories,
                filterOptions
            );
        }

        // Enhance confidence display
        if (filterOptions.enhanceConfidence !== false) {
            formattedResults.results.categories = this.enhanceConfidenceDisplay(
                formattedResults.results.categories
            );
        }

        // Sort findings within each category
        formattedResults.results.categories.forEach(cat => {
            cat.findings = this.sortFindings(cat.findings, sortBy, sortOrder);
        });

        // Apply pagination if specified
        if (limit || offset > 0) {
            formattedResults.results.categories = this.paginateResults(
                formattedResults.results.categories,
                offset,
                limit
            );
        }

        // Remove context if not requested
        if (!includeContext) {
            formattedResults.results.categories = this.removeContext(
                formattedResults.results.categories
            );
        }

        // Recalculate summary for filtered results
        formattedResults.results.summary = this.calculateSummary(
            formattedResults.results.categories
        );

        // Add filtering metadata
        formattedResults.results.metadata = {
            filters: filterOptions,
            totalBeforeFiltering: scanResults.results?.summary?.totalFindings || 0,
            totalAfterFiltering: formattedResults.results.summary.totalFindings,
            appliedAt: new Date().toISOString()
        };

        // Include deduplication statistics if available
        if (scanResults.results?.deduplicationStats) {
            formattedResults.results.deduplicationStats = scanResults.results.deduplicationStats;
        }

        return formattedResults;
    }

    /**
     * Apply filters to result categories
     * @param {Array} categories - Result categories to filter
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered categories
     */
    applyFilters(categories, filters) {
        const { severity, category, confidenceThreshold } = filters;

        let filteredCategories = [...categories];

        // Filter by category
        if (category) {
            const categoryList = Array.isArray(category) ? category : [category];
            filteredCategories = filteredCategories.filter(cat =>
                categoryList.includes(cat.category)
            );
        }

        // Filter by severity and confidence within each category
        filteredCategories = filteredCategories.map(cat => {
            let filteredFindings = [...cat.findings];

            // Filter by severity
            if (severity) {
                const severityList = Array.isArray(severity) ? severity : [severity];
                filteredFindings = filteredFindings.filter(finding =>
                    severityList.includes(finding.severity)
                );
            }

            // Filter by confidence threshold
            if (confidenceThreshold !== null) {
                filteredFindings = filteredFindings.filter(finding =>
                    (finding.confidence || 0.5) >= confidenceThreshold
                );
            }

            return {
                ...cat,
                findings: filteredFindings,
                summary: this.calculateCategorySummary(filteredFindings)
            };
        }).filter(cat => cat.findings.length > 0); // Remove empty categories

        return filteredCategories;
    }

    /**
     * Apply advanced filters including file location patterns
     * @param {Array} categories - Result categories to filter
     * @param {Object} advancedFilters - Advanced filter criteria
     * @returns {Array} Filtered categories
     */
    applyAdvancedFilters(categories, advancedFilters) {
        const {
            filePattern,
            issueType,
            dateRange,
            excludeFiles,
            minConfidence,
            maxConfidence
        } = advancedFilters;

        let filteredCategories = [...categories];

        filteredCategories = filteredCategories.map(category => {
            let filteredFindings = [...category.findings];

            // Filter by file pattern (regex or glob-like pattern)
            if (filePattern) {
                const pattern = new RegExp(filePattern, 'i');
                filteredFindings = filteredFindings.filter(finding => {
                    const filePath = finding.file || finding.location?.file || '';
                    return pattern.test(filePath);
                });
            }

            // Filter by specific issue type
            if (issueType) {
                const issueTypes = Array.isArray(issueType) ? issueType : [issueType];
                filteredFindings = filteredFindings.filter(finding =>
                    issueTypes.includes(finding.type || finding.issue)
                );
            }

            // Exclude specific files
            if (excludeFiles && excludeFiles.length > 0) {
                filteredFindings = filteredFindings.filter(finding => {
                    const filePath = finding.file || finding.location?.file || '';
                    return !excludeFiles.some(excludePattern => {
                        const pattern = new RegExp(excludePattern, 'i');
                        return pattern.test(filePath);
                    });
                });
            }

            // Filter by confidence range
            if (minConfidence !== undefined || maxConfidence !== undefined) {
                filteredFindings = filteredFindings.filter(finding => {
                    const confidence = finding.confidence || 0.5;
                    const meetsMin = minConfidence === undefined || confidence >= minConfidence;
                    const meetsMax = maxConfidence === undefined || confidence <= maxConfidence;
                    return meetsMin && meetsMax;
                });
            }

            return {
                ...category,
                findings: filteredFindings,
                summary: this.calculateCategorySummary(filteredFindings)
            };
        }).filter(cat => cat.findings.length > 0);

        return filteredCategories;
    }

    /**
     * Sort findings by specified criteria
     * @param {Array} findings - Findings to sort
     * @param {string} sortBy - Sort field (severity, confidence, type, file)
     * @param {string} sortOrder - Sort order (asc, desc)
     * @returns {Array} Sorted findings
     */
    sortFindings(findings, sortBy, sortOrder) {
        const sortedFindings = [...findings];

        sortedFindings.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'severity':
                    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                    comparison = (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
                    break;

                case 'confidence':
                    comparison = (a.confidence || 0.5) - (b.confidence || 0.5);
                    break;

                case 'type':
                    comparison = (a.type || a.issue || '').localeCompare(b.type || b.issue || '');
                    break;

                case 'file':
                    comparison = (a.file || a.location?.file || '').localeCompare(b.file || b.location?.file || '');
                    break;

                case 'value':
                    comparison = (a.value || '').localeCompare(b.value || '');
                    break;

                default:
                    comparison = 0;
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return sortedFindings;
    }

    /**
     * Apply pagination to results
     * @param {Array} categories - Categories to paginate
     * @param {number} offset - Starting offset
     * @param {number} limit - Maximum number of findings
     * @returns {Array} Paginated categories
     */
    paginateResults(categories, offset, limit) {
        // Flatten all findings with category info
        const allFindings = [];
        categories.forEach(cat => {
            cat.findings.forEach(finding => {
                allFindings.push({
                    ...finding,
                    _category: cat.category,
                    _scanType: cat.scanType
                });
            });
        });

        // Apply pagination to flattened findings
        const paginatedFindings = limit ?
            allFindings.slice(offset, offset + limit) :
            allFindings.slice(offset);

        // Reconstruct categories from paginated findings
        const categoryMap = new Map();

        paginatedFindings.forEach(finding => {
            const categoryKey = finding._category;
            if (!categoryMap.has(categoryKey)) {
                const originalCategory = categories.find(cat => cat.category === categoryKey);
                categoryMap.set(categoryKey, {
                    category: categoryKey,
                    scanType: finding._scanType,
                    findings: [],
                    summary: { totalFindings: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 }
                });
            }

            // Remove pagination metadata
            const { _category, _scanType, ...cleanFinding } = finding;
            categoryMap.get(categoryKey).findings.push(cleanFinding);
        });

        // Recalculate summaries for paginated categories
        const paginatedCategories = Array.from(categoryMap.values());
        paginatedCategories.forEach(cat => {
            cat.summary = this.calculateCategorySummary(cat.findings);
        });

        return paginatedCategories;
    }

    /**
     * Remove context information from findings
     * @param {Array} categories - Categories to process
     * @returns {Array} Categories without context
     */
    removeContext(categories) {
        return categories.map(cat => ({
            ...cat,
            findings: cat.findings.map(finding => {
                const { context, ...findingWithoutContext } = finding;
                return findingWithoutContext;
            })
        }));
    }

    /**
     * Calculate summary statistics for filtered results
     * @param {Array} categories - Result categories
     * @returns {Object} Summary statistics
     */
    calculateSummary(categories) {
        const summary = {
            totalFindings: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            categoryCounts: {},
            averageConfidence: 0,
            confidenceDistribution: {
                high: 0,    // >= 0.8
                medium: 0,  // 0.5 - 0.79
                low: 0      // < 0.5
            },
            // Deduplication summary
            totalOccurrences: 0,
            duplicateFindings: 0,
            uniqueFindings: 0
        };

        let totalConfidence = 0;
        let confidenceCount = 0;

        categories.forEach(category => {
            summary.categoryCounts[category.category] = category.findings.length;

            category.findings.forEach(finding => {
                summary.totalFindings++;

                // Count by severity
                const severity = finding.severity || 'medium';
                switch (severity.toLowerCase()) {
                    case 'critical':
                        summary.criticalCount++;
                        break;
                    case 'high':
                        summary.highCount++;
                        break;
                    case 'medium':
                        summary.mediumCount++;
                        break;
                    case 'low':
                        summary.lowCount++;
                        break;
                }

                // Calculate confidence statistics
                const confidence = finding.confidence || 0.5;
                totalConfidence += confidence;
                confidenceCount++;

                if (confidence >= 0.8) {
                    summary.confidenceDistribution.high++;
                } else if (confidence >= 0.5) {
                    summary.confidenceDistribution.medium++;
                } else {
                    summary.confidenceDistribution.low++;
                }

                // Calculate deduplication statistics
                const occurrenceCount = finding.occurrenceCount || 1;
                summary.totalOccurrences += occurrenceCount;
                summary.uniqueFindings++;
                if (occurrenceCount > 1) {
                    summary.duplicateFindings++;
                }
            });
        });

        // Calculate average confidence
        summary.averageConfidence = confidenceCount > 0 ?
            Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0;

        return summary;
    }

    /**
     * Add enhanced confidence score display to findings
     * @param {Array} categories - Result categories
     * @returns {Array} Categories with enhanced confidence display
     */
    enhanceConfidenceDisplay(categories) {
        return categories.map(category => ({
            ...category,
            findings: category.findings.map(finding => {
                const confidence = finding.confidence || 0.5;

                return {
                    ...finding,
                    confidenceDisplay: {
                        score: confidence,
                        percentage: Math.round(confidence * 100),
                        level: this.getConfidenceLevel(confidence),
                        badge: this.getConfidenceBadge(confidence),
                        description: this.getConfidenceDescription(confidence)
                    }
                };
            })
        }));
    }

    /**
     * Get confidence level category
     * @param {number} confidence - Confidence score (0-1)
     * @returns {string} Confidence level
     */
    getConfidenceLevel(confidence) {
        if (confidence >= 0.8) return 'high';
        if (confidence >= 0.5) return 'medium';
        return 'low';
    }

    /**
     * Get confidence badge for UI display
     * @param {number} confidence - Confidence score (0-1)
     * @returns {Object} Badge configuration
     */
    getConfidenceBadge(confidence) {
        const level = this.getConfidenceLevel(confidence);
        const badges = {
            high: { color: 'green', text: 'High Confidence', icon: '✓' },
            medium: { color: 'yellow', text: 'Medium Confidence', icon: '⚠' },
            low: { color: 'red', text: 'Low Confidence', icon: '?' }
        };
        return badges[level];
    }

    /**
     * Get confidence description for users
     * @param {number} confidence - Confidence score (0-1)
     * @returns {string} Human-readable description
     */
    getConfidenceDescription(confidence) {
        if (confidence >= 0.9) return 'Very likely to be a genuine security issue';
        if (confidence >= 0.8) return 'Likely to be a security issue';
        if (confidence >= 0.7) return 'Probably a security issue, review recommended';
        if (confidence >= 0.5) return 'Possible security issue, manual verification needed';
        if (confidence >= 0.3) return 'Low confidence, likely false positive';
        return 'Very low confidence, probably false positive';
    }

    /**
     * Calculate summary for a single category
     * @param {Array} findings - Findings in the category
     * @returns {Object} Category summary
     */
    calculateCategorySummary(findings) {
        const summary = {
            totalFindings: findings.length,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0
        };

        findings.forEach(finding => {
            const severity = finding.severity || 'medium';
            switch (severity.toLowerCase()) {
                case 'critical':
                    summary.criticalCount++;
                    break;
                case 'high':
                    summary.highCount++;
                    break;
                case 'medium':
                    summary.mediumCount++;
                    break;
                case 'low':
                    summary.lowCount++;
                    break;
            }
        });

        return summary;
    }

    /**
     * Create consolidated report with clear categorization
     * @param {Object} scanResults - Scan results to consolidate
     * @param {Object} options - Consolidation options
     * @returns {Object} Consolidated report
     */
    createConsolidatedReport(scanResults, options = {}) {
        const {
            groupBy = 'category',
            includeRecommendations = true,
            includeTrends = false
        } = options;

        const consolidatedReport = {
            scanId: scanResults.scanId,
            target: scanResults.target,
            executedAt: scanResults.endTime || new Date().toISOString(),
            duration: scanResults.duration,
            status: scanResults.status,
            overview: this.createOverview(scanResults),
            findings: this.groupFindings(scanResults.results.categories, groupBy),
            summary: scanResults.results.summary,
            metadata: {
                scanTypes: this.extractScanTypes(scanResults),
                totalCategories: scanResults.results.categories.length,
                hasErrors: scanResults.errors && scanResults.errors.length > 0
            }
        };

        // Include deduplication statistics if available
        if (scanResults.results?.deduplicationStats) {
            consolidatedReport.deduplicationStats = scanResults.results.deduplicationStats;
            consolidatedReport.metadata.deduplicationEnabled = scanResults.results.deduplicationStats.deduplicationEnabled;
        }

        // Add recommendations if requested
        if (includeRecommendations) {
            consolidatedReport.recommendations = this.generateRecommendations(scanResults);
        }

        // Add error information if present
        if (scanResults.errors && scanResults.errors.length > 0) {
            consolidatedReport.errors = scanResults.errors.map(error => ({
                phase: error.phase,
                message: error.error,
                timestamp: error.timestamp,
                recoverable: error.recoverable
            }));
        }

        return consolidatedReport;
    }

    /**
     * Create overview section for consolidated report
     * @param {Object} scanResults - Scan results
     * @returns {Object} Overview information
     */
    createOverview(scanResults) {
        const summary = scanResults.results.summary;
        const totalFindings = summary.totalFindings;

        return {
            totalFindings,
            riskLevel: this.calculateRiskLevel(summary),
            topCategories: this.getTopCategories(scanResults.results.categories),
            criticalIssues: summary.criticalCount,
            highPriorityIssues: summary.criticalCount + summary.highCount,
            completionStatus: scanResults.status,
            scanCoverage: this.calculateScanCoverage(scanResults),
            // Deduplication overview
            deduplicationSummary: scanResults.results?.deduplicationStats ? {
                enabled: scanResults.results.deduplicationStats.deduplicationEnabled,
                duplicatesRemoved: scanResults.results.deduplicationStats.totalDuplicatesRemoved || 0,
                deduplicationRate: scanResults.results.deduplicationStats.deduplicationRate || '0%',
                uniqueFindings: scanResults.results.deduplicationStats.finalFindingsCount || totalFindings
            } : null
        };
    }

    /**
     * Calculate overall risk level based on findings
     * @param {Object} summary - Results summary
     * @returns {string} Risk level (critical, high, medium, low)
     */
    calculateRiskLevel(summary) {
        if (summary.criticalCount > 0) return 'critical';
        if (summary.highCount > 5) return 'high';
        if (summary.highCount > 0 || summary.mediumCount > 10) return 'medium';
        return 'low';
    }

    /**
     * Get top categories by finding count
     * @param {Array} categories - Result categories
     * @returns {Array} Top categories with counts
     */
    getTopCategories(categories) {
        return categories
            .map(cat => ({
                category: cat.category,
                count: cat.findings.length,
                severity: this.getCategoryMaxSeverity(cat.findings)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    /**
     * Get maximum severity level in a category
     * @param {Array} findings - Category findings
     * @returns {string} Maximum severity level
     */
    getCategoryMaxSeverity(findings) {
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
     * Calculate scan coverage percentage
     * @param {Object} scanResults - Scan results
     * @returns {number} Coverage percentage
     */
    calculateScanCoverage(scanResults) {
        const totalPhases = scanResults.progress?.phases?.length || 1;
        const completedPhases = scanResults.progress?.phases?.filter(
            phase => phase.status === 'completed'
        ).length || 0;

        return Math.round((completedPhases / totalPhases) * 100);
    }

    /**
     * Group findings by specified criteria
     * @param {Array} categories - Result categories
     * @param {string} groupBy - Grouping criteria
     * @returns {Object} Grouped findings
     */
    groupFindings(categories, groupBy) {
        const grouped = {};

        categories.forEach(category => {
            category.findings.forEach(finding => {
                let groupKey;

                switch (groupBy) {
                    case 'severity':
                        groupKey = finding.severity || 'medium';
                        break;
                    case 'type':
                        groupKey = finding.type || finding.issue || 'unknown';
                        break;
                    case 'file':
                        groupKey = finding.file || finding.location?.file || 'unknown';
                        break;
                    case 'category':
                    default:
                        groupKey = category.category;
                        break;
                }

                if (!grouped[groupKey]) {
                    grouped[groupKey] = {
                        groupKey,
                        findings: [],
                        count: 0,
                        severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 }
                    };
                }

                grouped[groupKey].findings.push({
                    ...finding,
                    category: category.category
                });
                grouped[groupKey].count++;

                const severity = finding.severity || 'medium';
                grouped[groupKey].severityDistribution[severity]++;
            });
        });

        return grouped;
    }

    /**
     * Extract scan types from results
     * @param {Object} scanResults - Scan results
     * @returns {Array} Array of scan types used
     */
    extractScanTypes(scanResults) {
        const scanTypes = new Set();

        if (scanResults.results?.categories) {
            scanResults.results.categories.forEach(cat => {
                if (cat.scanType) {
                    scanTypes.add(cat.scanType);
                }
            });
        }

        return Array.from(scanTypes);
    }

    /**
     * Generate recommendations based on findings
     * @param {Object} scanResults - Scan results
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(scanResults) {
        const recommendations = [];
        const summary = scanResults.results.summary;

        // Critical findings recommendations
        if (summary.criticalCount > 0) {
            recommendations.push({
                priority: 'critical',
                title: 'Address Critical Security Issues Immediately',
                description: `Found ${summary.criticalCount} critical security issues that require immediate attention.`,
                action: 'Review and remediate all critical findings before deployment.'
            });
        }

        // High findings recommendations
        if (summary.highCount > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Resolve High-Priority Security Issues',
                description: `Found ${summary.highCount} high-priority security issues.`,
                action: 'Plan remediation for high-priority findings in the next development cycle.'
            });
        }

        // Category-specific recommendations
        scanResults.results.categories.forEach(category => {
            if (category.findings.length > 0) {
                const categoryRec = this.getCategoryRecommendation(category);
                if (categoryRec) {
                    recommendations.push(categoryRec);
                }
            }
        });

        return recommendations;
    }

    /**
     * Get recommendation for a specific category
     * @param {Object} category - Result category
     * @returns {Object|null} Category recommendation
     */
    getCategoryRecommendation(category) {
        const categoryRecommendations = {
            secrets: {
                priority: 'critical',
                title: 'Secure Exposed Secrets',
                description: `Found ${category.findings.length} exposed secrets or API keys.`,
                action: 'Rotate all exposed credentials and implement proper secret management.'
            },
            files: {
                priority: 'high',
                title: 'Protect Sensitive Files',
                description: `Found ${category.findings.length} exposed sensitive files.`,
                action: 'Remove or properly secure exposed configuration and backup files.'
            },
            headers: {
                priority: 'medium',
                title: 'Improve Security Headers',
                description: `Found ${category.findings.length} security header issues.`,
                action: 'Implement missing security headers and fix misconfigurations.'
            },
            owasp: {
                priority: 'high',
                title: 'Address OWASP Vulnerabilities',
                description: `Found ${category.findings.length} OWASP Top 10 vulnerabilities.`,
                action: 'Review and remediate OWASP vulnerabilities following security best practices.'
            }
        };

        return categoryRecommendations[category.category] || null;
    }

    /**
     * Validate filter options
     * @param {Object} filterOptions - Options to validate
     * @returns {Object} Validation result
     */
    validateFilterOptions(filterOptions) {
        const errors = [];
        const warnings = [];

        // Validate severity levels
        if (filterOptions.severity) {
            const severityList = Array.isArray(filterOptions.severity) ?
                filterOptions.severity : [filterOptions.severity];

            severityList.forEach(severity => {
                if (!this.severityLevels.includes(severity)) {
                    errors.push(`Invalid severity level: ${severity}`);
                }
            });
        }

        // Validate categories
        if (filterOptions.category) {
            const categoryList = Array.isArray(filterOptions.category) ?
                filterOptions.category : [filterOptions.category];

            categoryList.forEach(category => {
                if (!this.categories.includes(category)) {
                    warnings.push(`Unknown category: ${category}`);
                }
            });
        }

        // Validate confidence threshold
        if (filterOptions.confidenceThreshold !== undefined) {
            const threshold = parseFloat(filterOptions.confidenceThreshold);
            if (isNaN(threshold) || threshold < 0 || threshold > 1) {
                errors.push('Confidence threshold must be a number between 0 and 1');
            }
        }

        // Validate sort options
        if (filterOptions.sortBy) {
            const validSortFields = ['severity', 'confidence', 'type', 'file', 'value'];
            if (!validSortFields.includes(filterOptions.sortBy)) {
                errors.push(`Invalid sort field: ${filterOptions.sortBy}`);
            }
        }

        if (filterOptions.sortOrder) {
            if (!['asc', 'desc'].includes(filterOptions.sortOrder)) {
                errors.push('Sort order must be "asc" or "desc"');
            }
        }

        // Validate advanced filter options
        if (filterOptions.filePattern) {
            try {
                new RegExp(filterOptions.filePattern);
            } catch (e) {
                errors.push('Invalid file pattern: must be a valid regular expression');
            }
        }

        if (filterOptions.minConfidence !== undefined) {
            const minConf = parseFloat(filterOptions.minConfidence);
            if (isNaN(minConf) || minConf < 0 || minConf > 1) {
                errors.push('Minimum confidence must be a number between 0 and 1');
            }
        }

        if (filterOptions.maxConfidence !== undefined) {
            const maxConf = parseFloat(filterOptions.maxConfidence);
            if (isNaN(maxConf) || maxConf < 0 || maxConf > 1) {
                errors.push('Maximum confidence must be a number between 0 and 1');
            }
        }

        if (filterOptions.minConfidence !== undefined && filterOptions.maxConfidence !== undefined) {
            const minConf = parseFloat(filterOptions.minConfidence);
            const maxConf = parseFloat(filterOptions.maxConfidence);
            if (!isNaN(minConf) && !isNaN(maxConf) && minConf > maxConf) {
                errors.push('Minimum confidence cannot be greater than maximum confidence');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}

module.exports = { ResultFormatter };