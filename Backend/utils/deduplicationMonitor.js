/**
 * DeduplicationMonitor - Production monitoring and alerting for deduplication performance
 * Provides real-time monitoring, alerting, and performance analysis
 */

const EventEmitter = require('events');

class DeduplicationMonitor extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            // Performance thresholds
            slowOperationThreshold: 2000, // 2 seconds
            memoryWarningThreshold: 400, // 400MB
            errorRateThreshold: 0.1, // 10% error rate

            // Monitoring intervals
            monitoringInterval: 30000, // 30 seconds
            reportingInterval: 300000, // 5 minutes

            // Data retention
            maxHistorySize: 1000,
            maxAlertHistory: 100,

            // Alerting
            enableAlerting: true,
            alertCooldownMs: 60000, // 1 minute between same alerts

            ...options
        };

        // Monitoring data
        this.metrics = {
            operations: [],
            errors: [],
            alerts: [],
            systemHealth: {
                status: 'healthy',
                lastCheck: Date.now(),
                issues: []
            }
        };

        // Alert state tracking
        this.alertState = new Map();

        // Start monitoring if enabled
        if (this.options.monitoringInterval > 0) {
            this.startMonitoring();
        }
    }

    /**
     * Record a deduplication operation
     * @param {Object} operationData - Operation metrics
     */
    recordOperation(operationData) {
        const operation = {
            timestamp: Date.now(),
            type: operationData.type || 'unknown',
            duration: operationData.duration || 0,
            findingsProcessed: operationData.findingsProcessed || 0,
            duplicatesRemoved: operationData.duplicatesRemoved || 0,
            memoryUsage: operationData.memoryUsage || 0,
            success: operationData.success !== false,
            error: operationData.error || null
        };

        this.metrics.operations.push(operation);

        // Limit history size
        if (this.metrics.operations.length > this.options.maxHistorySize) {
            this.metrics.operations.shift();
        }

        // Check for performance issues
        this.checkPerformanceThresholds(operation);

        // Emit operation event
        this.emit('operation', operation);

        return operation;
    }

    /**
     * Record a deduplication error
     * @param {Object} errorData - Error information
     */
    recordError(errorData) {
        const error = {
            timestamp: Date.now(),
            type: errorData.type || 'unknown',
            message: errorData.message || 'Unknown error',
            stack: errorData.stack || null,
            operationType: errorData.operationType || 'unknown',
            findingsCount: errorData.findingsCount || 0,
            recoveryAction: errorData.recoveryAction || 'fallback'
        };

        this.metrics.errors.push(error);

        // Limit error history
        if (this.metrics.errors.length > this.options.maxHistorySize) {
            this.metrics.errors.shift();
        }

        // Check error rate
        this.checkErrorRate();

        // Emit error event
        this.emit('error', error);

        return error;
    }

    /**
     * Check performance thresholds and trigger alerts
     * @param {Object} operation - Operation to check
     */
    checkPerformanceThresholds(operation) {
        const alerts = [];

        // Check operation duration
        if (operation.duration > this.options.slowOperationThreshold) {
            alerts.push({
                type: 'slow_operation',
                severity: 'warning',
                message: `Slow deduplication operation: ${operation.duration}ms (threshold: ${this.options.slowOperationThreshold}ms)`,
                data: { duration: operation.duration, type: operation.type }
            });
        }

        // Check memory usage
        const memoryMB = operation.memoryUsage / (1024 * 1024);
        if (memoryMB > this.options.memoryWarningThreshold) {
            alerts.push({
                type: 'high_memory',
                severity: 'warning',
                message: `High memory usage during deduplication: ${memoryMB.toFixed(1)}MB (threshold: ${this.options.memoryWarningThreshold}MB)`,
                data: { memoryMB, type: operation.type }
            });
        }

        // Process alerts
        alerts.forEach(alert => this.triggerAlert(alert));
    }

    /**
     * Check error rate and trigger alerts if necessary
     */
    checkErrorRate() {
        const recentWindow = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();

        const recentOperations = this.metrics.operations.filter(
            op => now - op.timestamp < recentWindow
        );
        const recentErrors = this.metrics.errors.filter(
            err => now - err.timestamp < recentWindow
        );

        if (recentOperations.length > 0) {
            const errorRate = recentErrors.length / recentOperations.length;

            if (errorRate > this.options.errorRateThreshold) {
                this.triggerAlert({
                    type: 'high_error_rate',
                    severity: 'critical',
                    message: `High deduplication error rate: ${(errorRate * 100).toFixed(1)}% (threshold: ${(this.options.errorRateThreshold * 100).toFixed(1)}%)`,
                    data: {
                        errorRate,
                        recentErrors: recentErrors.length,
                        recentOperations: recentOperations.length
                    }
                });
            }
        }
    }

    /**
     * Trigger an alert with cooldown logic
     * @param {Object} alert - Alert to trigger
     */
    triggerAlert(alert) {
        if (!this.options.enableAlerting) {
            return;
        }

        const alertKey = `${alert.type}_${alert.severity}`;
        const now = Date.now();
        const lastAlert = this.alertState.get(alertKey);

        // Check cooldown
        if (lastAlert && (now - lastAlert) < this.options.alertCooldownMs) {
            return; // Skip alert due to cooldown
        }

        // Record alert
        const alertRecord = {
            ...alert,
            timestamp: now,
            id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`
        };

        this.metrics.alerts.push(alertRecord);
        this.alertState.set(alertKey, now);

        // Limit alert history
        if (this.metrics.alerts.length > this.options.maxAlertHistory) {
            this.metrics.alerts.shift();
        }

        // Emit alert event
        this.emit('alert', alertRecord);

        // Log alert
        console.warn(`[DEDUPLICATION ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring() {
        this.monitoringTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.options.monitoringInterval);

        this.reportingTimer = setInterval(() => {
            this.generatePerformanceReport();
        }, this.options.reportingInterval);

        console.log('Deduplication monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        if (this.reportingTimer) {
            clearInterval(this.reportingTimer);
            this.reportingTimer = null;
        }

        console.log('Deduplication monitoring stopped');
    }

    /**
     * Perform system health check
     */
    performHealthCheck() {
        const now = Date.now();
        const issues = [];

        // Check recent error rate
        const recentWindow = 10 * 60 * 1000; // 10 minutes
        const recentOperations = this.metrics.operations.filter(
            op => now - op.timestamp < recentWindow
        );
        const recentErrors = this.metrics.errors.filter(
            err => now - err.timestamp < recentWindow
        );

        if (recentOperations.length > 0) {
            const errorRate = recentErrors.length / recentOperations.length;
            if (errorRate > this.options.errorRateThreshold) {
                issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
            }
        }

        // Check for slow operations
        const slowOperations = recentOperations.filter(
            op => op.duration > this.options.slowOperationThreshold
        );
        if (slowOperations.length > 0) {
            issues.push(`${slowOperations.length} slow operations in last 10 minutes`);
        }

        // Check memory usage trend
        const recentMemoryUsage = recentOperations
            .map(op => op.memoryUsage / (1024 * 1024))
            .filter(mem => mem > 0);

        if (recentMemoryUsage.length > 0) {
            const avgMemory = recentMemoryUsage.reduce((sum, mem) => sum + mem, 0) / recentMemoryUsage.length;
            if (avgMemory > this.options.memoryWarningThreshold) {
                issues.push(`High average memory usage: ${avgMemory.toFixed(1)}MB`);
            }
        }

        // Update health status
        this.metrics.systemHealth = {
            status: issues.length === 0 ? 'healthy' : 'degraded',
            lastCheck: now,
            issues
        };

        // Emit health check event
        this.emit('healthCheck', this.metrics.systemHealth);
    }

    /**
     * Generate comprehensive performance report
     * @returns {Object} Performance report
     */
    generatePerformanceReport() {
        const now = Date.now();
        const reportWindow = this.options.reportingInterval;

        const recentOperations = this.metrics.operations.filter(
            op => now - op.timestamp < reportWindow
        );
        const recentErrors = this.metrics.errors.filter(
            err => now - err.timestamp < reportWindow
        );
        const recentAlerts = this.metrics.alerts.filter(
            alert => now - alert.timestamp < reportWindow
        );

        const report = {
            timestamp: now,
            period: `${reportWindow / 1000}s`,
            operations: {
                total: recentOperations.length,
                successful: recentOperations.filter(op => op.success).length,
                failed: recentOperations.filter(op => !op.success).length,
                averageDuration: recentOperations.length > 0
                    ? Math.round(recentOperations.reduce((sum, op) => sum + op.duration, 0) / recentOperations.length)
                    : 0,
                maxDuration: recentOperations.length > 0
                    ? Math.max(...recentOperations.map(op => op.duration))
                    : 0,
                totalFindingsProcessed: recentOperations.reduce((sum, op) => sum + op.findingsProcessed, 0),
                totalDuplicatesRemoved: recentOperations.reduce((sum, op) => sum + op.duplicatesRemoved, 0)
            },
            errors: {
                total: recentErrors.length,
                rate: recentOperations.length > 0 ? recentErrors.length / recentOperations.length : 0,
                byType: this.groupBy(recentErrors, 'type')
            },
            alerts: {
                total: recentAlerts.length,
                bySeverity: this.groupBy(recentAlerts, 'severity'),
                byType: this.groupBy(recentAlerts, 'type')
            },
            memory: {
                averageUsage: recentOperations.length > 0
                    ? Math.round(recentOperations.reduce((sum, op) => sum + op.memoryUsage, 0) / recentOperations.length / (1024 * 1024))
                    : 0,
                peakUsage: recentOperations.length > 0
                    ? Math.round(Math.max(...recentOperations.map(op => op.memoryUsage)) / (1024 * 1024))
                    : 0
            },
            systemHealth: this.metrics.systemHealth
        };

        // Emit report event
        this.emit('report', report);

        // Log summary
        console.log(`[DEDUPLICATION REPORT] ${report.operations.total} operations, ` +
            `${report.errors.total} errors (${(report.errors.rate * 100).toFixed(1)}%), ` +
            `${report.alerts.total} alerts, avg duration: ${report.operations.averageDuration}ms`);

        return report;
    }

    /**
     * Get current metrics summary
     * @returns {Object} Metrics summary
     */
    getMetrics() {
        return {
            operations: {
                total: this.metrics.operations.length,
                recent: this.metrics.operations.slice(-10)
            },
            errors: {
                total: this.metrics.errors.length,
                recent: this.metrics.errors.slice(-10)
            },
            alerts: {
                total: this.metrics.alerts.length,
                recent: this.metrics.alerts.slice(-10)
            },
            systemHealth: this.metrics.systemHealth
        };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics.operations = [];
        this.metrics.errors = [];
        this.metrics.alerts = [];
        this.alertState.clear();
        this.metrics.systemHealth = {
            status: 'healthy',
            lastCheck: Date.now(),
            issues: []
        };
    }

    /**
     * Group array items by property
     * @param {Array} items - Items to group
     * @param {string} property - Property to group by
     * @returns {Object} Grouped items
     */
    groupBy(items, property) {
        return items.reduce((groups, item) => {
            const key = item[property] || 'unknown';
            groups[key] = (groups[key] || 0) + 1;
            return groups;
        }, {});
    }
}

module.exports = { DeduplicationMonitor };