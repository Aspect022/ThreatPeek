/**
 * Resource Manager - Integrated resource management combining rate limiting and resource monitoring
 * Provides unified interface for resource management across the application
 */

const { RateLimitingService } = require('./rateLimitingService');
const { ResourceMonitoringService } = require('./resourceMonitoringService');
const EventEmitter = require('events');

class ResourceManager extends EventEmitter {
    constructor(options = {}) {
        super();

        // Initialize services
        this.rateLimiter = new RateLimitingService(options.rateLimiting || {});
        this.resourceMonitor = new ResourceMonitoringService(options.resourceMonitoring || {});

        // Configuration
        this.config = {
            enableAutoScaling: options.enableAutoScaling !== false,
            enableResourceProtection: options.enableResourceProtection !== false,
            emergencyShutdownThreshold: options.emergencyShutdownThreshold || 0.95, // 95% memory usage
            resourceRecoveryDelay: options.resourceRecoveryDelay || 30000, // 30 seconds
            ...options
        };

        // State
        this.state = {
            isActive: false,
            emergencyMode: false,
            lastEmergencyTime: null,
            resourceProtectionActive: false,
            autoScalingActive: false
        };

        // Bind event handlers
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers between services
     */
    setupEventHandlers() {
        // Resource monitoring alerts
        this.resourceMonitor.on('resourceAlert', (alert) => {
            this.handleResourceAlert(alert);
        });

        this.resourceMonitor.on('memoryStatsUpdated', (stats) => {
            this.handleMemoryStatsUpdate(stats);
        });

        // Rate limiting events
        this.rateLimiter.on('backoffApplied', (data) => {
            console.log(`🚦 Rate limiting backoff applied: ${data.target} (${data.backoffMs}ms)`);
            this.emit('rateLimitBackoff', data);
        });

        this.rateLimiter.on('rateLimitAdjusted', (data) => {
            console.log(`📊 Rate limit adjusted: ${data.target} (${data.oldRate} -> ${data.newRate} req/s)`);
            this.emit('rateLimitAdjusted', data);
        });
    }

    /**
     * Start resource management
     */
    async start() {
        if (this.state.isActive) {
            return;
        }

        console.log('🚀 Starting Resource Manager...');

        // Start monitoring
        this.resourceMonitor.startMonitoring();

        this.state.isActive = true;

        console.log('✅ Resource Manager started');
        this.emit('started');
    }

    /**
     * Stop resource management
     */
    async stop() {
        if (!this.state.isActive) {
            return;
        }

        console.log('🛑 Stopping Resource Manager...');

        // Stop monitoring
        this.resourceMonitor.stopMonitoring();

        // Shutdown services
        this.rateLimiter.shutdown();
        await this.resourceMonitor.shutdown();

        this.state.isActive = false;
        this.state.emergencyMode = false;
        this.state.resourceProtectionActive = false;
        this.state.autoScalingActive = false;

        console.log('✅ Resource Manager stopped');
        this.emit('stopped');
    }

    /**
     * Execute request with integrated resource management
     * @param {string} target - Target identifier
     * @param {Function} requestFn - Function to execute
     * @param {Object} options - Execution options
     * @returns {Promise} Request result
     */
    async executeWithResourceManagement(target, requestFn, options = {}) {
        // Check if we're in emergency mode
        if (this.state.emergencyMode) {
            throw new Error('System in emergency mode due to resource constraints');
        }

        // Check resource availability
        const resourceCheck = await this.checkResourceAvailability();
        if (!resourceCheck.available) {
            throw new Error(`Resource constraints: ${resourceCheck.reason}`);
        }

        // Execute with rate limiting
        return await this.rateLimiter.executeWithRateLimit(target, requestFn, {
            ...options,
            rateLimitConfig: this.calculateDynamicRateLimit(target, resourceCheck)
        });
    }

    /**
     * Process file with integrated resource management
     * @param {string} filePath - Path to file
     * @param {Function} processorFn - Processing function
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processFileWithResourceManagement(filePath, processorFn, options = {}) {
        // Check if we're in emergency mode
        if (this.state.emergencyMode) {
            throw new Error('System in emergency mode due to resource constraints');
        }

        // Analyze file and check resources
        const fileAnalysis = await this.resourceMonitor.analyzeFileForProcessing(filePath);
        const resourceCheck = await this.checkResourceAvailability();

        if (!resourceCheck.available) {
            throw new Error(`Cannot process file due to resource constraints: ${resourceCheck.reason}`);
        }

        // Check if file processing would exceed memory limits
        const estimatedMemoryUsage = fileAnalysis.estimatedMemoryUsage;
        const currentMemoryUsage = this.resourceMonitor.state.memoryStats.heapUsed;
        const availableMemory = this.resourceMonitor.state.memoryStats.heapTotal - currentMemoryUsage;

        if (estimatedMemoryUsage > availableMemory * 0.8) {
            console.warn(`⚠️ File processing may exceed memory limits. Forcing streaming mode.`);
            options.forceStreaming = true;
        }

        // Process file with monitoring
        return await this.resourceMonitor.processFileStream(filePath, processorFn, options);
    }

    /**
     * Check resource availability
     * @returns {Promise<Object>} Resource availability status
     */
    async checkResourceAvailability() {
        const memoryStats = this.resourceMonitor.state.memoryStats;

        // Ensure memory stats are initialized
        if (!memoryStats.heapTotal || memoryStats.heapTotal === 0) {
            this.resourceMonitor.updateMemoryStats();
            // Update the reference after calling updateMemoryStats
            const updatedStats = this.resourceMonitor.state.memoryStats;
            if (updatedStats.heapTotal > 0) {
                memoryStats.heapUsed = updatedStats.heapUsed;
                memoryStats.heapTotal = updatedStats.heapTotal;
            }
        }

        const memoryUsageRatio = memoryStats.heapUsed / memoryStats.heapTotal;

        const checks = {
            memory: {
                available: memoryUsageRatio < this.config.emergencyShutdownThreshold,
                usage: memoryUsageRatio,
                threshold: this.config.emergencyShutdownThreshold
            },
            activeStreams: {
                available: this.resourceMonitor.state.activeStreams.size < this.resourceMonitor.config.maxConcurrentStreams,
                current: this.resourceMonitor.state.activeStreams.size,
                max: this.resourceMonitor.config.maxConcurrentStreams
            },
            emergencyMode: {
                active: this.state.emergencyMode,
                lastEmergency: this.state.lastEmergencyTime
            }
        };

        const available = checks.memory.available &&
            checks.activeStreams.available &&
            !checks.emergencyMode.active;

        let reason = '';
        if (!checks.memory.available) {
            reason = `Memory usage too high: ${Math.round(memoryUsageRatio * 100)}%`;
        } else if (!checks.activeStreams.available) {
            reason = `Too many active streams: ${checks.activeStreams.current}/${checks.activeStreams.max}`;
        } else if (checks.emergencyMode.active) {
            reason = 'System in emergency mode';
        }

        return {
            available,
            reason,
            checks
        };
    }

    /**
     * Calculate dynamic rate limit based on resource availability
     * @param {string} target - Target identifier
     * @param {Object} resourceCheck - Resource availability check
     * @returns {Object} Dynamic rate limit configuration
     */
    calculateDynamicRateLimit(target, resourceCheck) {
        const baseConfig = this.rateLimiter.config;
        const memoryUsage = resourceCheck.checks.memory.usage;

        // Reduce rate limit based on memory pressure
        let adjustmentFactor = 1.0;

        if (memoryUsage > 0.8) {
            adjustmentFactor = 0.5; // Reduce to 50% when memory > 80%
        } else if (memoryUsage > 0.7) {
            adjustmentFactor = 0.7; // Reduce to 70% when memory > 70%
        } else if (memoryUsage > 0.6) {
            adjustmentFactor = 0.85; // Reduce to 85% when memory > 60%
        }

        return {
            requestsPerSecond: Math.max(1, Math.floor(baseConfig.requestsPerSecond * adjustmentFactor)),
            burstLimit: Math.max(1, Math.floor(baseConfig.burstLimit * adjustmentFactor)),
            enableAdaptiveRateLimit: true,
            targetErrorRate: baseConfig.targetErrorRate,
            adaptiveAdjustmentFactor: baseConfig.adaptiveAdjustmentFactor
        };
    }

    /**
     * Handle resource alerts from monitoring service
     * @param {Object} alert - Resource alert
     */
    async handleResourceAlert(alert) {
        console.warn(`🚨 Resource Alert: ${alert.type} - ${alert.data.message}`);

        switch (alert.type) {
            case 'MEMORY_CRITICAL':
                await this.handleCriticalMemoryAlert(alert);
                break;
            case 'MEMORY_WARNING':
                await this.handleMemoryWarningAlert(alert);
                break;
            default:
                console.warn(`Unknown alert type: ${alert.type}`);
        }

        this.emit('resourceAlert', alert);
    }

    /**
     * Handle critical memory alert
     * @param {Object} alert - Memory alert
     */
    async handleCriticalMemoryAlert(alert) {
        const { usageRatio } = alert.data;

        if (usageRatio >= this.config.emergencyShutdownThreshold) {
            console.error('🚨 EMERGENCY: Memory usage critical, activating emergency mode');

            this.state.emergencyMode = true;
            this.state.lastEmergencyTime = Date.now();

            // Force garbage collection
            if (global.gc) {
                console.log('🗑️ Forcing garbage collection due to critical memory usage');
                this.resourceMonitor.forceGarbageCollection();
            }

            // Clean up temp directories immediately
            await this.resourceMonitor.cleanupTempDirectories();

            // Emit emergency event
            this.emit('emergencyMode', { reason: 'critical_memory', usageRatio });

            // Schedule recovery check
            setTimeout(() => {
                this.checkEmergencyRecovery();
            }, this.config.resourceRecoveryDelay);
        }
    }

    /**
     * Handle memory warning alert
     * @param {Object} alert - Memory alert
     */
    async handleMemoryWarningAlert(alert) {
        if (!this.state.resourceProtectionActive) {
            console.log('⚠️ Activating resource protection due to high memory usage');

            this.state.resourceProtectionActive = true;

            // Force garbage collection
            if (global.gc) {
                this.resourceMonitor.forceGarbageCollection();
            }

            this.emit('resourceProtectionActivated', alert);
        }
    }

    /**
     * Handle memory stats update
     * @param {Object} stats - Memory statistics
     */
    handleMemoryStatsUpdate(stats) {
        const memoryUsageRatio = stats.heapUsed / stats.heapTotal;

        // Deactivate resource protection if memory usage is back to normal
        if (this.state.resourceProtectionActive && memoryUsageRatio < 0.6) {
            console.log('✅ Deactivating resource protection - memory usage normalized');
            this.state.resourceProtectionActive = false;
            this.emit('resourceProtectionDeactivated', stats);
        }
    }

    /**
     * Check if system can recover from emergency mode
     */
    async checkEmergencyRecovery() {
        if (!this.state.emergencyMode) {
            return;
        }

        const resourceCheck = await this.checkResourceAvailability();
        const memoryUsageRatio = resourceCheck.checks.memory.usage;

        if (memoryUsageRatio < 0.7) { // Recovery threshold
            console.log('✅ Recovering from emergency mode - memory usage normalized');

            this.state.emergencyMode = false;
            this.emit('emergencyRecovery', { memoryUsageRatio });
        } else {
            // Schedule another recovery check
            setTimeout(() => {
                this.checkEmergencyRecovery();
            }, this.config.resourceRecoveryDelay);
        }
    }

    /**
     * Get comprehensive resource statistics
     * @returns {Object} Combined resource statistics
     */
    getResourceStatistics() {
        return {
            rateLimiting: this.rateLimiter.getGlobalStats(),
            resourceMonitoring: this.resourceMonitor.getResourceStats(),
            manager: {
                isActive: this.state.isActive,
                emergencyMode: this.state.emergencyMode,
                resourceProtectionActive: this.state.resourceProtectionActive,
                autoScalingActive: this.state.autoScalingActive,
                lastEmergencyTime: this.state.lastEmergencyTime
            },
            config: this.config
        };
    }

    /**
     * Get rate limiting statistics for a target
     * @param {string} target - Target identifier
     * @returns {Object|null} Target statistics
     */
    getTargetStatistics(target) {
        return this.rateLimiter.getTargetStats(target);
    }

    /**
     * Reset rate limiter for a target
     * @param {string} target - Target identifier
     */
    resetTargetRateLimit(target) {
        this.rateLimiter.resetLimiter(target);
    }

    /**
     * Force garbage collection
     * @returns {Object} GC results
     */
    forceGarbageCollection() {
        return this.resourceMonitor.forceGarbageCollection();
    }

    /**
     * Register temporary directory for cleanup
     * @param {string} dirPath - Directory path
     * @param {Object} metadata - Directory metadata
     */
    registerTempDirectory(dirPath, metadata = {}) {
        this.resourceMonitor.registerTempDirectory(dirPath, metadata);
    }

    /**
     * Clean up temporary directories
     */
    async cleanupTempDirectories() {
        await this.resourceMonitor.cleanupTempDirectories();
    }
}

module.exports = { ResourceManager };