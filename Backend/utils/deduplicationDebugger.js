/**
 * DeduplicationDebugger - Advanced debugging and analysis tools for deduplication
 * Provides detailed analysis, visualization, and troubleshooting capabilities
 */

const fs = require('fs-extra');
const path = require('path');

class DeduplicationDebugger {
    constructor(options = {}) {
        this.options = {
            // Analysis options
            enableDetailedAnalysis: options.enableDetailedAnalysis !== false,
            enableFingerprintAnalysis: options.enableFingerprintAnalysis !== false,
            enablePerformanceAnalysis: options.enablePerformanceAnalysis !== false,

            // Output options
            outputDirectory: options.outputDirectory || path.join(__dirname, '..', 'debug', 'deduplication'),
            enableFileOutput: options.enableFileOutput !== false,
            enableConsoleOutput: options.enableConsoleOutput !== false,

            // Analysis thresholds
            duplicateThreshold: options.duplicateThreshold || 0.1, // 10% duplicate rate threshold
            performanceThreshold: options.performanceThreshold || 2000, // 2 second threshold

            ...options
        };

        // Analysis data storage
        this.analysisData = {
            operations: [],
            fingerprints: new Map(),
            duplicatePatterns: new Map(),
            performanceIssues: [],
            recommendations: []
        };

        // Initialize debug infrastructure
        this.initializeDebugger();
    }

    /**
     * Initialize debugger infrastructure
     */
    async initializeDebugger() {
        if (this.options.enableFileOutput) {
            try {
                await fs.ensureDir(this.options.outputDirectory);
            } catch (error) {
                console.error('Failed to initialize debug output directory:', error.message);
                this.options.enableFileOutput = false;
            }
        }
    }

    /**
     * Analyze deduplication operation
     * @param {Object} operationData - Operation data to analyze
     * @returns {Object} Analysis results
     */
    analyzeOperation(operationData) {
        const analysis = {
            timestamp: Date.now(),
            operationType: operationData.type || 'unknown',
            findings: operationData.findings || [],
            result: operationData.result || {},
            performance: operationData.performance || {},
            issues: [],
            recommendations: []
        };

        // Store operation for historical analysis
        this.analysisData.operations.push(analysis);

        // Perform various analyses
        if (this.options.enableDetailedAnalysis) {
            this.analyzeDeduplicationEffectiveness(analysis);
            this.analyzeFindingDistribution(analysis);
            this.analyzePatternEffectiveness(analysis);
        }

        if (this.options.enableFingerprintAnalysis) {
            this.analyzeFingerprintCollisions(analysis);
            this.analyzeFingerprintDistribution(analysis);
        }

        if (this.options.enablePerformanceAnalysis) {
            this.analyzePerformanceMetrics(analysis);
            this.analyzeMemoryUsage(analysis);
        }

        // Generate recommendations
        this.generateRecommendations(analysis);

        // Output analysis if enabled
        if (this.options.enableConsoleOutput) {
            this.outputAnalysisToConsole(analysis);
        }

        if (this.options.enableFileOutput) {
            this.outputAnalysisToFile(analysis);
        }

        return analysis;
    }

    /**
     * Analyze deduplication effectiveness
     * @param {Object} analysis - Analysis object to update
     */
    analyzeDeduplicationEffectiveness(analysis) {
        const { findings, result } = analysis;

        if (!findings.length || !result.totalFindings) {
            return;
        }

        const duplicateRate = result.duplicatesRemoved / result.totalFindings;
        const uniqueRate = result.uniqueFindings / result.totalFindings;

        analysis.effectiveness = {
            duplicateRate,
            uniqueRate,
            duplicatesRemoved: result.duplicatesRemoved,
            totalFindings: result.totalFindings,
            uniqueFindings: result.uniqueFindings
        };

        // Check for issues
        if (duplicateRate > this.options.duplicateThreshold) {
            analysis.issues.push({
                type: 'high_duplicate_rate',
                severity: 'warning',
                message: `High duplicate rate detected: ${(duplicateRate * 100).toFixed(1)}%`,
                data: { duplicateRate, threshold: this.options.duplicateThreshold }
            });
        }

        if (duplicateRate === 0 && result.totalFindings > 10) {
            analysis.issues.push({
                type: 'no_duplicates_found',
                severity: 'info',
                message: 'No duplicates found - this may indicate deduplication is not working or findings are truly unique',
                data: { totalFindings: result.totalFindings }
            });
        }
    }

    /**
     * Analyze finding distribution patterns
     * @param {Object} analysis - Analysis object to update
     */
    analyzeFindingDistribution(analysis) {
        const { findings } = analysis;

        if (!findings.length) {
            return;
        }

        const distribution = {
            byPattern: new Map(),
            byFile: new Map(),
            bySeverity: new Map(),
            byConfidence: new Map()
        };

        findings.forEach(finding => {
            // Pattern distribution
            const patternId = finding.pattern?.id || 'unknown';
            distribution.byPattern.set(patternId, (distribution.byPattern.get(patternId) || 0) + 1);

            // File distribution
            const file = finding.file || 'unknown';
            distribution.byFile.set(file, (distribution.byFile.get(file) || 0) + 1);

            // Severity distribution
            const severity = finding.severity || 'unknown';
            distribution.bySeverity.set(severity, (distribution.bySeverity.get(severity) || 0) + 1);

            // Confidence distribution
            const confidenceRange = this.getConfidenceRange(finding.confidence);
            distribution.byConfidence.set(confidenceRange, (distribution.byConfidence.get(confidenceRange) || 0) + 1);
        });

        analysis.distribution = {
            byPattern: Object.fromEntries(distribution.byPattern),
            byFile: Object.fromEntries(distribution.byFile),
            bySeverity: Object.fromEntries(distribution.bySeverity),
            byConfidence: Object.fromEntries(distribution.byConfidence)
        };

        // Identify patterns with high duplicate potential
        const highDuplicatePatterns = Array.from(distribution.byPattern.entries())
            .filter(([pattern, count]) => count > 5)
            .sort((a, b) => b[1] - a[1]);

        if (highDuplicatePatterns.length > 0) {
            analysis.issues.push({
                type: 'high_duplicate_patterns',
                severity: 'info',
                message: `Patterns with high occurrence counts detected`,
                data: { patterns: highDuplicatePatterns.slice(0, 5) }
            });
        }
    }

    /**
     * Analyze pattern effectiveness for deduplication
     * @param {Object} analysis - Analysis object to update
     */
    analyzePatternEffectiveness(analysis) {
        const { findings, result } = analysis;

        if (!findings.length) {
            return;
        }

        const patternStats = new Map();

        findings.forEach(finding => {
            const patternId = finding.pattern?.id || 'unknown';
            if (!patternStats.has(patternId)) {
                patternStats.set(patternId, {
                    totalFindings: 0,
                    uniqueValues: new Set(),
                    files: new Set(),
                    severities: new Set(),
                    confidences: []
                });
            }

            const stats = patternStats.get(patternId);
            stats.totalFindings++;
            stats.uniqueValues.add(finding.value);
            stats.files.add(finding.file);
            stats.severities.add(finding.severity);
            stats.confidences.push(finding.confidence || 0);
        });

        // Calculate effectiveness metrics for each pattern
        const patternEffectiveness = Array.from(patternStats.entries()).map(([patternId, stats]) => {
            const uniqueValueRate = stats.uniqueValues.size / stats.totalFindings;
            const fileSpread = stats.files.size;
            const avgConfidence = stats.confidences.reduce((sum, c) => sum + c, 0) / stats.confidences.length;

            return {
                patternId,
                totalFindings: stats.totalFindings,
                uniqueValues: stats.uniqueValues.size,
                uniqueValueRate,
                fileSpread,
                avgConfidence,
                severities: Array.from(stats.severities),
                duplicatePotential: 1 - uniqueValueRate // Higher when more duplicates expected
            };
        });

        analysis.patternEffectiveness = patternEffectiveness.sort((a, b) => b.duplicatePotential - a.duplicatePotential);

        // Identify patterns with low deduplication effectiveness
        const ineffectivePatterns = patternEffectiveness.filter(p => p.uniqueValueRate > 0.9 && p.totalFindings > 3);
        if (ineffectivePatterns.length > 0) {
            analysis.issues.push({
                type: 'ineffective_patterns',
                severity: 'info',
                message: `Patterns with low duplicate potential detected`,
                data: { patterns: ineffectivePatterns.slice(0, 3) }
            });
        }
    }

    /**
     * Analyze fingerprint collisions and distribution
     * @param {Object} analysis - Analysis object to update
     */
    analyzeFingerprintCollisions(analysis) {
        const { findings } = analysis;

        if (!findings.length) {
            return;
        }

        const fingerprintMap = new Map();
        const collisions = [];

        findings.forEach(finding => {
            // Generate a simple fingerprint for analysis
            const fingerprint = this.generateAnalysisFingerprint(finding);

            if (fingerprintMap.has(fingerprint)) {
                const existing = fingerprintMap.get(fingerprint);
                collisions.push({
                    fingerprint,
                    findings: [existing, finding],
                    isLegitimateCollision: this.isLegitimateCollision(existing, finding)
                });
            } else {
                fingerprintMap.set(fingerprint, finding);
            }

            // Store fingerprint for global analysis
            this.analysisData.fingerprints.set(fingerprint, finding);
        });

        analysis.fingerprints = {
            totalUnique: fingerprintMap.size,
            totalFindings: findings.length,
            collisions: collisions.length,
            collisionRate: collisions.length / findings.length,
            legitimateCollisions: collisions.filter(c => c.isLegitimateCollision).length,
            falseCollisions: collisions.filter(c => !c.isLegitimateCollision).length
        };

        // Check for fingerprint issues
        if (collisions.length > 0) {
            const falseCollisions = collisions.filter(c => !c.isLegitimateCollision);
            if (falseCollisions.length > 0) {
                analysis.issues.push({
                    type: 'fingerprint_false_collisions',
                    severity: 'warning',
                    message: `Potential false fingerprint collisions detected`,
                    data: {
                        falseCollisions: falseCollisions.length,
                        totalCollisions: collisions.length,
                        examples: falseCollisions.slice(0, 2)
                    }
                });
            }
        }
    }

    /**
     * Analyze fingerprint distribution patterns
     * @param {Object} analysis - Analysis object to update
     */
    analyzeFingerprintDistribution(analysis) {
        const { findings } = analysis;

        if (!findings.length) {
            return;
        }

        const distribution = {
            lengthDistribution: new Map(),
            prefixDistribution: new Map(),
            patternDistribution: new Map()
        };

        findings.forEach(finding => {
            const fingerprint = this.generateAnalysisFingerprint(finding);

            // Length distribution
            const length = fingerprint.length;
            distribution.lengthDistribution.set(length, (distribution.lengthDistribution.get(length) || 0) + 1);

            // Prefix distribution (first 8 characters)
            const prefix = fingerprint.substring(0, 8);
            distribution.prefixDistribution.set(prefix, (distribution.prefixDistribution.get(prefix) || 0) + 1);

            // Pattern-based distribution
            const patternId = finding.pattern?.id || 'unknown';
            if (!distribution.patternDistribution.has(patternId)) {
                distribution.patternDistribution.set(patternId, new Set());
            }
            distribution.patternDistribution.get(patternId).add(fingerprint);
        });

        analysis.fingerprintDistribution = {
            lengthDistribution: Object.fromEntries(distribution.lengthDistribution),
            prefixDistribution: Object.fromEntries(distribution.prefixDistribution),
            patternDistribution: Object.fromEntries(
                Array.from(distribution.patternDistribution.entries()).map(([pattern, fingerprints]) => [
                    pattern,
                    fingerprints.size
                ])
            )
        };
    }

    /**
     * Analyze performance metrics
     * @param {Object} analysis - Analysis object to update
     */
    analyzePerformanceMetrics(analysis) {
        const { performance } = analysis;

        if (!performance.duration) {
            return;
        }

        const perfAnalysis = {
            duration: performance.duration,
            findingsPerSecond: analysis.result.totalFindings / (performance.duration / 1000),
            memoryEfficiency: performance.memoryUsage ?
                analysis.result.totalFindings / (performance.memoryUsage / 1024 / 1024) : null,
            isSlowOperation: performance.duration > this.options.performanceThreshold
        };

        analysis.performance = { ...performance, ...perfAnalysis };

        // Check for performance issues
        if (perfAnalysis.isSlowOperation) {
            analysis.issues.push({
                type: 'slow_operation',
                severity: 'warning',
                message: `Slow deduplication operation: ${performance.duration}ms`,
                data: {
                    duration: performance.duration,
                    threshold: this.options.performanceThreshold,
                    findingsPerSecond: perfAnalysis.findingsPerSecond
                }
            });

            this.analysisData.performanceIssues.push({
                timestamp: Date.now(),
                operationType: analysis.operationType,
                duration: performance.duration,
                findingsCount: analysis.result.totalFindings,
                memoryUsage: performance.memoryUsage
            });
        }

        if (perfAnalysis.findingsPerSecond < 100) {
            analysis.issues.push({
                type: 'low_throughput',
                severity: 'info',
                message: `Low processing throughput: ${perfAnalysis.findingsPerSecond.toFixed(1)} findings/sec`,
                data: { findingsPerSecond: perfAnalysis.findingsPerSecond }
            });
        }
    }

    /**
     * Analyze memory usage patterns
     * @param {Object} analysis - Analysis object to update
     */
    analyzeMemoryUsage(analysis) {
        const { performance } = analysis;

        if (!performance.memoryUsage) {
            return;
        }

        const memoryMB = performance.memoryUsage / (1024 * 1024);
        const memoryPerFinding = performance.memoryUsage / analysis.result.totalFindings;

        analysis.memoryAnalysis = {
            totalMemoryMB: memoryMB,
            memoryPerFinding,
            memoryEfficiency: analysis.result.totalFindings / memoryMB,
            isHighMemoryUsage: memoryMB > 100 // 100MB threshold
        };

        if (analysis.memoryAnalysis.isHighMemoryUsage) {
            analysis.issues.push({
                type: 'high_memory_usage',
                severity: 'warning',
                message: `High memory usage: ${memoryMB.toFixed(1)}MB`,
                data: {
                    memoryMB,
                    memoryPerFinding,
                    totalFindings: analysis.result.totalFindings
                }
            });
        }
    }

    /**
     * Generate recommendations based on analysis
     * @param {Object} analysis - Analysis object to update
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        // Performance recommendations
        if (analysis.performance?.isSlowOperation) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Consider optimizing deduplication algorithm or reducing batch size',
                details: {
                    currentDuration: analysis.performance.duration,
                    suggestedActions: [
                        'Reduce batch size for processing',
                        'Implement parallel processing',
                        'Optimize fingerprint generation',
                        'Add caching for repeated operations'
                    ]
                }
            });
        }

        // Memory recommendations
        if (analysis.memoryAnalysis?.isHighMemoryUsage) {
            recommendations.push({
                type: 'memory',
                priority: 'medium',
                message: 'High memory usage detected - consider memory optimization',
                details: {
                    currentMemoryMB: analysis.memoryAnalysis.totalMemoryMB,
                    suggestedActions: [
                        'Implement streaming processing',
                        'Clear caches more frequently',
                        'Process findings in smaller batches',
                        'Optimize data structures'
                    ]
                }
            });
        }

        // Effectiveness recommendations
        if (analysis.effectiveness?.duplicateRate > 0.3) {
            recommendations.push({
                type: 'effectiveness',
                priority: 'medium',
                message: 'High duplicate rate suggests potential for better deduplication',
                details: {
                    duplicateRate: analysis.effectiveness.duplicateRate,
                    suggestedActions: [
                        'Review fingerprint generation logic',
                        'Consider additional normalization',
                        'Analyze patterns with high duplicate rates',
                        'Implement more aggressive deduplication'
                    ]
                }
            });
        }

        // Fingerprint recommendations
        if (analysis.fingerprints?.falseCollisions > 0) {
            recommendations.push({
                type: 'fingerprint',
                priority: 'high',
                message: 'False fingerprint collisions detected',
                details: {
                    falseCollisions: analysis.fingerprints.falseCollisions,
                    suggestedActions: [
                        'Review fingerprint generation algorithm',
                        'Add more context to fingerprints',
                        'Consider using stronger hash functions',
                        'Implement collision detection and resolution'
                    ]
                }
            });
        }

        analysis.recommendations = recommendations;
        this.analysisData.recommendations.push(...recommendations);
    }

    /**
     * Output analysis to console
     * @param {Object} analysis - Analysis to output
     */
    outputAnalysisToConsole(analysis) {
        console.log('\n=== DEDUPLICATION ANALYSIS ===');
        console.log(`Operation: ${analysis.operationType}`);
        console.log(`Timestamp: ${new Date(analysis.timestamp).toISOString()}`);

        if (analysis.effectiveness) {
            console.log('\n--- Effectiveness ---');
            console.log(`Duplicate Rate: ${(analysis.effectiveness.duplicateRate * 100).toFixed(1)}%`);
            console.log(`Unique Findings: ${analysis.effectiveness.uniqueFindings}`);
            console.log(`Duplicates Removed: ${analysis.effectiveness.duplicatesRemoved}`);
        }

        if (analysis.performance) {
            console.log('\n--- Performance ---');
            console.log(`Duration: ${analysis.performance.duration}ms`);
            if (analysis.performance.findingsPerSecond) {
                console.log(`Throughput: ${analysis.performance.findingsPerSecond.toFixed(1)} findings/sec`);
            }
        }

        if (analysis.issues.length > 0) {
            console.log('\n--- Issues ---');
            analysis.issues.forEach(issue => {
                console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);
            });
        }

        if (analysis.recommendations.length > 0) {
            console.log('\n--- Recommendations ---');
            analysis.recommendations.forEach(rec => {
                console.log(`[${rec.priority.toUpperCase()}] ${rec.message}`);
            });
        }

        console.log('=== END ANALYSIS ===\n');
    }

    /**
     * Output analysis to file
     * @param {Object} analysis - Analysis to output
     */
    async outputAnalysisToFile(analysis) {
        try {
            const filename = `analysis-${analysis.operationType}-${Date.now()}.json`;
            const filepath = path.join(this.options.outputDirectory, filename);

            await fs.writeJson(filepath, analysis, { spaces: 2 });

            // Also create a summary file
            const summaryFilename = `summary-${new Date().toISOString().split('T')[0]}.json`;
            const summaryFilepath = path.join(this.options.outputDirectory, summaryFilename);

            const summary = this.generateDailySummary();
            await fs.writeJson(summaryFilepath, summary, { spaces: 2 });

        } catch (error) {
            console.error('Failed to write analysis to file:', error.message);
        }
    }

    /**
     * Generate daily summary of all analyses
     * @returns {Object} Daily summary
     */
    generateDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        const todayOperations = this.analysisData.operations.filter(op => {
            const opDate = new Date(op.timestamp).toISOString().split('T')[0];
            return opDate === today;
        });

        if (todayOperations.length === 0) {
            return { date: today, operations: 0 };
        }

        const summary = {
            date: today,
            operations: todayOperations.length,
            totalFindings: todayOperations.reduce((sum, op) => sum + (op.result.totalFindings || 0), 0),
            totalDuplicatesRemoved: todayOperations.reduce((sum, op) => sum + (op.result.duplicatesRemoved || 0), 0),
            averageDuplicateRate: todayOperations.reduce((sum, op) => sum + (op.effectiveness?.duplicateRate || 0), 0) / todayOperations.length,
            averageDuration: todayOperations.reduce((sum, op) => sum + (op.performance?.duration || 0), 0) / todayOperations.length,
            totalIssues: todayOperations.reduce((sum, op) => sum + op.issues.length, 0),
            issuesByType: {},
            recommendationsByType: {},
            performanceIssues: this.analysisData.performanceIssues.filter(issue => {
                const issueDate = new Date(issue.timestamp).toISOString().split('T')[0];
                return issueDate === today;
            }).length
        };

        // Aggregate issues by type
        todayOperations.forEach(op => {
            op.issues.forEach(issue => {
                summary.issuesByType[issue.type] = (summary.issuesByType[issue.type] || 0) + 1;
            });
            op.recommendations.forEach(rec => {
                summary.recommendationsByType[rec.type] = (summary.recommendationsByType[rec.type] || 0) + 1;
            });
        });

        return summary;
    }

    /**
     * Generate analysis fingerprint for debugging
     * @param {Object} finding - Finding to fingerprint
     * @returns {string} Analysis fingerprint
     */
    generateAnalysisFingerprint(finding) {
        const components = [
            finding.pattern?.id || 'unknown',
            (finding.file || '').toLowerCase(),
            (finding.value || '').toLowerCase().trim()
        ];
        return components.join('|');
    }

    /**
     * Check if fingerprint collision is legitimate
     * @param {Object} finding1 - First finding
     * @param {Object} finding2 - Second finding
     * @returns {boolean} True if collision is legitimate
     */
    isLegitimateCollision(finding1, finding2) {
        return finding1.pattern?.id === finding2.pattern?.id &&
            finding1.file === finding2.file &&
            finding1.value === finding2.value;
    }

    /**
     * Get confidence range for grouping
     * @param {number} confidence - Confidence value
     * @returns {string} Confidence range
     */
    getConfidenceRange(confidence) {
        if (confidence >= 0.9) return 'high (0.9-1.0)';
        if (confidence >= 0.7) return 'medium (0.7-0.9)';
        if (confidence >= 0.5) return 'low (0.5-0.7)';
        return 'very-low (0.0-0.5)';
    }

    /**
     * Get comprehensive debug report
     * @returns {Object} Debug report
     */
    getDebugReport() {
        return {
            summary: {
                totalOperations: this.analysisData.operations.length,
                totalFingerprints: this.analysisData.fingerprints.size,
                totalPerformanceIssues: this.analysisData.performanceIssues.length,
                totalRecommendations: this.analysisData.recommendations.length
            },
            recentOperations: this.analysisData.operations.slice(-5),
            performanceIssues: this.analysisData.performanceIssues.slice(-10),
            topRecommendations: this.getTopRecommendations(),
            dailySummary: this.generateDailySummary()
        };
    }

    /**
     * Get top recommendations by frequency
     * @returns {Array} Top recommendations
     */
    getTopRecommendations() {
        const recommendationCounts = new Map();

        this.analysisData.recommendations.forEach(rec => {
            const key = `${rec.type}:${rec.message}`;
            recommendationCounts.set(key, (recommendationCounts.get(key) || 0) + 1);
        });

        return Array.from(recommendationCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, count]) => ({ recommendation: key, frequency: count }));
    }

    /**
     * Reset analysis data
     */
    reset() {
        this.analysisData.operations = [];
        this.analysisData.fingerprints.clear();
        this.analysisData.duplicatePatterns.clear();
        this.analysisData.performanceIssues = [];
        this.analysisData.recommendations = [];
    }
}

module.exports = { DeduplicationDebugger };