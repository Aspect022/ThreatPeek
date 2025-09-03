/**
 * DeduplicationLogger - Comprehensive logging system for deduplication operations
 * Provides structured logging, metrics collection, and debugging capabilities
 */

const fs = require('fs-extra');
const path = require('path');

class DeduplicationLogger {
    constructor(options = {}) {
        this.options = {
            // Logging levels
            logLevel: options.logLevel || 'info', // debug, info, warn, error
            enableFileLogging: options.enableFileLogging !== false,
            enableConsoleLogging: options.enableConsoleLogging !== false,

            // File logging options
            logDirectory: options.logDirectory || path.join(__dirname, '..', 'logs', 'deduplication'),
            maxLogFileSize: options.maxLogFileSize || 10 * 1024 * 1024, // 10MB
            maxLogFiles: options.maxLogFiles || 5,

            // Structured logging
            enableStructuredLogging: options.enableStructuredLogging !== false,
            includeStackTrace: options.includeStackTrace !== false,

            // Performance logging
            enablePerformanceLogging: options.enablePerformanceLogging !== false,
            slowOperationThreshold: options.slowOperationThreshold || 1000, // 1 second

            // Debug features
            enableDebugMode: options.enableDebugMode || false,
            debugCategories: options.debugCategories || ['fingerprint', 'merge', 'performance', 'cache'],

            ...options
        };

        // Log levels hierarchy
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };

        // Current log level numeric value
        this.currentLogLevel = this.logLevels[this.options.logLevel] || 1;

        // Metrics collection
        this.metrics = {
            operationCounts: new Map(),
            errorCounts: new Map(),
            performanceMetrics: [],
            debugEvents: []
        };

        // Initialize logging infrastructure
        this.initializeLogging();
    }

    /**
     * Initialize logging infrastructure
     */
    async initializeLogging() {
        if (this.options.enableFileLogging) {
            try {
                await fs.ensureDir(this.options.logDirectory);
                this.currentLogFile = path.join(
                    this.options.logDirectory,
                    `deduplication-${new Date().toISOString().split('T')[0]}.log`
                );
            } catch (error) {
                console.error('Failed to initialize file logging:', error.message);
                this.options.enableFileLogging = false;
            }
        }
    }

    /**
     * Log deduplication operation start
     * @param {string} operationType - Type of operation (file-level, scan-level)
     * @param {Object} context - Operation context
     */
    logOperationStart(operationType, context = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'operation',
            event: 'start',
            operationType,
            context: {
                findingsCount: context.findingsCount || 0,
                filePath: context.filePath || null,
                scanId: context.scanId || null,
                ...context
            }
        };

        this.writeLog(logData);
        this.updateMetrics('operation_start', operationType);

        if (this.options.enableDebugMode && this.shouldLogDebug('operation')) {
            this.debug(`Starting ${operationType} deduplication`, context);
        }
    }

    /**
     * Log deduplication operation completion
     * @param {string} operationType - Type of operation
     * @param {Object} result - Operation result
     * @param {number} duration - Operation duration in ms
     */
    logOperationComplete(operationType, result = {}, duration = 0) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'operation',
            event: 'complete',
            operationType,
            duration,
            result: {
                totalFindings: result.totalFindings || 0,
                uniqueFindings: result.uniqueFindings || 0,
                duplicatesRemoved: result.duplicatesRemoved || 0,
                deduplicationRate: result.deduplicationRate || '0%',
                memoryUsage: result.memoryUsage || 0,
                ...result
            }
        };

        this.writeLog(logData);
        this.updateMetrics('operation_complete', operationType);

        // Log performance metrics
        if (this.options.enablePerformanceLogging) {
            this.logPerformanceMetric(operationType, duration, result);
        }

        // Log slow operations
        if (duration > this.options.slowOperationThreshold) {
            this.warn(`Slow ${operationType} operation completed in ${duration}ms`, {
                operationType,
                duration,
                threshold: this.options.slowOperationThreshold,
                result
            });
        }

        if (this.options.enableDebugMode && this.shouldLogDebug('operation')) {
            this.debug(`Completed ${operationType} deduplication`, { duration, result });
        }
    }

    /**
     * Log fingerprint generation details
     * @param {Object} finding - Finding being fingerprinted
     * @param {string} fingerprint - Generated fingerprint
     * @param {Object} components - Fingerprint components
     */
    logFingerprintGeneration(finding, fingerprint, components = {}) {
        if (!this.shouldLogDebug('fingerprint')) return;

        const logData = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            category: 'fingerprint',
            event: 'generated',
            fingerprint,
            finding: {
                patternId: finding.pattern?.id,
                file: finding.file,
                value: finding.value?.substring(0, 100), // Truncate for logging
                location: finding.location
            },
            components: {
                normalizedFilePath: components.normalizedFilePath,
                normalizedValue: components.normalizedValue?.substring(0, 100),
                patternId: components.patternId,
                includeLocation: components.includeLocation
            }
        };

        this.writeLog(logData);
        this.debug('Generated fingerprint', logData);
    }

    /**
     * Log finding merge operation
     * @param {Object} existingFinding - Existing finding
     * @param {Object} newFinding - New finding being merged
     * @param {Object} mergedFinding - Result of merge
     */
    logFindingMerge(existingFinding, newFinding, mergedFinding) {
        if (!this.shouldLogDebug('merge')) return;

        const logData = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            category: 'merge',
            event: 'findings_merged',
            merge: {
                fingerprint: this.generateSimpleFingerprint(existingFinding),
                existingOccurrences: existingFinding.occurrenceCount || 1,
                newOccurrences: mergedFinding.occurrenceCount || 1,
                confidenceChange: {
                    from: existingFinding.confidence,
                    to: mergedFinding.confidence
                },
                severityChange: {
                    from: existingFinding.severity,
                    to: mergedFinding.severity
                },
                locationCount: mergedFinding.locations?.length || 0
            }
        };

        this.writeLog(logData);
        this.debug('Merged findings', logData.merge);
    }

    /**
     * Log cache operations
     * @param {string} operation - Cache operation (hit, miss, eviction)
     * @param {Object} details - Operation details
     */
    logCacheOperation(operation, details = {}) {
        if (!this.shouldLogDebug('cache')) return;

        const logData = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            category: 'cache',
            event: operation,
            cache: {
                size: details.size || 0,
                maxSize: details.maxSize || 0,
                hitRate: details.hitRate || 0,
                key: details.key ? details.key.substring(0, 50) : null,
                ...details
            }
        };

        this.writeLog(logData);
        this.debug(`Cache ${operation}`, logData.cache);
    }

    /**
     * Log performance metrics
     * @param {string} operationType - Type of operation
     * @param {number} duration - Duration in ms
     * @param {Object} result - Operation result
     */
    logPerformanceMetric(operationType, duration, result = {}) {
        const metric = {
            timestamp: Date.now(),
            operationType,
            duration,
            findingsProcessed: result.totalFindings || 0,
            duplicatesRemoved: result.duplicatesRemoved || 0,
            memoryUsage: result.memoryUsage || 0,
            deduplicationRate: parseFloat(result.deduplicationRate) || 0
        };

        this.metrics.performanceMetrics.push(metric);

        // Keep only recent metrics (last 1000)
        if (this.metrics.performanceMetrics.length > 1000) {
            this.metrics.performanceMetrics.shift();
        }

        if (this.options.enableDebugMode && this.shouldLogDebug('performance')) {
            this.debug('Performance metric recorded', metric);
        }
    }

    /**
     * Log error with context
     * @param {Error} error - Error object
     * @param {string} operationType - Type of operation that failed
     * @param {Object} context - Additional context
     */
    logError(error, operationType, context = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: 'error',
            category: 'error',
            event: 'operation_failed',
            operationType,
            error: {
                name: error.name,
                message: error.message,
                stack: this.options.includeStackTrace ? error.stack : null
            },
            context: {
                findingsCount: context.findingsCount || 0,
                memoryUsage: context.memoryUsage || 0,
                duration: context.duration || 0,
                ...context
            }
        };

        this.writeLog(logData);
        this.updateMetrics('error', operationType);

        // Always log errors to console
        console.error(`[DEDUPLICATION ERROR] ${operationType}:`, error.message);
        if (this.options.enableDebugMode) {
            console.error('Error context:', context);
            if (this.options.includeStackTrace) {
                console.error('Stack trace:', error.stack);
            }
        }
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {Object} context - Additional context
     */
    warn(message, context = {}) {
        if (this.currentLogLevel > this.logLevels.warn) return;

        const logData = {
            timestamp: new Date().toISOString(),
            level: 'warn',
            category: 'warning',
            message,
            context
        };

        this.writeLog(logData);

        if (this.options.enableConsoleLogging) {
            console.warn(`[DEDUPLICATION WARN] ${message}`, context);
        }
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {Object} context - Additional context
     */
    info(message, context = {}) {
        if (this.currentLogLevel > this.logLevels.info) return;

        const logData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            category: 'info',
            message,
            context
        };

        this.writeLog(logData);

        if (this.options.enableConsoleLogging) {
            console.log(`[DEDUPLICATION INFO] ${message}`, context);
        }
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {Object} context - Additional context
     */
    debug(message, context = {}) {
        if (this.currentLogLevel > this.logLevels.debug) return;
        if (!this.options.enableDebugMode) return;

        const logData = {
            timestamp: new Date().toISOString(),
            level: 'debug',
            category: 'debug',
            message,
            context
        };

        this.writeLog(logData);

        if (this.options.enableConsoleLogging) {
            console.debug(`[DEDUPLICATION DEBUG] ${message}`, context);
        }

        // Store debug events for analysis
        this.metrics.debugEvents.push({
            timestamp: Date.now(),
            message,
            context
        });

        // Keep only recent debug events (last 500)
        if (this.metrics.debugEvents.length > 500) {
            this.metrics.debugEvents.shift();
        }
    }

    /**
     * Write log entry to configured outputs
     * @param {Object} logData - Structured log data
     */
    async writeLog(logData) {
        // Write to file if enabled
        if (this.options.enableFileLogging && this.currentLogFile) {
            try {
                const logLine = this.options.enableStructuredLogging
                    ? JSON.stringify(logData) + '\n'
                    : this.formatLogLine(logData) + '\n';

                await fs.appendFile(this.currentLogFile, logLine);

                // Check file size and rotate if necessary
                await this.rotateLogFileIfNeeded();
            } catch (error) {
                console.error('Failed to write to log file:', error.message);
            }
        }
    }

    /**
     * Format log line for human-readable output
     * @param {Object} logData - Log data to format
     * @returns {string} Formatted log line
     */
    formatLogLine(logData) {
        const timestamp = logData.timestamp;
        const level = logData.level.toUpperCase().padEnd(5);
        const category = logData.category.toUpperCase().padEnd(12);
        const message = logData.message || logData.event || 'N/A';

        let line = `${timestamp} [${level}] [${category}] ${message}`;

        // Add context if available
        if (logData.context && Object.keys(logData.context).length > 0) {
            line += ` | Context: ${JSON.stringify(logData.context)}`;
        }

        // Add result if available
        if (logData.result && Object.keys(logData.result).length > 0) {
            line += ` | Result: ${JSON.stringify(logData.result)}`;
        }

        return line;
    }

    /**
     * Rotate log file if it exceeds size limit
     */
    async rotateLogFileIfNeeded() {
        try {
            const stats = await fs.stat(this.currentLogFile);
            if (stats.size > this.options.maxLogFileSize) {
                // Create rotated filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);

                // Move current log to rotated filename
                await fs.move(this.currentLogFile, rotatedFile);

                // Clean up old log files
                await this.cleanupOldLogFiles();

                this.info('Log file rotated', {
                    oldFile: rotatedFile,
                    newFile: this.currentLogFile,
                    size: stats.size
                });
            }
        } catch (error) {
            console.error('Failed to rotate log file:', error.message);
        }
    }

    /**
     * Clean up old log files beyond retention limit
     */
    async cleanupOldLogFiles() {
        try {
            const files = await fs.readdir(this.options.logDirectory);
            const logFiles = files
                .filter(file => file.startsWith('deduplication-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.options.logDirectory, file),
                    stat: null
                }));

            // Get file stats
            for (const file of logFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    // Skip files we can't stat
                }
            }

            // Sort by modification time (newest first)
            const sortedFiles = logFiles
                .filter(file => file.stat)
                .sort((a, b) => b.stat.mtime - a.stat.mtime);

            // Remove files beyond retention limit
            const filesToDelete = sortedFiles.slice(this.options.maxLogFiles);
            for (const file of filesToDelete) {
                await fs.remove(file.path);
                this.debug('Deleted old log file', { file: file.name });
            }
        } catch (error) {
            console.error('Failed to cleanup old log files:', error.message);
        }
    }

    /**
     * Check if debug logging should be enabled for category
     * @param {string} category - Debug category
     * @returns {boolean} True if should log debug for category
     */
    shouldLogDebug(category) {
        return this.options.enableDebugMode &&
            this.options.debugCategories.includes(category);
    }

    /**
     * Update metrics counters
     * @param {string} metricType - Type of metric
     * @param {string} key - Metric key
     */
    updateMetrics(metricType, key) {
        const metricsMap = metricType === 'error' ? this.metrics.errorCounts : this.metrics.operationCounts;
        metricsMap.set(key, (metricsMap.get(key) || 0) + 1);
    }

    /**
     * Generate simple fingerprint for logging (not cryptographic)
     * @param {Object} finding - Finding object
     * @returns {string} Simple fingerprint
     */
    generateSimpleFingerprint(finding) {
        const components = [
            finding.pattern?.id || 'unknown',
            finding.file || 'unknown',
            (finding.value || '').substring(0, 20)
        ];
        return components.join('|');
    }

    /**
     * Get current metrics summary
     * @returns {Object} Metrics summary
     */
    getMetrics() {
        return {
            operations: Object.fromEntries(this.metrics.operationCounts),
            errors: Object.fromEntries(this.metrics.errorCounts),
            performance: {
                totalOperations: this.metrics.performanceMetrics.length,
                averageDuration: this.metrics.performanceMetrics.length > 0
                    ? Math.round(this.metrics.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.performanceMetrics.length)
                    : 0,
                recentMetrics: this.metrics.performanceMetrics.slice(-10)
            },
            debug: {
                totalEvents: this.metrics.debugEvents.length,
                recentEvents: this.metrics.debugEvents.slice(-10)
            }
        };
    }

    /**
     * Reset all metrics
     */
    resetMetrics() {
        this.metrics.operationCounts.clear();
        this.metrics.errorCounts.clear();
        this.metrics.performanceMetrics = [];
        this.metrics.debugEvents = [];
    }

    /**
     * Get log file paths
     * @returns {Array} Array of log file paths
     */
    async getLogFiles() {
        if (!this.options.enableFileLogging) {
            return [];
        }

        try {
            const files = await fs.readdir(this.options.logDirectory);
            return files
                .filter(file => file.startsWith('deduplication-') && file.endsWith('.log'))
                .map(file => path.join(this.options.logDirectory, file));
        } catch (error) {
            return [];
        }
    }

    /**
     * Shutdown logger and cleanup resources
     */
    async shutdown() {
        this.info('Deduplication logger shutting down');

        // Final metrics log
        const metrics = this.getMetrics();
        this.info('Final metrics summary', metrics);

        // No additional cleanup needed for this implementation
    }
}

module.exports = { DeduplicationLogger };