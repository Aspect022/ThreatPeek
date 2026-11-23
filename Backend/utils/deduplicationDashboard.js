/**
 * DeduplicationDashboard - Real-time dashboard for deduplication metrics and monitoring
 * Provides formatted output, alerts, and visual representations of deduplication performance
 */

class DeduplicationDashboard {
    constructor(metrics, logger, monitor, options = {}) {
        this.metrics = metrics;
        this.logger = logger;
        this.monitor = monitor;

        this.options = {
            // Display options
            refreshInterval: options.refreshInterval || 30000, // 30 seconds
            enableRealTimeUpdates: options.enableRealTimeUpdates !== false,

            // Alert thresholds
            criticalDuplicateRate: options.criticalDuplicateRate || 0.5, // 50%
            warningDuplicateRate: options.warningDuplicateRate || 0.3, // 30%
            criticalErrorRate: options.criticalErrorRate || 0.2, // 20%
            warningErrorRate: options.warningErrorRate || 0.1, // 10%

            ...options
        };

        // Dashboard state
        this.isRunning = false;
        this.lastUpdate = null;
        this.updateInterval = null;
    }

    /**
     * Start the dashboard
     */
    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastUpdate = Date.now();

        if (this.options.enableRealTimeUpdates) {
            this.updateInterval = setInterval(() => {
                this.updateDashboard();
            }, this.options.refreshInterval);
        }

        console.log('🚀 Deduplication Dashboard Started');
        this.displayDashboard();
    }

    /**
     * Stop the dashboard
     */
    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        console.log('🛑 Deduplication Dashboard Stopped');
    }

    /**
     * Update and display dashboard
     */
    updateDashboard() {
        if (!this.isRunning) return;

        this.lastUpdate = Date.now();
        this.displayDashboard();
    }

    /**
     * Display the complete dashboard
     */
    displayDashboard() {
        console.clear();
        console.log(this.generateDashboardHeader());
        console.log(this.generateOverviewSection());
        console.log(this.generatePerformanceSection());
        console.log(this.generateDuplicateRateSection());
        console.log(this.generateErrorSection());
        console.log(this.generateTrendsSection());
        console.log(this.generateAlertsSection());
        console.log(this.generateFooter());
    }

    /**
     * Generate dashboard header
     * @returns {string} Formatted header
     */
    generateDashboardHeader() {
        const timestamp = new Date().toLocaleString();
        const uptime = this.lastUpdate ? this.formatDuration(Date.now() - this.lastUpdate) : 'N/A';

        return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                        🔍 DEDUPLICATION DASHBOARD                            ║
║                                                                              ║
║  Last Update: ${timestamp.padEnd(20)} │ Uptime: ${uptime.padEnd(15)} ║
╚══════════════════════════════════════════════════════════════════════════════╝`;
    }

    /**
     * Generate overview section
     * @returns {string} Formatted overview
     */
    generateOverviewSection() {
        const summary = this.metrics.getMetricsSummary();
        const aggregated = summary.aggregated;

        const totalOps = aggregated.totalOperations.toLocaleString();
        const totalFindings = aggregated.totalFindings.toLocaleString();
        const totalDuplicates = aggregated.totalDuplicatesRemoved.toLocaleString();
        const avgRate = (aggregated.averageDuplicateRate * 100).toFixed(1) + '%';
        const avgTime = Math.round(aggregated.averageProcessingTime) + 'ms';

        return `
┌─ 📊 OVERVIEW ─────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Total Operations: ${totalOps.padEnd(15)} │ Average Duplicate Rate: ${avgRate.padEnd(10)} │
│  Total Findings:   ${totalFindings.padEnd(15)} │ Average Processing:     ${avgTime.padEnd(10)} │
│  Duplicates Removed: ${totalDuplicates.padEnd(13)} │                                    │
└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Generate performance section
     * @returns {string} Formatted performance metrics
     */
    generatePerformanceSection() {
        const summary = this.metrics.getMetricsSummary();
        const perf = summary.performance.mediumTerm;

        const avgDuration = Math.round(perf.averageDuration) + 'ms';
        const minDuration = Math.round(perf.minDuration) + 'ms';
        const maxDuration = Math.round(perf.maxDuration) + 'ms';
        const throughput = Math.round(perf.averageThroughput) + ' findings/sec';
        const slowOps = perf.slowOperations || 0;
        const trend = this.getTrendIcon(perf.trend);

        return `
┌─ ⚡ PERFORMANCE ───────────────────────────────────────────────────────────────┐
│                                                                              │
│  Average Duration: ${avgDuration.padEnd(12)} │ Throughput: ${throughput.padEnd(18)} │
│  Min Duration:     ${minDuration.padEnd(12)} │ Slow Operations: ${slowOps.toString().padEnd(13)} │
│  Max Duration:     ${maxDuration.padEnd(12)} │ Trend: ${trend.padEnd(22)} │
└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Generate duplicate rate section
     * @returns {string} Formatted duplicate rate metrics
     */
    generateDuplicateRateSection() {
        const summary = this.metrics.getMetricsSummary();
        const dupRate = summary.duplicateRates.mediumTerm;

        const avgRate = (dupRate.averageRate * 100).toFixed(1) + '%';
        const minRate = (dupRate.minRate * 100).toFixed(1) + '%';
        const maxRate = (dupRate.maxRate * 100).toFixed(1) + '%';
        const overallRate = (dupRate.overallRate * 100).toFixed(1) + '%';
        const trend = this.getTrendIcon(dupRate.trend);
        const status = this.getDuplicateRateStatus(dupRate.averageRate);

        return `
┌─ 🔄 DUPLICATE RATES ──────────────────────────────────────────────────────────┐
│                                                                              │
│  Average Rate: ${avgRate.padEnd(12)} │ Overall Rate: ${overallRate.padEnd(15)} │
│  Min Rate:     ${minRate.padEnd(12)} │ Status: ${status.padEnd(19)} │
│  Max Rate:     ${maxRate.padEnd(12)} │ Trend: ${trend.padEnd(20)} │
└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Generate error section
     * @returns {string} Formatted error metrics
     */
    generateErrorSection() {
        const summary = this.metrics.getMetricsSummary();
        const errors = summary.errors.mediumTerm;

        const errorRate = (errors.errorRate * 100).toFixed(2) + '%';
        const totalErrors = errors.totalErrors.toString();
        const totalOps = errors.totalOperations.toString();
        const recoverableErrors = errors.recoverableErrors.toString();
        const status = this.getErrorRateStatus(errors.errorRate);

        return `
┌─ ⚠️  ERRORS ───────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Error Rate:       ${errorRate.padEnd(12)} │ Total Operations: ${totalOps.padEnd(13)} │
│  Total Errors:     ${totalErrors.padEnd(12)} │ Recoverable: ${recoverableErrors.padEnd(17)} │
│  Status: ${status.padEnd(25)} │                                    │
└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Generate trends section
     * @returns {string} Formatted trends
     */
    generateTrendsSection() {
        const summary = this.metrics.getMetricsSummary();
        const trends = summary.trends;

        const dupTrend = this.getTrendIcon(trends.duplicateRate.trend);
        const perfTrend = this.getTrendIcon(trends.performance.trend);
        const throughputTrend = this.getTrendIcon(trends.throughput.trend);

        const dupVolatility = this.getVolatilityStatus(trends.duplicateRate.volatility);
        const perfVolatility = this.getVolatilityStatus(trends.performance.volatility);

        return `
┌─ 📈 TRENDS ───────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Duplicate Rate:   ${dupTrend.padEnd(15)} │ Volatility: ${dupVolatility.padEnd(15)} │
│  Performance:      ${perfTrend.padEnd(15)} │ Volatility: ${perfVolatility.padEnd(15)} │
│  Throughput:       ${throughputTrend.padEnd(15)} │                                    │
└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Generate alerts section
     * @returns {string} Formatted alerts
     */
    generateAlertsSection() {
        const summary = this.metrics.getMetricsSummary();
        const insights = summary.insights;
        const monitorMetrics = this.monitor.getMetrics();

        let alertsText = '';

        // Recent alerts from monitor
        const recentAlerts = monitorMetrics.alerts.recent.slice(-3);
        if (recentAlerts.length > 0) {
            alertsText += '  Recent Alerts:\n';
            recentAlerts.forEach(alert => {
                const time = new Date(alert.timestamp).toLocaleTimeString();
                const severity = this.getSeverityIcon(alert.severity);
                alertsText += `    ${severity} ${time} - ${alert.message}\n`;
            });
        }

        // Insights
        if (insights.length > 0) {
            alertsText += '  Insights:\n';
            insights.slice(-3).forEach(insight => {
                const severity = this.getSeverityIcon(insight.severity);
                alertsText += `    ${severity} ${insight.message}\n`;
            });
        }

        if (!alertsText) {
            alertsText = '  ✅ No active alerts or issues detected\n';
        }

        return `
┌─ 🚨 ALERTS & INSIGHTS ────────────────────────────────────────────────────────┐
│                                                                              │
${alertsText}└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Generate footer
     * @returns {string} Formatted footer
     */
    generateFooter() {
        const nextUpdate = this.options.enableRealTimeUpdates
            ? new Date(Date.now() + this.options.refreshInterval).toLocaleTimeString()
            : 'Manual';

        return `
┌─ ℹ️  INFO ─────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Next Update: ${nextUpdate.padEnd(15)} │ Press Ctrl+C to stop dashboard        │
│  Refresh Rate: ${(this.options.refreshInterval / 1000).toString().padEnd(13)}s │                                    │
└──────────────────────────────────────────────────────────────────────────────┘`;
    }

    /**
     * Get trend icon
     * @param {string} trend - Trend direction
     * @returns {string} Trend icon and text
     */
    getTrendIcon(trend) {
        switch (trend) {
            case 'increasing': return '📈 Increasing';
            case 'decreasing': return '📉 Decreasing';
            case 'stable': return '➡️  Stable';
            default: return '❓ Unknown';
        }
    }

    /**
     * Get severity icon
     * @param {string} severity - Severity level
     * @returns {string} Severity icon
     */
    getSeverityIcon(severity) {
        switch (severity) {
            case 'critical': return '🔴';
            case 'warning': return '🟡';
            case 'info': return '🔵';
            default: return '⚪';
        }
    }

    /**
     * Get duplicate rate status
     * @param {number} rate - Duplicate rate (0-1)
     * @returns {string} Status text with color
     */
    getDuplicateRateStatus(rate) {
        if (rate >= this.options.criticalDuplicateRate) {
            return '🔴 Critical';
        } else if (rate >= this.options.warningDuplicateRate) {
            return '🟡 Warning';
        } else {
            return '🟢 Good';
        }
    }

    /**
     * Get error rate status
     * @param {number} rate - Error rate (0-1)
     * @returns {string} Status text with color
     */
    getErrorRateStatus(rate) {
        if (rate >= this.options.criticalErrorRate) {
            return '🔴 Critical';
        } else if (rate >= this.options.warningErrorRate) {
            return '🟡 Warning';
        } else {
            return '🟢 Good';
        }
    }

    /**
     * Get volatility status
     * @param {number} volatility - Volatility measure
     * @returns {string} Volatility status
     */
    getVolatilityStatus(volatility) {
        if (volatility > 0.5) {
            return '🔴 High';
        } else if (volatility > 0.2) {
            return '🟡 Medium';
        } else {
            return '🟢 Low';
        }
    }

    /**
     * Format duration in human readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Generate summary report
     * @returns {string} Summary report
     */
    generateSummaryReport() {
        const summary = this.metrics.getMetricsSummary();
        const timestamp = new Date().toISOString();

        return `
DEDUPLICATION SUMMARY REPORT
Generated: ${timestamp}

OVERVIEW:
- Total Operations: ${summary.aggregated.totalOperations.toLocaleString()}
- Total Findings: ${summary.aggregated.totalFindings.toLocaleString()}
- Duplicates Removed: ${summary.aggregated.totalDuplicatesRemoved.toLocaleString()}
- Average Duplicate Rate: ${(summary.aggregated.averageDuplicateRate * 100).toFixed(2)}%
- Average Processing Time: ${Math.round(summary.aggregated.averageProcessingTime)}ms

PERFORMANCE (Last Hour):
- Average Duration: ${Math.round(summary.performance.mediumTerm.averageDuration)}ms
- Average Throughput: ${Math.round(summary.performance.mediumTerm.averageThroughput)} findings/sec
- Slow Operations: ${summary.performance.mediumTerm.slowOperations || 0}
- Performance Trend: ${summary.trends.performance.trend}

DUPLICATE RATES (Last Hour):
- Average Rate: ${(summary.duplicateRates.mediumTerm.averageRate * 100).toFixed(2)}%
- Min Rate: ${(summary.duplicateRates.mediumTerm.minRate * 100).toFixed(2)}%
- Max Rate: ${(summary.duplicateRates.mediumTerm.maxRate * 100).toFixed(2)}%
- Trend: ${summary.trends.duplicateRate.trend}

ERRORS (Last Hour):
- Error Rate: ${(summary.errors.mediumTerm.errorRate * 100).toFixed(2)}%
- Total Errors: ${summary.errors.mediumTerm.totalErrors}
- Recoverable Errors: ${summary.errors.mediumTerm.recoverableErrors}

INSIGHTS:
${summary.insights.map(insight => `- ${insight.message}`).join('\n')}

RECOMMENDATIONS:
${summary.insights.map(insight => `- ${insight.recommendation}`).join('\n')}
`;
    }

    /**
     * Export dashboard data
     * @param {string} format - Export format ('json', 'csv', 'report')
     * @returns {string} Exported data
     */
    exportData(format = 'json') {
        if (format === 'report') {
            return this.generateSummaryReport();
        }

        return this.metrics.exportMetrics(format);
    }
}

module.exports = { DeduplicationDashboard };