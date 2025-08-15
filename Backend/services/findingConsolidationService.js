/**
 * Finding Consolidation Service - Groups related security issues and generates consolidated remediation strategies
 * Implements frontend-specific guidance and intelligent finding grouping
 */

class FindingConsolidationService {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.groupingStrategies = options.groupingStrategies || ['category', 'severity', 'location', 'type'];
        this.consolidationThreshold = options.consolidationThreshold || 2; // Minimum findings to create a group
        this.includeFrontendGuidance = options.includeFrontendGuidance !== false;

        // Initialize grouping rules and patterns
        this.groupingRules = this.initializeGroupingRules();
        this.consolidationPatterns = this.initializeConsolidationPatterns();
        this.frontendGuidanceTemplates = this.initializeFrontendGuidanceTemplates();
    }

    /**
     * Consolidate and group findings
     * @param {Array} findings - Security findings to consolidate
     * @param {Object} context - Additional context (target, scan type, etc.)
     * @returns {Object} Consolidated findings with grouping and remediation strategies
     */
    consolidateFindings(findings, context = {}) {
        if (!this.enabled || !findings || findings.length === 0) {
            return null;
        }

        const consolidation = {
            originalFindings: findings.length,
            groups: [],
            consolidatedRemediation: {},
            frontendGuidance: null,
            statistics: {},
            metadata: {
                consolidatedAt: new Date().toISOString(),
                groupingStrategies: this.groupingStrategies,
                context: context
            }
        };

        // Apply different grouping strategies
        const groupedFindings = this.applyGroupingStrategies(findings, context);

        // Create consolidated groups
        consolidation.groups = this.createConsolidatedGroups(groupedFindings, context);

        // Generate consolidated remediation strategies
        consolidation.consolidatedRemediation = this.generateConsolidatedRemediation(consolidation.groups, context);

        // Generate frontend-specific guidance if applicable
        if (this.includeFrontendGuidance) {
            consolidation.frontendGuidance = this.generateFrontendGuidance(findings, context);
        }

        // Calculate consolidation statistics
        consolidation.statistics = this.calculateConsolidationStatistics(findings, consolidation.groups);

        return consolidation;
    }

    /**
     * Apply different grouping strategies to findings
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Object} Grouped findings by different strategies
     */
    applyGroupingStrategies(findings, context) {
        const grouped = {
            byCategory: this.groupByCategory(findings),
            bySeverity: this.groupBySeverity(findings),
            byLocation: this.groupByLocation(findings),
            byType: this.groupByType(findings),
            byPattern: this.groupByPattern(findings),
            byRemediation: this.groupByRemediationStrategy(findings)
        };

        return grouped;
    }

    /**
     * Group findings by category
     * @param {Array} findings - Security findings
     * @returns {Object} Findings grouped by category
     */
    groupByCategory(findings) {
        const groups = {};

        findings.forEach(finding => {
            const category = finding.category || 'unknown';
            if (!groups[category]) {
                groups[category] = {
                    category,
                    findings: [],
                    count: 0,
                    maxSeverity: 'low',
                    avgConfidence: 0
                };
            }

            groups[category].findings.push(finding);
            groups[category].count++;
            groups[category].maxSeverity = this.getMaxSeverity([groups[category].maxSeverity, finding.severity || 'medium']);
        });

        // Calculate average confidence for each group
        Object.values(groups).forEach(group => {
            const totalConfidence = group.findings.reduce((sum, f) => sum + (f.confidence || 0.5), 0);
            group.avgConfidence = Math.round((totalConfidence / group.findings.length) * 100) / 100;
        });

        return groups;
    }

    /**
     * Group findings by severity level
     * @param {Array} findings - Security findings
     * @returns {Object} Findings grouped by severity
     */
    groupBySeverity(findings) {
        const groups = {
            critical: { severity: 'critical', findings: [], count: 0 },
            high: { severity: 'high', findings: [], count: 0 },
            medium: { severity: 'medium', findings: [], count: 0 },
            low: { severity: 'low', findings: [], count: 0 }
        };

        findings.forEach(finding => {
            const severity = finding.severity || 'medium';
            if (groups[severity]) {
                groups[severity].findings.push(finding);
                groups[severity].count++;
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].count === 0) {
                delete groups[key];
            }
        });

        return groups;
    }

    /**
     * Group findings by file location
     * @param {Array} findings - Security findings
     * @returns {Object} Findings grouped by location
     */
    groupByLocation(findings) {
        const groups = {};

        findings.forEach(finding => {
            const location = this.extractLocationKey(finding);
            if (!groups[location]) {
                groups[location] = {
                    location,
                    findings: [],
                    count: 0,
                    fileType: this.getFileType(location),
                    riskLevel: 'low'
                };
            }

            groups[location].findings.push(finding);
            groups[location].count++;
            groups[location].riskLevel = this.getMaxSeverity([groups[location].riskLevel, finding.severity || 'medium']);
        });

        return groups;
    }

    /**
     * Group findings by type/pattern
     * @param {Array} findings - Security findings
     * @returns {Object} Findings grouped by type
     */
    groupByType(findings) {
        const groups = {};

        findings.forEach(finding => {
            const type = finding.type || 'unknown';
            if (!groups[type]) {
                groups[type] = {
                    type,
                    findings: [],
                    count: 0,
                    category: finding.category,
                    commonPattern: null
                };
            }

            groups[type].findings.push(finding);
            groups[type].count++;
        });

        // Identify common patterns within each type group
        Object.values(groups).forEach(group => {
            group.commonPattern = this.identifyCommonPattern(group.findings);
        });

        return groups;
    }

    /**
     * Group findings by similar patterns
     * @param {Array} findings - Security findings
     * @returns {Object} Findings grouped by patterns
     */
    groupByPattern(findings) {
        const groups = {};

        findings.forEach(finding => {
            const pattern = this.identifyFindingPattern(finding);
            if (!groups[pattern]) {
                groups[pattern] = {
                    pattern,
                    findings: [],
                    count: 0,
                    description: this.getPatternDescription(pattern)
                };
            }

            groups[pattern].findings.push(finding);
            groups[pattern].count++;
        });

        return groups;
    }

    /**
     * Group findings by remediation strategy
     * @param {Array} findings - Security findings
     * @returns {Object} Findings grouped by remediation approach
     */
    groupByRemediationStrategy(findings) {
        const groups = {};

        findings.forEach(finding => {
            const strategy = this.getRemediationStrategy(finding);
            if (!groups[strategy]) {
                groups[strategy] = {
                    strategy,
                    findings: [],
                    count: 0,
                    priority: this.getStrategyPriority(strategy),
                    effort: 'medium'
                };
            }

            groups[strategy].findings.push(finding);
            groups[strategy].count++;
        });

        // Calculate effort level for each strategy
        Object.values(groups).forEach(group => {
            group.effort = this.calculateRemediationEffort(group.findings);
        });

        return groups;
    }

    /**
     * Create consolidated groups from different grouping strategies
     * @param {Object} groupedFindings - Findings grouped by different strategies
     * @param {Object} context - Additional context
     * @returns {Array} Consolidated groups
     */
    createConsolidatedGroups(groupedFindings, context) {
        const consolidatedGroups = [];

        // Start with category-based groups as primary structure
        Object.values(groupedFindings.byCategory).forEach(categoryGroup => {
            if (categoryGroup.count >= this.consolidationThreshold) {
                const consolidatedGroup = {
                    id: `group-${categoryGroup.category}`,
                    title: this.getCategoryGroupTitle(categoryGroup.category),
                    description: this.getCategoryGroupDescription(categoryGroup.category),
                    primaryGrouping: 'category',
                    category: categoryGroup.category,
                    findings: categoryGroup.findings,
                    count: categoryGroup.count,
                    severity: categoryGroup.maxSeverity,
                    confidence: categoryGroup.avgConfidence,
                    subGroups: this.createSubGroups(categoryGroup.findings),
                    consolidatedRemediation: this.generateGroupRemediation(categoryGroup),
                    estimatedEffort: this.calculateRemediationEffort(categoryGroup.findings),
                    priority: this.calculateGroupPriority(categoryGroup)
                };

                consolidatedGroups.push(consolidatedGroup);
            }
        });

        // Add severity-based groups for high-impact findings
        const criticalAndHigh = [
            ...(groupedFindings.bySeverity.critical?.findings || []),
            ...(groupedFindings.bySeverity.high?.findings || [])
        ];

        if (criticalAndHigh.length >= this.consolidationThreshold) {
            const highImpactGroup = {
                id: 'group-high-impact',
                title: 'High-Impact Security Issues',
                description: 'Critical and high-severity findings requiring immediate attention',
                primaryGrouping: 'severity',
                category: 'high-impact',
                findings: criticalAndHigh,
                count: criticalAndHigh.length,
                severity: 'critical',
                confidence: this.calculateAverageConfidence(criticalAndHigh),
                subGroups: this.createSubGroups(criticalAndHigh, 'type'),
                consolidatedRemediation: this.generateHighImpactRemediation(criticalAndHigh),
                estimatedEffort: 'high',
                priority: 1
            };

            consolidatedGroups.push(highImpactGroup);
        }

        // Sort groups by priority
        consolidatedGroups.sort((a, b) => (a.priority || 10) - (b.priority || 10));

        return consolidatedGroups;
    }

    /**
     * Create sub-groups within a main group
     * @param {Array} findings - Findings to sub-group
     * @param {string} strategy - Sub-grouping strategy
     * @returns {Array} Sub-groups
     */
    createSubGroups(findings, strategy = 'type') {
        const subGroups = [];

        if (strategy === 'type') {
            const typeGroups = this.groupByType(findings);
            Object.values(typeGroups).forEach(typeGroup => {
                if (typeGroup.count >= 2) { // Lower threshold for sub-groups
                    subGroups.push({
                        id: `subgroup-${typeGroup.type.replace(/\s+/g, '-').toLowerCase()}`,
                        title: typeGroup.type,
                        findings: typeGroup.findings,
                        count: typeGroup.count,
                        pattern: typeGroup.commonPattern
                    });
                }
            });
        } else if (strategy === 'location') {
            const locationGroups = this.groupByLocation(findings);
            Object.values(locationGroups).forEach(locationGroup => {
                if (locationGroup.count >= 2) {
                    subGroups.push({
                        id: `subgroup-${locationGroup.location.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                        title: `Issues in ${locationGroup.location}`,
                        findings: locationGroup.findings,
                        count: locationGroup.count,
                        fileType: locationGroup.fileType
                    });
                }
            });
        }

        return subGroups;
    }

    /**
     * Generate consolidated remediation strategies
     * @param {Array} groups - Consolidated groups
     * @param {Object} context - Additional context
     * @returns {Object} Consolidated remediation strategies
     */
    generateConsolidatedRemediation(groups, context) {
        const remediation = {
            overview: 'Consolidated remediation strategy for all identified security issues',
            phases: [],
            totalEstimatedEffort: 'medium',
            timeline: {},
            dependencies: [],
            resources: []
        };

        // Phase 1: Critical and immediate actions
        const criticalActions = this.extractCriticalActions(groups);
        if (criticalActions.length > 0) {
            remediation.phases.push({
                phase: 1,
                title: 'Critical Security Issues - Immediate Action Required',
                timeframe: 'Immediate (within hours)',
                priority: 'critical',
                actions: criticalActions,
                estimatedEffort: 'high',
                dependencies: []
            });
        }

        // Phase 2: High-priority remediation
        const highPriorityActions = this.extractHighPriorityActions(groups);
        if (highPriorityActions.length > 0) {
            remediation.phases.push({
                phase: 2,
                title: 'High-Priority Security Improvements',
                timeframe: 'Short-term (within days)',
                priority: 'high',
                actions: highPriorityActions,
                estimatedEffort: 'medium',
                dependencies: ['Phase 1 completion']
            });
        }

        // Phase 3: Medium-priority improvements
        const mediumPriorityActions = this.extractMediumPriorityActions(groups);
        if (mediumPriorityActions.length > 0) {
            remediation.phases.push({
                phase: 3,
                title: 'Security Posture Improvements',
                timeframe: 'Medium-term (within weeks)',
                priority: 'medium',
                actions: mediumPriorityActions,
                estimatedEffort: 'medium',
                dependencies: ['Phase 2 completion']
            });
        }

        // Phase 4: Long-term security practices
        remediation.phases.push({
            phase: 4,
            title: 'Long-term Security Practices',
            timeframe: 'Ongoing',
            priority: 'low',
            actions: [
                'Implement automated security testing in CI/CD pipeline',
                'Establish regular security review processes',
                'Provide security training for development team',
                'Set up continuous security monitoring'
            ],
            estimatedEffort: 'low',
            dependencies: ['Phase 3 completion']
        });

        // Calculate overall effort and timeline
        remediation.totalEstimatedEffort = this.calculateOverallEffort(remediation.phases);
        remediation.timeline = this.generateTimeline(remediation.phases);
        remediation.dependencies = this.identifyDependencies(groups);
        remediation.resources = this.identifyRequiredResources(groups);

        return remediation;
    }

    /**
     * Generate frontend-specific guidance
     * @param {Array} findings - Security findings
     * @param {Object} context - Additional context
     * @returns {Object} Frontend-specific guidance
     */
    generateFrontendGuidance(findings, context) {
        const frontendFindings = this.identifyFrontendFindings(findings);

        if (frontendFindings.length === 0) {
            return null;
        }

        const guidance = {
            overview: 'Frontend-specific security guidance for identified issues',
            uiComponents: {},
            userExperience: {},
            implementation: {},
            testing: {},
            monitoring: {}
        };

        // Group frontend findings by UI impact
        const uiImpactGroups = this.groupFrontendFindingsByUIImpact(frontendFindings);

        Object.entries(uiImpactGroups).forEach(([impact, impactFindings]) => {
            guidance.uiComponents[impact] = this.generateUIComponentGuidance(impactFindings);
            guidance.userExperience[impact] = this.generateUXGuidance(impactFindings);
            guidance.implementation[impact] = this.generateFrontendImplementationGuidance(impactFindings);
        });

        // Add testing guidance
        guidance.testing = this.generateFrontendTestingGuidance(frontendFindings);

        // Add monitoring guidance
        guidance.monitoring = this.generateFrontendMonitoringGuidance(frontendFindings);

        return guidance;
    }

    /**
     * Calculate consolidation statistics
     * @param {Array} originalFindings - Original findings
     * @param {Array} groups - Consolidated groups
     * @returns {Object} Consolidation statistics
     */
    calculateConsolidationStatistics(originalFindings, groups) {
        const stats = {
            originalCount: originalFindings.length,
            groupCount: groups.length,
            consolidationRatio: groups.length > 0 ? Math.round((originalFindings.length / groups.length) * 100) / 100 : 0,
            averageGroupSize: groups.length > 0 ? Math.round((originalFindings.length / groups.length) * 100) / 100 : 0,
            largestGroup: 0,
            smallestGroup: originalFindings.length,
            groupDistribution: {},
            severityDistribution: {},
            categoryDistribution: {}
        };

        // Calculate group size statistics
        groups.forEach(group => {
            stats.largestGroup = Math.max(stats.largestGroup, group.count);
            stats.smallestGroup = Math.min(stats.smallestGroup, group.count);

            // Group distribution by size
            const sizeRange = this.getGroupSizeRange(group.count);
            stats.groupDistribution[sizeRange] = (stats.groupDistribution[sizeRange] || 0) + 1;

            // Severity distribution
            stats.severityDistribution[group.severity] = (stats.severityDistribution[group.severity] || 0) + group.count;

            // Category distribution
            stats.categoryDistribution[group.category] = (stats.categoryDistribution[group.category] || 0) + group.count;
        });

        return stats;
    }

    // Helper methods

    /**
     * Extract location key from finding
     * @param {Object} finding - Security finding
     * @returns {string} Location key
     */
    extractLocationKey(finding) {
        if (finding.location?.file) {
            return finding.location.file;
        } else if (finding.file) {
            return finding.file;
        } else if (finding.location?.url) {
            return finding.location.url;
        } else {
            return 'unknown';
        }
    }

    /**
     * Get file type from location
     * @param {string} location - File location
     * @returns {string} File type
     */
    getFileType(location) {
        const extension = location.split('.').pop()?.toLowerCase();
        const typeMap = {
            js: 'javascript',
            ts: 'typescript',
            html: 'html',
            css: 'stylesheet',
            json: 'configuration',
            env: 'environment',
            config: 'configuration',
            yml: 'configuration',
            yaml: 'configuration'
        };

        return typeMap[extension] || 'unknown';
    }

    /**
     * Get maximum severity between two severities
     * @param {Array} severities - Array of severity levels
     * @returns {string} Maximum severity
     */
    getMaxSeverity(severities) {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        let maxSeverity = 'low';
        let maxValue = 1;

        severities.forEach(severity => {
            const value = severityOrder[severity] || 2;
            if (value > maxValue) {
                maxValue = value;
                maxSeverity = severity;
            }
        });

        return maxSeverity;
    }

    /**
     * Identify common pattern in findings
     * @param {Array} findings - Findings to analyze
     * @returns {string} Common pattern description
     */
    identifyCommonPattern(findings) {
        if (findings.length < 2) return null;

        // Look for common patterns in finding types, locations, or values
        const types = findings.map(f => f.type).filter(Boolean);
        const locations = findings.map(f => this.extractLocationKey(f));
        const categories = findings.map(f => f.category).filter(Boolean);

        // Check if all findings have the same type
        if (types.length > 1 && new Set(types).size === 1) {
            return `Multiple instances of ${types[0]}`;
        }

        // Check if all findings are in the same location
        if (locations.length > 1 && new Set(locations).size === 1) {
            return `Multiple issues in ${locations[0]}`;
        }

        // Check if all findings are in the same category
        if (categories.length > 1 && new Set(categories).size === 1) {
            return `Multiple ${categories[0]} issues`;
        }

        return 'Related security issues';
    }

    /**
     * Identify finding pattern for grouping
     * @param {Object} finding - Security finding
     * @returns {string} Pattern identifier
     */
    identifyFindingPattern(finding) {
        const category = finding.category || 'unknown';
        const type = finding.type || 'unknown';
        const severity = finding.severity || 'medium';

        // Create pattern based on category and type
        return `${category}-${type.replace(/\s+/g, '-').toLowerCase()}`;
    }

    /**
     * Get pattern description
     * @param {string} pattern - Pattern identifier
     * @returns {string} Pattern description
     */
    getPatternDescription(pattern) {
        const descriptions = {
            'secrets-api-key': 'Exposed API keys and authentication tokens',
            'headers-missing-csp': 'Missing Content Security Policy headers',
            'headers-missing-hsts': 'Missing HTTP Strict Transport Security headers',
            'files-exposed-config': 'Exposed configuration files',
            'owasp-injection': 'Injection vulnerabilities',
            'owasp-access-control': 'Access control issues'
        };

        return descriptions[pattern] || 'Related security issues';
    }

    /**
     * Get remediation strategy for finding
     * @param {Object} finding - Security finding
     * @returns {string} Remediation strategy
     */
    getRemediationStrategy(finding) {
        const category = finding.category || 'unknown';
        const severity = finding.severity || 'medium';

        if (category === 'secrets') {
            return 'credential-rotation';
        } else if (category === 'headers') {
            return 'security-headers';
        } else if (category === 'files') {
            return 'access-control';
        } else if (category === 'owasp') {
            return 'vulnerability-patching';
        } else if (severity === 'critical') {
            return 'immediate-action';
        } else {
            return 'general-security';
        }
    }

    /**
     * Get strategy priority
     * @param {string} strategy - Remediation strategy
     * @returns {number} Priority level (1 = highest)
     */
    getStrategyPriority(strategy) {
        const priorities = {
            'immediate-action': 1,
            'credential-rotation': 2,
            'vulnerability-patching': 3,
            'access-control': 4,
            'security-headers': 5,
            'general-security': 6
        };

        return priorities[strategy] || 10;
    }

    /**
     * Calculate remediation effort
     * @param {Array} findings - Findings to assess
     * @returns {string} Effort level
     */
    calculateRemediationEffort(findings) {
        const criticalCount = findings.filter(f => f.severity === 'critical').length;
        const highCount = findings.filter(f => f.severity === 'high').length;
        const totalCount = findings.length;

        if (criticalCount > 5 || totalCount > 20) {
            return 'high';
        } else if (criticalCount > 0 || highCount > 5 || totalCount > 10) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Calculate average confidence
     * @param {Array} findings - Findings to assess
     * @returns {number} Average confidence
     */
    calculateAverageConfidence(findings) {
        if (findings.length === 0) return 0;

        const totalConfidence = findings.reduce((sum, f) => sum + (f.confidence || 0.5), 0);
        return Math.round((totalConfidence / findings.length) * 100) / 100;
    }

    /**
     * Get category group title
     * @param {string} category - Category name
     * @returns {string} Group title
     */
    getCategoryGroupTitle(category) {
        const titles = {
            secrets: 'Exposed Secrets and Credentials',
            headers: 'Security Header Issues',
            files: 'Exposed Files and Directories',
            owasp: 'OWASP Top 10 Vulnerabilities',
            misconfig: 'Security Misconfigurations'
        };

        return titles[category] || `${category.charAt(0).toUpperCase() + category.slice(1)} Issues`;
    }

    /**
     * Get category group description
     * @param {string} category - Category name
     * @returns {string} Group description
     */
    getCategoryGroupDescription(category) {
        const descriptions = {
            secrets: 'API keys, passwords, and other credentials that are exposed and need immediate rotation',
            headers: 'Missing or misconfigured HTTP security headers that leave the application vulnerable',
            files: 'Sensitive files and directories that are accessible and should be protected',
            owasp: 'Vulnerabilities from the OWASP Top 10 list that represent critical security risks',
            misconfig: 'Security misconfigurations that weaken the application\'s security posture'
        };

        return descriptions[category] || `Security issues related to ${category}`;
    }

    /**
     * Generate group remediation
     * @param {Object} group - Finding group
     * @returns {Object} Group remediation strategy
     */
    generateGroupRemediation(group) {
        const category = group.category;
        const count = group.count;
        const severity = group.maxSeverity;

        const remediation = {
            strategy: this.getRemediationStrategy({ category, severity }),
            priority: this.getStrategyPriority(this.getRemediationStrategy({ category, severity })),
            actions: [],
            timeline: 'medium-term',
            effort: this.calculateRemediationEffort(group.findings)
        };

        // Category-specific remediation actions
        if (category === 'secrets') {
            remediation.actions = [
                `Rotate all ${count} exposed credentials immediately`,
                'Implement secure secret management system',
                'Add secret scanning to CI/CD pipeline',
                'Audit code for additional hardcoded secrets'
            ];
            remediation.timeline = 'immediate';
        } else if (category === 'headers') {
            remediation.actions = [
                `Configure ${count} missing security headers`,
                'Implement comprehensive security header policy',
                'Test header configuration across all endpoints',
                'Set up monitoring for header compliance'
            ];
        } else if (category === 'files') {
            remediation.actions = [
                `Secure ${count} exposed files and directories`,
                'Configure web server access controls',
                'Review deployment process for sensitive files',
                'Implement file access monitoring'
            ];
        } else if (category === 'owasp') {
            remediation.actions = [
                `Address ${count} OWASP vulnerabilities`,
                'Implement secure coding practices',
                'Conduct security code review',
                'Add automated vulnerability scanning'
            ];
        }

        return remediation;
    }

    /**
     * Calculate group priority
     * @param {Object} group - Finding group
     * @returns {number} Priority level
     */
    calculateGroupPriority(group) {
        const severityPriority = { critical: 1, high: 2, medium: 3, low: 4 };
        const categoryPriority = { secrets: 1, owasp: 2, files: 3, headers: 4, misconfig: 5 };

        const severityScore = severityPriority[group.maxSeverity] || 3;
        const categoryScore = categoryPriority[group.category] || 5;
        const countScore = Math.min(group.count / 5, 2); // More findings = higher priority

        return Math.round(severityScore + categoryScore - countScore);
    }

    /**
     * Generate high-impact remediation strategy
     * @param {Array} findings - High-impact findings
     * @returns {Object} High-impact remediation strategy
     */
    generateHighImpactRemediation(findings) {
        return {
            strategy: 'immediate-action',
            priority: 1,
            actions: [
                'Address all critical and high-severity issues immediately',
                'Implement emergency security measures',
                'Conduct thorough security review',
                'Notify stakeholders of security risks'
            ],
            timeline: 'immediate',
            effort: 'high'
        };
    }

    // Additional helper methods for consolidation

    extractCriticalActions(groups) {
        const actions = [];
        groups.forEach(group => {
            if (group.severity === 'critical') {
                actions.push(`Address ${group.count} critical ${group.category} issues: ${group.title}`);
            }
        });
        return actions;
    }

    extractHighPriorityActions(groups) {
        const actions = [];
        groups.forEach(group => {
            if (group.severity === 'high') {
                actions.push(`Resolve ${group.count} high-priority ${group.category} issues: ${group.title}`);
            }
        });
        return actions;
    }

    extractMediumPriorityActions(groups) {
        const actions = [];
        groups.forEach(group => {
            if (group.severity === 'medium') {
                actions.push(`Improve ${group.count} medium-priority ${group.category} issues: ${group.title}`);
            }
        });
        return actions;
    }

    calculateOverallEffort(phases) {
        const effortScores = { low: 1, medium: 2, high: 3 };
        let totalScore = 0;
        let phaseCount = 0;

        phases.forEach(phase => {
            totalScore += effortScores[phase.estimatedEffort] || 2;
            phaseCount++;
        });

        const avgScore = totalScore / phaseCount;
        if (avgScore >= 2.5) return 'high';
        if (avgScore >= 1.5) return 'medium';
        return 'low';
    }

    generateTimeline(phases) {
        return {
            immediate: phases.filter(p => p.timeframe.includes('Immediate')).length,
            shortTerm: phases.filter(p => p.timeframe.includes('Short-term')).length,
            mediumTerm: phases.filter(p => p.timeframe.includes('Medium-term')).length,
            longTerm: phases.filter(p => p.timeframe.includes('Ongoing')).length
        };
    }

    identifyDependencies(groups) {
        const dependencies = [];

        // Secrets must be rotated before other security measures
        const hasSecrets = groups.some(g => g.category === 'secrets');
        const hasOther = groups.some(g => g.category !== 'secrets');

        if (hasSecrets && hasOther) {
            dependencies.push('Secret rotation must be completed before implementing other security measures');
        }

        return dependencies;
    }

    identifyRequiredResources(groups) {
        const resources = new Set();

        groups.forEach(group => {
            if (group.category === 'secrets') {
                resources.add('Access to service provider dashboards for credential rotation');
                resources.add('Secret management system (e.g., HashiCorp Vault, AWS Secrets Manager)');
            } else if (group.category === 'headers') {
                resources.add('Web server configuration access');
                resources.add('Security header testing tools');
            } else if (group.category === 'owasp') {
                resources.add('Security testing tools and expertise');
                resources.add('Code review and security audit capabilities');
            }
        });

        return Array.from(resources);
    }

    identifyFrontendFindings(findings) {
        return findings.filter(finding => {
            const location = this.extractLocationKey(finding);
            const fileType = this.getFileType(location);

            return fileType === 'javascript' ||
                fileType === 'typescript' ||
                fileType === 'html' ||
                fileType === 'stylesheet' ||
                finding.category === 'headers' ||
                (finding.type && finding.type.includes('XSS')) ||
                (finding.type && finding.type.includes('CSP'));
        });
    }

    groupFrontendFindingsByUIImpact(findings) {
        const groups = {
            high: [],
            medium: [],
            low: []
        };

        findings.forEach(finding => {
            const impact = this.assessUIImpact(finding);
            groups[impact].push(finding);
        });

        return groups;
    }

    assessUIImpact(finding) {
        if (finding.type?.includes('XSS') || finding.type?.includes('CSP')) {
            return 'high';
        } else if (finding.category === 'headers') {
            return 'medium';
        } else {
            return 'low';
        }
    }

    generateUIComponentGuidance(findings) {
        return {
            affectedComponents: findings.map(f => this.extractLocationKey(f)),
            recommendations: [
                'Review UI components for security vulnerabilities',
                'Implement proper input sanitization',
                'Use secure coding practices for frontend development'
            ]
        };
    }

    generateUXGuidance(findings) {
        return {
            userImpact: 'Security measures should not negatively impact user experience',
            recommendations: [
                'Implement security measures transparently',
                'Provide clear error messages for security-related issues',
                'Ensure security controls don\'t break functionality'
            ]
        };
    }

    generateFrontendImplementationGuidance(findings) {
        return {
            frameworks: ['React', 'Vue', 'Angular'],
            recommendations: [
                'Use framework-specific security features',
                'Implement Content Security Policy',
                'Sanitize user inputs properly',
                'Use HTTPS for all communications'
            ]
        };
    }

    generateFrontendTestingGuidance(findings) {
        return {
            testTypes: ['Unit tests', 'Integration tests', 'Security tests'],
            tools: ['Jest', 'Cypress', 'OWASP ZAP'],
            recommendations: [
                'Add security-focused test cases',
                'Test CSP implementation',
                'Verify input sanitization',
                'Test for XSS vulnerabilities'
            ]
        };
    }

    generateFrontendMonitoringGuidance(findings) {
        return {
            metrics: ['CSP violations', 'XSS attempts', 'Security header compliance'],
            tools: ['Browser DevTools', 'Security monitoring services'],
            recommendations: [
                'Monitor CSP violation reports',
                'Track security-related errors',
                'Set up alerts for security issues',
                'Regular security audits'
            ]
        };
    }

    getGroupSizeRange(count) {
        if (count <= 2) return 'small';
        if (count <= 5) return 'medium';
        if (count <= 10) return 'large';
        return 'very-large';
    }

    // Initialize methods

    initializeGroupingRules() {
        return {
            categoryRules: {
                secrets: { priority: 1, consolidationThreshold: 1 },
                owasp: { priority: 2, consolidationThreshold: 2 },
                files: { priority: 3, consolidationThreshold: 2 },
                headers: { priority: 4, consolidationThreshold: 3 }
            },
            severityRules: {
                critical: { priority: 1, immediateAction: true },
                high: { priority: 2, immediateAction: false },
                medium: { priority: 3, immediateAction: false },
                low: { priority: 4, immediateAction: false }
            }
        };
    }

    initializeConsolidationPatterns() {
        return {
            secretPatterns: [
                'Multiple API keys in same file',
                'Credentials across multiple files',
                'Same credential type repeated'
            ],
            headerPatterns: [
                'Missing security headers on multiple endpoints',
                'Inconsistent header configuration',
                'Multiple CSP violations'
            ],
            owaspPatterns: [
                'Multiple injection points',
                'Consistent access control issues',
                'Related vulnerability types'
            ]
        };
    }

    initializeFrontendGuidanceTemplates() {
        return {
            react: {
                security: 'Use React security best practices',
                csp: 'Configure CSP for React applications',
                sanitization: 'Use DOMPurify for HTML sanitization'
            },
            vue: {
                security: 'Implement Vue.js security guidelines',
                csp: 'Configure CSP for Vue applications',
                sanitization: 'Use v-html carefully with sanitization'
            },
            angular: {
                security: 'Follow Angular security recommendations',
                csp: 'Configure CSP for Angular applications',
                sanitization: 'Use Angular\'s built-in sanitization'
            }
        };
    }
}

module.exports = { FindingConsolidationService };