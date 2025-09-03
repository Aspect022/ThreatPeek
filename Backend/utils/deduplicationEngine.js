/**
 * DeduplicationEngine - Comprehensive deduplication system for security scan findings
 * Handles file-level and scan-level deduplication with performance optimization
 */

const crypto = require('crypto');
const { DeduplicationMonitor } = require('./deduplicationMonitor');
const { DeduplicationLogger } = require('./deduplicationLogger');
const { DeduplicationDebugger } = require('./deduplicationDebugger');

class DeduplicationEngine {
    constructor(options = {}) {
        this.options = {
            enableFileLevel: true,
            enableScanLevel: true,
            preserveContext: true,
            maxCacheSize: 10000,
            // Performance monitoring options
            enablePerformanceMonitoring: true,
            maxDeduplicationTimeMs: 30000, // 30 seconds max
            memoryLimitMB: 512,
            // Circuit breaker options
            enableCircuitBreaker: true,
            circuitBreakerThreshold: 5, // failures before opening
            circuitBreakerResetTimeMs: 60000, // 1 minute
            ...options
        };

        // Cache for fingerprints to improve performance
        this.fingerprintCache = new Map();

        // Map to store deduplicated findings during scan
        this.deduplicatedFindings = new Map();

        // Statistics tracking
        this.stats = {
            totalFindings: 0,
            duplicatesRemoved: 0,
            uniqueFindings: 0,
            deduplicationTime: 0,
            memoryUsage: 0,
            // Performance metrics
            averageDeduplicationTime: 0,
            peakMemoryUsage: 0,
            operationCount: 0,
            // Error tracking
            errorCount: 0,
            lastError: null,
            fallbackCount: 0
        };

        // Circuit breaker state
        this.circuitBreaker = {
            state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
            failureCount: 0,
            lastFailureTime: null,
            nextAttemptTime: null
        };

        // Performance monitoring
        this.performanceMonitor = {
            operationTimes: [],
            memorySnapshots: [],
            maxOperationTime: 0,
            slowOperationThreshold: 1000 // 1 second
        };

        // Initialize monitoring system
        this.monitor = this.options.monitor || new DeduplicationMonitor({
            enableAlerting: this.options.enableAlerting !== false,
            slowOperationThreshold: this.options.maxDeduplicationTimeMs || 30000,
            memoryWarningThreshold: this.options.memoryLimitMB || 512
        });

        // Initialize logging system
        this.logger = this.options.logger || new DeduplicationLogger({
            logLevel: this.options.logLevel || 'info',
            enableDebugMode: this.options.enableDebugMode || false,
            enablePerformanceLogging: this.options.enablePerformanceLogging !== false,
            slowOperationThreshold: this.options.maxDeduplicationTimeMs || 30000
        });

        // Initialize debugging system
        this.debugger = this.options.debugger || new DeduplicationDebugger({
            enableDetailedAnalysis: this.options.enableDetailedAnalysis !== false,
            enableFingerprintAnalysis: this.options.enableFingerprintAnalysis !== false,
            enablePerformanceAnalysis: this.options.enablePerformanceAnalysis !== false
        });
    }

    /**
     * Generate unique fingerprint for a finding
     * @param {Object} finding - Finding object
     * @param {boolean} includeLocation - Whether to include exact location in fingerprint
     * @returns {string} SHA-256 fingerprint
     */
    generateFingerprint(finding, includeLocation = false) {
        // Create cache key for performance
        const cacheKey = JSON.stringify({
            patternId: finding.pattern?.id,
            file: finding.file,
            value: finding.value,
            includeLocation,
            location: includeLocation ? finding.location : undefined
        });

        if (this.fingerprintCache.has(cacheKey)) {
            this.logger.logCacheOperation('hit', {
                size: this.fingerprintCache.size,
                maxSize: this.options.maxCacheSize,
                key: cacheKey
            });
            return this.fingerprintCache.get(cacheKey);
        }

        this.logger.logCacheOperation('miss', {
            size: this.fingerprintCache.size,
            maxSize: this.options.maxCacheSize,
            key: cacheKey
        });

        // Normalize components for consistent fingerprinting
        const normalizedFilePath = this.normalizeFilePath(finding.file);
        const normalizedValue = this.normalizeValue(finding.value);
        const patternId = finding.pattern?.id || 'unknown';

        // Create fingerprint components
        const components = [
            patternId,
            normalizedFilePath,
            normalizedValue
        ];

        // Include location if requested (for exact duplicate detection)
        if (includeLocation && finding.location) {
            components.push(`${finding.location.line}:${finding.location.column}`);
        }

        // Generate SHA-256 hash
        const fingerprint = crypto
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex');

        // Log fingerprint generation for debugging
        this.logger.logFingerprintGeneration(finding, fingerprint, {
            normalizedFilePath,
            normalizedValue,
            patternId,
            includeLocation
        });

        // Cache the result (with LRU eviction if needed)
        if (this.fingerprintCache.size >= this.options.maxCacheSize) {
            const firstKey = this.fingerprintCache.keys().next().value;
            this.fingerprintCache.delete(firstKey);
            this.logger.logCacheOperation('eviction', {
                size: this.fingerprintCache.size,
                maxSize: this.options.maxCacheSize,
                evictedKey: firstKey
            });
        }
        this.fingerprintCache.set(cacheKey, fingerprint);

        return fingerprint;
    }

    /**
     * Normalize file path for consistent comparison
     * @param {string} filePath - File path to normalize
     * @returns {string} Normalized file path
     */
    normalizeFilePath(filePath) {
        if (!filePath) return '';

        // Convert to forward slashes and remove leading/trailing slashes
        return filePath
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '')
            .toLowerCase();
    }

    /**
     * Normalize finding value for consistent comparison
     * @param {string} value - Value to normalize
     * @returns {string} Normalized value
     */
    normalizeValue(value) {
        if (!value) return '';

        // Trim whitespace and normalize case for comparison
        return value.trim().toLowerCase();
    }

    /**
     * Deduplicate findings within a single file
     * @param {Array} findings - Array of findings from a single file
     * @param {string} filePath - Path of the file being processed
     * @returns {Array} Deduplicated findings
     */
    deduplicateFileFindings(findings, filePath) {
        if (!this.options.enableFileLevel || !findings || findings.length === 0) {
            return findings;
        }

        // Log operation start
        this.logger.logOperationStart('file-level', {
            findingsCount: findings.length,
            filePath
        });

        // Use monitoring wrapper for error handling and performance tracking
        const result = this.executeWithMonitoring(
            (findings) => this._performFileDeduplication(findings, filePath),
            findings,
            'file-level'
        );

        // Log operation completion
        const duplicatesRemoved = findings.length - result.length;
        this.logger.logOperationComplete('file-level', {
            totalFindings: findings.length,
            uniqueFindings: result.length,
            duplicatesRemoved,
            deduplicationRate: findings.length > 0 ? `${((duplicatesRemoved / findings.length) * 100).toFixed(1)}%` : '0%'
        });

        return result;
    }

    /**
     * Internal file deduplication logic
     * @param {Array} findings - Array of findings from a single file
     * @param {string} filePath - Path of the file being processed
     * @returns {Array} Deduplicated findings
     */
    _performFileDeduplication(findings, filePath) {
        const fileFingerprints = new Map();
        const deduplicatedFindings = [];

        for (const finding of findings) {
            // Generate fingerprint for this finding
            const fingerprint = this.generateFingerprint(finding, false);

            if (fileFingerprints.has(fingerprint)) {
                // Merge with existing finding
                const existingFinding = fileFingerprints.get(fingerprint);
                const mergedFinding = this.mergeFindings(existingFinding, finding);
                fileFingerprints.set(fingerprint, mergedFinding);

                // Update the finding in the deduplicated array
                const existingIndex = deduplicatedFindings.findIndex(f =>
                    this.generateFingerprint(f, false) === fingerprint
                );
                if (existingIndex !== -1) {
                    deduplicatedFindings[existingIndex] = mergedFinding;
                }
            } else {
                // Add new finding with initial occurrence count
                const enhancedFinding = {
                    ...finding,
                    occurrenceCount: 1,
                    locations: [{
                        file: filePath,
                        line: finding.location?.line || 0,
                        column: finding.location?.column || 0,
                        context: finding.context || {}
                    }],
                    firstSeen: Date.now(),
                    lastSeen: Date.now()
                };

                fileFingerprints.set(fingerprint, enhancedFinding);
                deduplicatedFindings.push(enhancedFinding);
            }
        }

        // Update statistics
        const duplicatesRemoved = findings.length - deduplicatedFindings.length;
        this.stats.duplicatesRemoved += duplicatesRemoved;

        return deduplicatedFindings;
    }

    /**
     * Deduplicate findings across entire scan
     * @param {Array} allFindings - Array of all findings from scan
     * @returns {Array} Deduplicated findings
     */
    deduplicateScanFindings(allFindings) {
        if (!this.options.enableScanLevel || !allFindings || allFindings.length === 0) {
            return allFindings;
        }

        this.stats.totalFindings = allFindings.length;

        // Log operation start
        this.logger.logOperationStart('scan-level', {
            findingsCount: allFindings.length
        });

        // Use monitoring wrapper for error handling and performance tracking
        const result = this.executeWithMonitoring(
            (findings) => this._performScanDeduplication(findings),
            allFindings,
            'scan-level'
        );

        // Log operation completion with detailed stats
        this.logger.logOperationComplete('scan-level', {
            totalFindings: this.stats.totalFindings,
            uniqueFindings: this.stats.uniqueFindings,
            duplicatesRemoved: this.stats.duplicatesRemoved,
            deduplicationRate: this.stats.totalFindings > 0
                ? `${((this.stats.duplicatesRemoved / this.stats.totalFindings) * 100).toFixed(1)}%`
                : '0%',
            memoryUsage: process.memoryUsage().heapUsed
        });

        // Perform detailed analysis if debugging is enabled
        if (this.options.enableDetailedAnalysis) {
            const analysisData = {
                type: 'scan-level',
                findings: allFindings,
                result: {
                    totalFindings: this.stats.totalFindings,
                    uniqueFindings: this.stats.uniqueFindings,
                    duplicatesRemoved: this.stats.duplicatesRemoved
                },
                performance: {
                    duration: this.stats.deduplicationTime,
                    memoryUsage: process.memoryUsage().heapUsed
                }
            };
            this.debugger.analyzeOperation(analysisData);
        }

        return result;
    }

    /**
     * Internal scan deduplication logic
     * @param {Array} allFindings - Array of all findings from scan
     * @returns {Array} Deduplicated findings
     */
    _performScanDeduplication(allFindings) {
        // Clear previous scan state
        this.deduplicatedFindings.clear();

        const scanFingerprints = new Map();
        const finalFindings = [];

        for (const finding of allFindings) {
            // Generate fingerprint for cross-file deduplication
            const fingerprint = this.generateFingerprint(finding, false);

            if (scanFingerprints.has(fingerprint)) {
                // Merge with existing finding
                const existingFinding = scanFingerprints.get(fingerprint);
                const mergedFinding = this.mergeFindings(existingFinding, finding);
                scanFingerprints.set(fingerprint, mergedFinding);

                // Update the finding in final results
                const existingIndex = finalFindings.findIndex(f =>
                    this.generateFingerprint(f, false) === fingerprint
                );
                if (existingIndex !== -1) {
                    finalFindings[existingIndex] = mergedFinding;
                }
            } else {
                // Add new unique finding
                const enhancedFinding = this.enhanceFinding(finding);
                scanFingerprints.set(fingerprint, enhancedFinding);
                finalFindings.push(enhancedFinding);
            }
        }

        // Update final statistics
        this.stats.uniqueFindings = finalFindings.length;
        this.stats.duplicatesRemoved = this.stats.totalFindings - this.stats.uniqueFindings;

        return finalFindings;
    }

    /**
     * Merge duplicate findings preserving important data
     * @param {Object} existingFinding - Existing finding
     * @param {Object} newFinding - New finding to merge
     * @returns {Object} Merged finding
     */
    mergeFindings(existingFinding, newFinding) {
        // Preserve highest confidence score
        const highestConfidence = Math.max(
            existingFinding.confidence || 0,
            newFinding.confidence || 0
        );

        // Preserve most severe severity level
        const severityLevels = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'info': 0 };
        const existingSeverity = severityLevels[existingFinding.severity] || 0;
        const newSeverity = severityLevels[newFinding.severity] || 0;
        const mostSevereSeverity = existingSeverity >= newSeverity
            ? existingFinding.severity
            : newFinding.severity;

        // Merge locations
        const existingLocations = existingFinding.locations || [];
        const newLocation = {
            file: newFinding.file,
            line: newFinding.location?.line || 0,
            column: newFinding.location?.column || 0,
            context: newFinding.context || {}
        };

        // Check if this location already exists
        const locationExists = existingLocations.some(loc =>
            loc.file === newLocation.file &&
            loc.line === newLocation.line &&
            loc.column === newLocation.column
        );

        const mergedLocations = locationExists
            ? existingLocations
            : [...existingLocations, newLocation];

        const mergedFinding = {
            ...existingFinding,
            confidence: highestConfidence,
            severity: mostSevereSeverity,
            occurrenceCount: (existingFinding.occurrenceCount || 1) + 1,
            locations: mergedLocations,
            lastSeen: Date.now(),
            // Preserve additional context if available
            ...(this.options.preserveContext && {
                allContexts: [
                    ...(existingFinding.allContexts || [existingFinding.context]),
                    newFinding.context
                ].filter(Boolean)
            })
        };

        // Log the merge operation for debugging
        this.logger.logFindingMerge(existingFinding, newFinding, mergedFinding);

        return mergedFinding;
    }

    /**
     * Enhance finding with deduplication metadata
     * @param {Object} finding - Original finding
     * @returns {Object} Enhanced finding
     */
    enhanceFinding(finding) {
        return {
            ...finding,
            occurrenceCount: finding.occurrenceCount || 1,
            locations: finding.locations || [{
                file: finding.file,
                line: finding.location?.line || 0,
                column: finding.location?.column || 0,
                context: finding.context || {}
            }],
            firstSeen: Date.now(),
            lastSeen: Date.now()
        };
    }

    /**
     * Get deduplication statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.fingerprintCache.size,
            deduplicationRate: this.stats.totalFindings > 0
                ? (this.stats.duplicatesRemoved / this.stats.totalFindings * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Clear all caches and reset state
     */
    reset() {
        this.fingerprintCache.clear();
        this.deduplicatedFindings.clear();
        this.stats = {
            totalFindings: 0,
            duplicatesRemoved: 0,
            uniqueFindings: 0,
            deduplicationTime: 0,
            memoryUsage: 0
        };
    }

    /**
     * Check if deduplication should be skipped due to performance constraints
     * @param {Array} findings - Findings array to check
     * @returns {boolean} True if deduplication should be skipped
     */
    shouldSkipDeduplication(findings) {
        // Check circuit breaker state
        if (this.isCircuitBreakerOpen()) {
            console.warn('Skipping deduplication: Circuit breaker is OPEN');
            return true;
        }

        // Skip if too many findings (performance safeguard)
        if (findings.length > 10000) {
            console.warn(`Skipping deduplication for ${findings.length} findings (performance limit)`);
            return true;
        }

        // Skip if memory usage is too high
        const memoryUsage = process.memoryUsage().heapUsed;
        const memoryLimitBytes = this.options.memoryLimitMB * 1024 * 1024;
        if (memoryUsage > memoryLimitBytes) {
            console.warn(`Skipping deduplication due to high memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB`);
            return true;
        }

        return false;
    }

    /**
     * Execute deduplication with performance monitoring and error handling
     * @param {Function} operation - Deduplication operation to execute
     * @param {Array} findings - Findings to process
     * @param {string} operationType - Type of operation for logging
     * @returns {Array} Processed findings or fallback results
     */
    executeWithMonitoring(operation, findings, operationType = 'deduplication') {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;

        try {
            // Check if we should skip due to performance constraints
            if (this.shouldSkipDeduplication(findings)) {
                this.stats.fallbackCount++;
                return this.fallbackDeduplication(findings, 'performance_limit');
            }

            // Execute the operation with timeout
            const result = this.executeWithTimeout(operation, findings, this.options.maxDeduplicationTimeMs);

            // Record successful operation
            this.recordSuccessfulOperation(startTime, startMemory, operationType);

            return result;

        } catch (error) {
            // Handle deduplication failure
            this.handleDeduplicationError(error, operationType);
            this.stats.fallbackCount++;
            return this.fallbackDeduplication(findings, 'error');
        }
    }

    /**
     * Execute operation with timeout
     * @param {Function} operation - Operation to execute
     * @param {Array} findings - Findings to process
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Array} Operation result
     */
    executeWithTimeout(operation, findings, timeoutMs) {
        const startTime = Date.now();

        // Simple timeout check during operation
        const result = operation.call(this, findings);

        const executionTime = Date.now() - startTime;
        if (executionTime > timeoutMs) {
            throw new Error(`Deduplication timeout: ${executionTime}ms > ${timeoutMs}ms`);
        }

        return result;
    }

    /**
     * Record successful operation metrics
     * @param {number} startTime - Operation start time
     * @param {number} startMemory - Starting memory usage
     * @param {string} operationType - Type of operation
     */
    recordSuccessfulOperation(startTime, startMemory, operationType) {
        const executionTime = Date.now() - startTime;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryDelta = endMemory - startMemory;

        // Update performance statistics
        this.stats.operationCount++;
        this.stats.deduplicationTime += executionTime;
        this.stats.averageDeduplicationTime = this.stats.deduplicationTime / this.stats.operationCount;
        this.stats.memoryUsage = endMemory;
        this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, endMemory);

        // Record operation in monitoring system
        this.monitor.recordOperation({
            type: operationType,
            duration: executionTime,
            findingsProcessed: this.stats.totalFindings || 0,
            duplicatesRemoved: this.stats.duplicatesRemoved || 0,
            memoryUsage: endMemory,
            success: true
        });

        // Record performance monitoring data
        if (this.options.enablePerformanceMonitoring) {
            this.performanceMonitor.operationTimes.push({
                timestamp: Date.now(),
                duration: executionTime,
                type: operationType,
                memoryDelta
            });

            this.performanceMonitor.memorySnapshots.push({
                timestamp: Date.now(),
                heapUsed: endMemory,
                type: operationType
            });

            this.performanceMonitor.maxOperationTime = Math.max(
                this.performanceMonitor.maxOperationTime,
                executionTime
            );

            // Keep only recent performance data (last 100 operations)
            if (this.performanceMonitor.operationTimes.length > 100) {
                this.performanceMonitor.operationTimes.shift();
            }
            if (this.performanceMonitor.memorySnapshots.length > 100) {
                this.performanceMonitor.memorySnapshots.shift();
            }

            // Log slow operations
            if (executionTime > this.performanceMonitor.slowOperationThreshold) {
                console.warn(`Slow deduplication operation: ${operationType} took ${executionTime}ms`);
            }
        }

        // Reset circuit breaker on successful operation
        if (this.circuitBreaker.state === 'HALF_OPEN') {
            this.circuitBreaker.state = 'CLOSED';
            this.circuitBreaker.failureCount = 0;
            console.log('Circuit breaker reset to CLOSED after successful operation');
        }
    }

    /**
     * Handle deduplication errors and update circuit breaker
     * @param {Error} error - Error that occurred
     * @param {string} operationType - Type of operation that failed
     */
    handleDeduplicationError(error, operationType) {
        this.stats.errorCount++;
        this.stats.lastError = {
            message: error.message,
            timestamp: Date.now(),
            operationType,
            stack: error.stack
        };

        // Log error with detailed context
        this.logger.logError(error, operationType, {
            findingsCount: this.stats.totalFindings || 0,
            memoryUsage: process.memoryUsage().heapUsed,
            cacheSize: this.fingerprintCache.size,
            circuitBreakerState: this.circuitBreaker.state
        });

        // Record error in monitoring system
        this.monitor.recordError({
            type: error.name || 'DeduplicationError',
            message: error.message,
            stack: error.stack,
            operationType,
            findingsCount: this.stats.totalFindings || 0,
            recoveryAction: 'fallback'
        });

        // Update circuit breaker
        if (this.options.enableCircuitBreaker) {
            this.circuitBreaker.failureCount++;
            this.circuitBreaker.lastFailureTime = Date.now();

            if (this.circuitBreaker.failureCount >= this.options.circuitBreakerThreshold) {
                this.circuitBreaker.state = 'OPEN';
                this.circuitBreaker.nextAttemptTime = Date.now() + this.options.circuitBreakerResetTimeMs;
                this.logger.warn(`Circuit breaker OPENED after ${this.circuitBreaker.failureCount} failures`, {
                    threshold: this.options.circuitBreakerThreshold,
                    resetTime: this.options.circuitBreakerResetTimeMs
                });
            }
        }
    }

    /**
     * Check if circuit breaker is open
     * @returns {boolean} True if circuit breaker is open
     */
    isCircuitBreakerOpen() {
        if (!this.options.enableCircuitBreaker) {
            return false;
        }

        const now = Date.now();

        if (this.circuitBreaker.state === 'OPEN') {
            if (now >= this.circuitBreaker.nextAttemptTime) {
                this.circuitBreaker.state = 'HALF_OPEN';
                console.log('Circuit breaker moved to HALF_OPEN state');
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Fallback deduplication when main deduplication fails
     * @param {Array} findings - Original findings
     * @param {string} reason - Reason for fallback
     * @returns {Array} Findings with minimal processing
     */
    fallbackDeduplication(findings, reason) {
        console.warn(`Using fallback deduplication due to: ${reason}`);

        // Simple fallback: just add basic metadata without complex deduplication
        return findings.map(finding => ({
            ...finding,
            occurrenceCount: 1,
            locations: [{
                file: finding.file,
                line: finding.location?.line || 0,
                column: finding.location?.column || 0,
                context: finding.context || {}
            }],
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            deduplicationStatus: 'fallback',
            fallbackReason: reason
        }));
    }

    /**
     * Get comprehensive performance and error statistics
     * @returns {Object} Extended statistics object
     */
    getStats() {
        const baseStats = {
            ...this.stats,
            cacheSize: this.fingerprintCache.size,
            deduplicationRate: this.stats.totalFindings > 0
                ? (this.stats.duplicatesRemoved / this.stats.totalFindings * 100).toFixed(2) + '%'
                : '0%'
        };

        if (this.options.enablePerformanceMonitoring) {
            const recentOperations = this.performanceMonitor.operationTimes.slice(-10);
            const recentAvgTime = recentOperations.length > 0
                ? recentOperations.reduce((sum, op) => sum + op.duration, 0) / recentOperations.length
                : 0;

            return {
                ...baseStats,
                performance: {
                    maxOperationTime: this.performanceMonitor.maxOperationTime,
                    recentAverageTime: Math.round(recentAvgTime),
                    slowOperationThreshold: this.performanceMonitor.slowOperationThreshold,
                    totalOperations: this.performanceMonitor.operationTimes.length
                },
                circuitBreaker: {
                    state: this.circuitBreaker.state,
                    failureCount: this.circuitBreaker.failureCount,
                    lastFailureTime: this.circuitBreaker.lastFailureTime,
                    nextAttemptTime: this.circuitBreaker.nextAttemptTime
                },
                memory: {
                    current: Math.round(this.stats.memoryUsage / 1024 / 1024) + 'MB',
                    peak: Math.round(this.stats.peakMemoryUsage / 1024 / 1024) + 'MB',
                    limit: this.options.memoryLimitMB + 'MB'
                }
            };
        }

        return baseStats;
    }

    /**
     * Get detailed performance report
     * @returns {Object} Performance report
     */
    getPerformanceReport() {
        if (!this.options.enablePerformanceMonitoring) {
            return { enabled: false };
        }

        const operations = this.performanceMonitor.operationTimes;
        const memorySnapshots = this.performanceMonitor.memorySnapshots;

        return {
            enabled: true,
            summary: {
                totalOperations: operations.length,
                averageTime: operations.length > 0
                    ? Math.round(operations.reduce((sum, op) => sum + op.duration, 0) / operations.length)
                    : 0,
                maxTime: this.performanceMonitor.maxOperationTime,
                slowOperations: operations.filter(op => op.duration > this.performanceMonitor.slowOperationThreshold).length
            },
            recentOperations: operations.slice(-10).map(op => ({
                timestamp: new Date(op.timestamp).toISOString(),
                duration: op.duration,
                type: op.type,
                memoryDelta: Math.round(op.memoryDelta / 1024) + 'KB'
            })),
            memoryTrend: memorySnapshots.slice(-10).map(snapshot => ({
                timestamp: new Date(snapshot.timestamp).toISOString(),
                heapUsed: Math.round(snapshot.heapUsed / 1024 / 1024) + 'MB',
                type: snapshot.type
            })),
            circuitBreaker: this.circuitBreaker
        };
    }

    /**
     * Get comprehensive observability report including logging and debugging data
     * @returns {Object} Complete observability report
     */
    getObservabilityReport() {
        return {
            timestamp: new Date().toISOString(),
            deduplication: {
                stats: this.getStats(),
                performance: this.getPerformanceReport()
            },
            monitoring: {
                metrics: this.monitor.getMetrics(),
                systemHealth: this.monitor.metrics?.systemHealth || { status: 'unknown' }
            },
            logging: {
                metrics: this.logger.getMetrics(),
                logFiles: this.logger.getLogFiles ? this.logger.getLogFiles() : []
            },
            debugging: {
                report: this.debugger.getDebugReport(),
                recommendations: this.debugger.getTopRecommendations ? this.debugger.getTopRecommendations() : []
            },
            configuration: {
                options: {
                    enableFileLevel: this.options.enableFileLevel,
                    enableScanLevel: this.options.enableScanLevel,
                    maxCacheSize: this.options.maxCacheSize,
                    enablePerformanceMonitoring: this.options.enablePerformanceMonitoring,
                    enableCircuitBreaker: this.options.enableCircuitBreaker,
                    enableDebugMode: this.options.enableDebugMode,
                    logLevel: this.options.logLevel
                },
                thresholds: {
                    maxDeduplicationTimeMs: this.options.maxDeduplicationTimeMs,
                    memoryLimitMB: this.options.memoryLimitMB,
                    circuitBreakerThreshold: this.options.circuitBreakerThreshold,
                    slowOperationThreshold: this.performanceMonitor.slowOperationThreshold
                }
            }
        };
    }

    /**
     * Export detailed metrics for external monitoring systems
     * @returns {Object} Metrics in a format suitable for monitoring systems
     */
    exportMetrics() {
        const stats = this.getStats();
        const performance = this.getPerformanceReport();
        const monitoring = this.monitor.getMetrics();
        const logging = this.logger.getMetrics();

        return {
            // Core deduplication metrics
            'deduplication.operations.total': stats.operationCount || 0,
            'deduplication.findings.total': stats.totalFindings || 0,
            'deduplication.findings.unique': stats.uniqueFindings || 0,
            'deduplication.duplicates.removed': stats.duplicatesRemoved || 0,
            'deduplication.rate.percentage': parseFloat(stats.deduplicationRate) || 0,
            'deduplication.errors.total': stats.errorCount || 0,
            'deduplication.fallbacks.total': stats.fallbackCount || 0,

            // Performance metrics
            'deduplication.performance.average_duration_ms': stats.averageDeduplicationTime || 0,
            'deduplication.performance.peak_memory_mb': Math.round((stats.peakMemoryUsage || 0) / 1024 / 1024),
            'deduplication.performance.current_memory_mb': Math.round((stats.memoryUsage || 0) / 1024 / 1024),
            'deduplication.performance.slow_operations': performance.enabled ? performance.summary.slowOperations : 0,

            // Cache metrics
            'deduplication.cache.size': this.fingerprintCache.size,
            'deduplication.cache.max_size': this.options.maxCacheSize,
            'deduplication.cache.utilization': this.fingerprintCache.size / this.options.maxCacheSize,

            // Circuit breaker metrics
            'deduplication.circuit_breaker.state': this.circuitBreaker.state === 'CLOSED' ? 0 : (this.circuitBreaker.state === 'OPEN' ? 2 : 1),
            'deduplication.circuit_breaker.failure_count': this.circuitBreaker.failureCount,

            // Monitoring system metrics
            'deduplication.monitoring.operations.total': monitoring.operations?.total || 0,
            'deduplication.monitoring.errors.total': monitoring.errors?.total || 0,
            'deduplication.monitoring.alerts.total': monitoring.alerts?.total || 0,
            'deduplication.monitoring.health.status': monitoring.systemHealth?.status === 'healthy' ? 1 : 0,

            // Logging metrics
            'deduplication.logging.operations.total': Object.values(logging.operations || {}).reduce((sum, count) => sum + count, 0),
            'deduplication.logging.errors.total': Object.values(logging.errors || {}).reduce((sum, count) => sum + count, 0),
            'deduplication.logging.performance.average_duration_ms': logging.performance?.averageDuration || 0,

            // Timestamp
            'deduplication.metrics.timestamp': Date.now()
        };
    }
}

module.exports = { DeduplicationEngine };