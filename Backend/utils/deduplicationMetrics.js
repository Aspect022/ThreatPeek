/**
 * DeduplicationMetrics - Comprehensive metrics collection and analysis for deduplication
 * Provides detailed metrics, trends analysis, and performance insights
 */

class DeduplicationMetrics {
    constructor(options = {}) {
        this.options = {
            // Metrics retention
            maxMetricsHistory: options.maxMetricsHistory || 10000,
            maxTrendHistory: options.maxTrendHistory || 1000,

            // Analysis windows
            shortTermWindow: options.shortTermWindow || 5 * 60 * 1000, // 5 minutes
            mediumTermWindow: options.mediumTermWindow || 60 * 60 * 1000, // 1 hour
            longTermWindow: options.longTermWindow || 24 * 60 * 60 * 1000, // 24 hours

            // Thresholds for analysis
            duplicateRateThreshold: options.duplicateRateThreshold || 0.3, // 30%
            performanceThreshold: options.performanceThreshold || 2000, // 2 seconds

            ...options
        };

        // Metrics storage
        this.metrics = {
            operations: [],
            duplicateRates: [],
            performanceMetrics: [],
            errorMetrics: [],
            trends: {
                duplicateRate: [],
                performance: [],
                throughput: []
            }
        };

        // Aggregated statistics
        this.aggregatedStats = {
            totalOperations: 0,
            totalFindings: 0,
            totalDuplicatesRemoved: 0,
            totalProcessingTime: 0,
            averageDuplicateRate: 0,
            averageProcessingTime: 0,
            lastUpdated: Date.now()
        };
    }

    /**
     * Record a deduplication operation
     * @param {Object} operationData - Operation metrics
     */
    recordOperation(operationData) {
        const timestamp = Date.now();
        const operation = {
            timestamp,
            type: operationData.type || 'unknown',
            totalFindings: operationData.totalFindings || 0,
            uniqueFindings: operationData.uniqueFindings || 0,
            duplicatesRemoved: operationData.duplicatesRemoved || 0,
            duration: operationData.duration || 0,
            memoryUsage: operationData.memoryUsage || 0,
            success: operationData.success !== false,
            duplicateRate: operationData.totalFindings > 0
                ? operationData.duplicatesRemoved / operationData.totalFindings
                : 0,
            throughput: operationData.duration > 0
                ? operationData.totalFindings / (operationData.duration / 1000)
                : 0
        };

        // Store operation
        this.metrics.operations.push(operation);
        this.limitArraySize(this.metrics.operations, this.options.maxMetricsHistory);

        // Record duplicate rate
        if (operation.totalFindings > 0) {
            this.metrics.duplicateRates.push({
                timestamp,
                rate: operation.duplicateRate,
                totalFindings: operation.totalFindings,
                duplicatesRemoved: operation.duplicatesRemoved
            });
            this.limitArraySize(this.metrics.duplicateRates, this.options.maxMetricsHistory);
        }

        // Record performance metrics
        this.metrics.performanceMetrics.push({
            timestamp,
            duration: operation.duration,
            throughput: operation.throughput,
            memoryUsage: operation.memoryUsage,
            findingsProcessed: operation.totalFindings
        });
        this.limitArraySize(this.metrics.performanceMetrics, this.options.maxMetricsHistory);

        // Update aggregated statistics
        this.updateAggregatedStats(operation);

        // Update trends
        this.updateTrends(operation);

        return operation;
    }

    /**
     * Record an error
     * @param {Object} errorData - Error information
     */
    recordError(errorData) {
        const timestamp = Date.now();
        const error = {
            timestamp,
            type: errorData.type || 'unknown',
            message: errorData.message || 'Unknown error',
            operationType: errorData.operationType || 'unknown',
            severity: errorData.severity || 'error',
            recoverable: errorData.recoverable !== false
        };

        this.metrics.errorMetrics.push(error);
        this.limitArraySize(this.metrics.errorMetrics, this.options.maxMetricsHistory);

        return error;
    }

    /**
     * Get duplicate detection rates over time
     * @param {number} timeWindow - Time window in milliseconds
     * @returns {Object} Duplicate rate analysis
     */
    getDuplicateRateAnalysis(timeWindow = this.options.mediumTermWindow) {
        const now = Date.now();
        const cutoff = now - timeWindow;

        const recentRates = this.metrics.duplicateRates.filter(
            rate => rate.timestamp >= cutoff
        );

        if (recentRates.length === 0) {
            return {
                averageRate: 0,
                minRate: 0,
                maxRate: 0,
                trend: 'stable',
                dataPoints: 0,
                totalFindings: 0,
                totalDuplicatesRemoved: 0
            };
        }

        const rates = recentRates.map(r => r.rate);
        const totalFindings = recentRates.reduce((sum, r) => sum + r.totalFindings, 0);
        const totalDuplicatesRemoved = recentRates.reduce((sum, r) => sum + r.duplicatesRemoved, 0);

        const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        const minRate = Math.min(...rates);
        const maxRate = Math.max(...rates);

        // Calculate trend
        const trend = this.calculateTrend(recentRates.map(r => ({
            timestamp: r.timestamp,
            value: r.rate
        })));

        return {
            averageRate,
            minRate,
            maxRate,
            trend,
            dataPoints: recentRates.length,
            totalFindings,
            totalDuplicatesRemoved,
            overallRate: totalFindings > 0 ? totalDuplicatesRemoved / totalFindings : 0,
            rateDistribution: this.calculateDistribution(rates),
            timeWindow: timeWindow
        };
    }

    /**
     * Get performance metrics analysis
     * @param {number} timeWindow - Time window in milliseconds
     * @returns {Object} Performance analysis
     */
    getPerformanceAnalysis(timeWindow = this.options.mediumTermWindow) {
        const now = Date.now();
        const cutoff = now - timeWindow;

        const recentMetrics = this.metrics.performanceMetrics.filter(
            metric => metric.timestamp >= cutoff
        );

        if (recentMetrics.length === 0) {
            return {
                averageDuration: 0,
                averageThroughput: 0,
                averageMemoryUsage: 0,
                trend: 'stable',
                dataPoints: 0
            };
        }

        const durations = recentMetrics.map(m => m.duration);
        const throughputs = recentMetrics.filter(m => m.throughput > 0).map(m => m.throughput);
        const memoryUsages = recentMetrics.filter(m => m.memoryUsage > 0).map(m => m.memoryUsage);

        const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const averageThroughput = throughputs.length > 0
            ? throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length
            : 0;
        const averageMemoryUsage = memoryUsages.length > 0
            ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
            : 0;

        // Calculate performance trend
        const performanceTrend = this.calculateTrend(recentMetrics.map(m => ({
            timestamp: m.timestamp,
            value: m.duration
        })));

        return {
            averageDuration,
            averageThroughput,
            averageMemoryUsage,
            minDuration: Math.min(...durations),
            maxDuration: Math.max(...durations),
            trend: performanceTrend,
            dataPoints: recentMetrics.length,
            slowOperations: durations.filter(d => d > this.options.performanceThreshold).length,
            performanceDistribution: this.calculateDistribution(durations),
            timeWindow: timeWindow
        };
    }

    /**
     * Get error rate analysis
     * @param {number} timeWindow - Time window in milliseconds
     * @returns {Object} Error analysis
     */
    getErrorAnalysis(timeWindow = this.options.mediumTermWindow) {
        const now = Date.now();
        const cutoff = now - timeWindow;

        const recentErrors = this.metrics.errorMetrics.filter(
            error => error.timestamp >= cutoff
        );

        const recentOperations = this.metrics.operations.filter(
            op => op.timestamp >= cutoff
        );

        const errorRate = recentOperations.length > 0
            ? recentErrors.length / recentOperations.length
            : 0;

        const errorsByType = recentErrors.reduce((acc, error) => {
            acc[error.type] = (acc[error.type] || 0) + 1;
            return acc;
        }, {});

        const errorsBySeverity = recentErrors.reduce((acc, error) => {
            acc[error.severity] = (acc[error.severity] || 0) + 1;
            return acc;
        }, {});

        return {
            errorRate,
            totalErrors: recentErrors.length,
            totalOperations: recentOperations.length,
            errorsByType,
            errorsBySeverity,
            recoverableErrors: recentErrors.filter(e => e.recoverable).length,
            timeWindow: timeWindow
        };
    }

    /**
     * Get comprehensive metrics summary
     * @returns {Object} Complete metrics summary
     */
    getMetricsSummary() {
        const shortTerm = this.options.shortTermWindow;
        const mediumTerm = this.options.mediumTermWindow;
        const longTerm = this.options.longTermWindow;

        return {
            aggregated: { ...this.aggregatedStats },
            duplicateRates: {
                shortTerm: this.getDuplicateRateAnalysis(shortTerm),
                mediumTerm: this.getDuplicateRateAnalysis(mediumTerm),
                longTerm: this.getDuplicateRateAnalysis(longTerm)
            },
            performance: {
                shortTerm: this.getPerformanceAnalysis(shortTerm),
                mediumTerm: this.getPerformanceAnalysis(mediumTerm),
                longTerm: this.getPerformanceAnalysis(longTerm)
            },
            errors: {
                shortTerm: this.getErrorAnalysis(shortTerm),
                mediumTerm: this.getErrorAnalysis(mediumTerm),
                longTerm: this.getErrorAnalysis(longTerm)
            },
            trends: this.getTrendAnalysis(),
            insights: this.generateInsights()
        };
    }

    /**
     * Get trend analysis
     * @returns {Object} Trend analysis
     */
    getTrendAnalysis() {
        return {
            duplicateRate: {
                current: this.metrics.trends.duplicateRate.slice(-10),
                trend: this.calculateTrend(this.metrics.trends.duplicateRate),
                volatility: this.calculateVolatility(this.metrics.trends.duplicateRate)
            },
            performance: {
                current: this.metrics.trends.performance.slice(-10),
                trend: this.calculateTrend(this.metrics.trends.performance),
                volatility: this.calculateVolatility(this.metrics.trends.performance)
            },
            throughput: {
                current: this.metrics.trends.throughput.slice(-10),
                trend: this.calculateTrend(this.metrics.trends.throughput),
                volatility: this.calculateVolatility(this.metrics.trends.throughput)
            }
        };
    }

    /**
     * Generate insights based on metrics
     * @returns {Array} Array of insights
     */
    generateInsights() {
        const insights = [];

        // Get analysis data directly without calling getMetricsSummary to avoid circular reference
        const duplicateAnalysis = this.getDuplicateRateAnalysis();
        const performanceAnalysis = this.getPerformanceAnalysis();
        const errorAnalysis = this.getErrorAnalysis();

        // Duplicate rate insights
        if (duplicateAnalysis.averageRate > this.options.duplicateRateThreshold) {
            insights.push({
                type: 'duplicate_rate',
                severity: 'warning',
                message: `High duplicate rate detected: ${(duplicateAnalysis.averageRate * 100).toFixed(1)}%`,
                recommendation: 'Consider reviewing fingerprint generation logic or implementing more aggressive deduplication'
            });
        }

        // Performance insights
        if (performanceAnalysis.averageDuration > this.options.performanceThreshold) {
            insights.push({
                type: 'performance',
                severity: 'warning',
                message: `Slow deduplication performance: ${performanceAnalysis.averageDuration}ms average`,
                recommendation: 'Consider optimizing deduplication algorithms or reducing batch sizes'
            });
        }

        // Trend insights
        const duplicateTrend = duplicateAnalysis.trend;
        if (duplicateTrend === 'increasing') {
            insights.push({
                type: 'trend',
                severity: 'info',
                message: 'Duplicate rate is increasing over time',
                recommendation: 'Monitor for changes in data patterns or deduplication effectiveness'
            });
        }

        // Error rate insights
        if (errorAnalysis.errorRate > 0.1) {
            insights.push({
                type: 'error_rate',
                severity: 'critical',
                message: `High error rate: ${(errorAnalysis.errorRate * 100).toFixed(1)}%`,
                recommendation: 'Investigate error causes and implement better error handling'
            });
        }

        return insights;
    }

    /**
     * Update aggregated statistics
     * @param {Object} operation - Operation data
     */
    updateAggregatedStats(operation) {
        this.aggregatedStats.totalOperations++;
        this.aggregatedStats.totalFindings += operation.totalFindings;
        this.aggregatedStats.totalDuplicatesRemoved += operation.duplicatesRemoved;
        this.aggregatedStats.totalProcessingTime += operation.duration;

        // Calculate averages
        this.aggregatedStats.averageDuplicateRate = this.aggregatedStats.totalFindings > 0
            ? this.aggregatedStats.totalDuplicatesRemoved / this.aggregatedStats.totalFindings
            : 0;

        this.aggregatedStats.averageProcessingTime = this.aggregatedStats.totalOperations > 0
            ? this.aggregatedStats.totalProcessingTime / this.aggregatedStats.totalOperations
            : 0;

        this.aggregatedStats.lastUpdated = Date.now();
    }

    /**
     * Update trend data
     * @param {Object} operation - Operation data
     */
    updateTrends(operation) {
        const timestamp = Date.now();

        // Update duplicate rate trend
        if (operation.totalFindings > 0) {
            this.metrics.trends.duplicateRate.push({
                timestamp,
                value: operation.duplicateRate
            });
            this.limitArraySize(this.metrics.trends.duplicateRate, this.options.maxTrendHistory);
        }

        // Update performance trend
        this.metrics.trends.performance.push({
            timestamp,
            value: operation.duration
        });
        this.limitArraySize(this.metrics.trends.performance, this.options.maxTrendHistory);

        // Update throughput trend
        if (operation.throughput > 0) {
            this.metrics.trends.throughput.push({
                timestamp,
                value: operation.throughput
            });
            this.limitArraySize(this.metrics.trends.throughput, this.options.maxTrendHistory);
        }
    }

    /**
     * Calculate trend direction
     * @param {Array} dataPoints - Array of {timestamp, value} objects
     * @returns {string} Trend direction: 'increasing', 'decreasing', 'stable'
     */
    calculateTrend(dataPoints) {
        if (dataPoints.length < 2) return 'stable';

        // Simple linear regression to determine trend
        const n = dataPoints.length;
        const sumX = dataPoints.reduce((sum, point, index) => sum + index, 0);
        const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
        const sumXY = dataPoints.reduce((sum, point, index) => sum + index * point.value, 0);
        const sumXX = dataPoints.reduce((sum, point, index) => sum + index * index, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        if (Math.abs(slope) < 0.001) return 'stable';
        return slope > 0 ? 'increasing' : 'decreasing';
    }

    /**
     * Calculate volatility of data points
     * @param {Array} dataPoints - Array of {timestamp, value} objects
     * @returns {number} Volatility measure
     */
    calculateVolatility(dataPoints) {
        if (dataPoints.length < 2) return 0;

        const values = dataPoints.map(p => p.value);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

        return Math.sqrt(variance);
    }

    /**
     * Calculate distribution statistics
     * @param {Array} values - Array of numeric values
     * @returns {Object} Distribution statistics
     */
    calculateDistribution(values) {
        if (values.length === 0) return { percentiles: {}, histogram: [] };

        const sorted = [...values].sort((a, b) => a - b);
        const percentiles = {
            p25: this.getPercentile(sorted, 25),
            p50: this.getPercentile(sorted, 50),
            p75: this.getPercentile(sorted, 75),
            p90: this.getPercentile(sorted, 90),
            p95: this.getPercentile(sorted, 95),
            p99: this.getPercentile(sorted, 99)
        };

        // Simple histogram (10 buckets)
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const bucketSize = (max - min) / 10;
        const histogram = Array(10).fill(0);

        if (bucketSize > 0) {
            values.forEach(value => {
                const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), 9);
                histogram[bucketIndex]++;
            });
        }

        return { percentiles, histogram };
    }

    /**
     * Get percentile value
     * @param {Array} sortedValues - Sorted array of values
     * @param {number} percentile - Percentile (0-100)
     * @returns {number} Percentile value
     */
    getPercentile(sortedValues, percentile) {
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);

        if (lower === upper) {
            return sortedValues[lower];
        }

        const weight = index - lower;
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    /**
     * Limit array size by removing oldest entries
     * @param {Array} array - Array to limit
     * @param {number} maxSize - Maximum size
     */
    limitArraySize(array, maxSize) {
        while (array.length > maxSize) {
            array.shift();
        }
    }

    /**
     * Export metrics data
     * @param {string} format - Export format ('json', 'csv')
     * @returns {string} Exported data
     */
    exportMetrics(format = 'json') {
        const data = this.getMetricsSummary();

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }

        if (format === 'csv') {
            // Simple CSV export of operations
            const headers = ['timestamp', 'type', 'totalFindings', 'duplicatesRemoved', 'duration', 'duplicateRate'];
            const rows = this.metrics.operations.map(op => [
                new Date(op.timestamp).toISOString(),
                op.type,
                op.totalFindings,
                op.duplicatesRemoved,
                op.duration,
                op.duplicateRate.toFixed(4)
            ]);

            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }

        throw new Error(`Unsupported export format: ${format}`);
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            operations: [],
            duplicateRates: [],
            performanceMetrics: [],
            errorMetrics: [],
            trends: {
                duplicateRate: [],
                performance: [],
                throughput: []
            }
        };

        this.aggregatedStats = {
            totalOperations: 0,
            totalFindings: 0,
            totalDuplicatesRemoved: 0,
            totalProcessingTime: 0,
            averageDuplicateRate: 0,
            averageProcessingTime: 0,
            lastUpdated: Date.now()
        };
    }
}

module.exports = { DeduplicationMetrics };