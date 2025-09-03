/**
 * Resource Monitoring Service - Memory usage monitoring and streaming processing for large files
 * Provides resource cleanup and garbage collection optimization
 */

const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

class ResourceMonitoringService extends EventEmitter {
    constructor(options = {}) {
        super();

        // Configuration
        this.config = {
            // Memory thresholds
            memoryWarningThreshold: options.memoryWarningThreshold || 0.8, // 80% of available memory
            memoryCriticalThreshold: options.memoryCriticalThreshold || 0.9, // 90% of available memory
            maxHeapSize: options.maxHeapSize || 1024 * 1024 * 1024, // 1GB default

            // File processing thresholds
            largeFileThreshold: options.largeFileThreshold || 50 * 1024 * 1024, // 50MB
            streamingThreshold: options.streamingThreshold || 100 * 1024 * 1024, // 100MB
            chunkSize: options.chunkSize || 64 * 1024, // 64KB chunks

            // Monitoring intervals
            monitoringInterval: options.monitoringInterval || 5000, // 5 seconds
            gcInterval: options.gcInterval || 30000, // 30 seconds

            // Resource limits
            maxConcurrentStreams: options.maxConcurrentStreams || 5,
            maxTempDirSize: options.maxTempDirSize || 2 * 1024 * 1024 * 1024, // 2GB
            tempDirCleanupAge: options.tempDirCleanupAge || 2 * 60 * 60 * 1000, // 2 hours

            // Garbage collection settings
            enableForceGC: options.enableForceGC !== false,
            gcMemoryThreshold: options.gcMemoryThreshold || 0.7, // 70% memory usage
            gcFrequency: options.gcFrequency || 60000 // 1 minute
        };

        // State tracking
        this.state = {
            isMonitoring: false,
            activeStreams: new Set(),
            memoryStats: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0,
                arrayBuffers: 0
            },
            resourceStats: {
                totalFilesProcessed: 0,
                totalBytesProcessed: 0,
                streamingFilesCount: 0,
                averageProcessingTime: 0,
                peakMemoryUsage: 0,
                gcCount: 0,
                lastGCTime: null
            },
            alerts: [],
            tempDirectories: new Map()
        };

        // Interval references
        this.monitoringIntervalRef = null;
        this.gcIntervalRef = null;
        this.cleanupIntervalRef = null;

        // Bind methods
        this.processFileStream = this.processFileStream.bind(this);
        this.createStreamingProcessor = this.createStreamingProcessor.bind(this);

        // Initialize memory stats immediately
        this.updateMemoryStats();
    }

    /**
     * Start resource monitoring
     */
    startMonitoring() {
        if (this.state.isMonitoring) {
            return;
        }

        this.state.isMonitoring = true;

        // Start memory monitoring
        this.monitoringIntervalRef = setInterval(() => {
            this.updateMemoryStats();
            this.checkMemoryThresholds();
        }, this.config.monitoringInterval);

        // Start garbage collection monitoring
        if (this.config.enableForceGC && global.gc) {
            this.gcIntervalRef = setInterval(() => {
                this.performGarbageCollection();
            }, this.config.gcInterval);
        }

        // Start cleanup monitoring
        this.cleanupIntervalRef = setInterval(() => {
            this.cleanupTempDirectories();
        }, 60000); // Every minute

        console.log('🔍 Resource monitoring started');
        this.emit('monitoringStarted');
    }

    /**
     * Stop resource monitoring
     */
    stopMonitoring() {
        if (!this.state.isMonitoring) {
            return;
        }

        this.state.isMonitoring = false;

        if (this.monitoringIntervalRef) {
            clearInterval(this.monitoringIntervalRef);
            this.monitoringIntervalRef = null;
        }

        if (this.gcIntervalRef) {
            clearInterval(this.gcIntervalRef);
            this.gcIntervalRef = null;
        }

        if (this.cleanupIntervalRef) {
            clearInterval(this.cleanupIntervalRef);
            this.cleanupIntervalRef = null;
        }

        console.log('🔍 Resource monitoring stopped');
        this.emit('monitoringStopped');
    }

    /**
     * Update memory statistics
     */
    updateMemoryStats() {
        const memUsage = process.memoryUsage();

        this.state.memoryStats = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            arrayBuffers: memUsage.arrayBuffers || 0
        };

        // Track peak memory usage
        if (memUsage.heapUsed > this.state.resourceStats.peakMemoryUsage) {
            this.state.resourceStats.peakMemoryUsage = memUsage.heapUsed;
        }

        this.emit('memoryStatsUpdated', this.state.memoryStats);
    }

    /**
     * Check memory thresholds and emit alerts
     */
    checkMemoryThresholds() {
        const { heapUsed, heapTotal } = this.state.memoryStats;
        const memoryUsageRatio = heapUsed / heapTotal;

        if (memoryUsageRatio >= this.config.memoryCriticalThreshold) {
            this.emitAlert('MEMORY_CRITICAL', {
                message: `Critical memory usage: ${Math.round(memoryUsageRatio * 100)}%`,
                heapUsed,
                heapTotal,
                usageRatio: memoryUsageRatio
            });
        } else if (memoryUsageRatio >= this.config.memoryWarningThreshold) {
            this.emitAlert('MEMORY_WARNING', {
                message: `High memory usage: ${Math.round(memoryUsageRatio * 100)}%`,
                heapUsed,
                heapTotal,
                usageRatio: memoryUsageRatio
            });
        }
    }

    /**
     * Emit resource alert
     * @param {string} type - Alert type
     * @param {Object} data - Alert data
     */
    emitAlert(type, data) {
        const alert = {
            type,
            timestamp: new Date(),
            data
        };

        this.state.alerts.push(alert);

        // Keep only recent alerts (last 100)
        if (this.state.alerts.length > 100) {
            this.state.alerts = this.state.alerts.slice(-100);
        }

        console.warn(`🚨 Resource Alert [${type}]: ${data.message}`);
        this.emit('resourceAlert', alert);
    }

    /**
     * Perform garbage collection if conditions are met
     */
    performGarbageCollection() {
        if (!global.gc) {
            return;
        }

        const { heapUsed, heapTotal } = this.state.memoryStats;
        const memoryUsageRatio = heapUsed / heapTotal;

        if (memoryUsageRatio >= this.config.gcMemoryThreshold) {
            const beforeGC = process.memoryUsage();

            try {
                global.gc();

                const afterGC = process.memoryUsage();
                const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;

                this.state.resourceStats.gcCount++;
                this.state.resourceStats.lastGCTime = new Date();

                console.log(`🗑️ Garbage collection completed. Memory freed: ${Math.round(memoryFreed / 1024 / 1024)}MB`);

                this.emit('garbageCollectionCompleted', {
                    memoryFreed,
                    beforeGC,
                    afterGC,
                    gcCount: this.state.resourceStats.gcCount
                });

            } catch (error) {
                console.error('Garbage collection failed:', error);
            }
        }
    }

    /**
     * Check if file should be processed with streaming
     * @param {string} filePath - Path to file
     * @returns {Promise<Object>} File processing recommendation
     */
    async analyzeFileForProcessing(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const fileSize = stats.size;

            const recommendation = {
                filePath,
                fileSize,
                shouldStream: fileSize >= this.config.streamingThreshold,
                isLarge: fileSize >= this.config.largeFileThreshold,
                recommendedChunkSize: this.calculateOptimalChunkSize(fileSize),
                estimatedMemoryUsage: this.estimateMemoryUsage(fileSize),
                processingStrategy: this.determineProcessingStrategy(fileSize)
            };

            return recommendation;

        } catch (error) {
            throw new Error(`Failed to analyze file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Calculate optimal chunk size for file processing
     * @param {number} fileSize - Size of file in bytes
     * @returns {number} Optimal chunk size
     */
    calculateOptimalChunkSize(fileSize) {
        // Base chunk size
        let chunkSize = this.config.chunkSize;

        // Adjust based on available memory
        const { heapUsed, heapTotal } = this.state.memoryStats;
        const availableMemory = heapTotal - heapUsed;

        // Use up to 10% of available memory for chunk size
        const maxChunkSize = Math.floor(availableMemory * 0.1);

        // For very large files, use larger chunks
        if (fileSize > 500 * 1024 * 1024) { // > 500MB
            chunkSize = Math.min(maxChunkSize, 1024 * 1024); // Up to 1MB chunks
        } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
            chunkSize = Math.min(maxChunkSize, 512 * 1024); // Up to 512KB chunks
        }

        return Math.max(chunkSize, 16 * 1024); // Minimum 16KB
    }

    /**
     * Estimate memory usage for file processing
     * @param {number} fileSize - Size of file in bytes
     * @returns {number} Estimated memory usage in bytes
     */
    estimateMemoryUsage(fileSize) {
        // For streaming: chunk size + processing overhead
        if (fileSize >= this.config.streamingThreshold) {
            return this.calculateOptimalChunkSize(fileSize) * 3; // 3x for processing overhead
        }

        // For in-memory: file size + processing overhead
        return fileSize * 2.5; // 2.5x for string processing overhead
    }

    /**
     * Determine processing strategy for file
     * @param {number} fileSize - Size of file in bytes
     * @returns {string} Processing strategy
     */
    determineProcessingStrategy(fileSize) {
        if (fileSize >= this.config.streamingThreshold) {
            return 'streaming';
        } else if (fileSize >= this.config.largeFileThreshold) {
            return 'chunked';
        } else {
            return 'memory';
        }
    }

    /**
     * Process file with streaming for large files
     * @param {string} filePath - Path to file to process
     * @param {Function} processorFn - Function to process each chunk
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing results
     */
    async processFileStream(filePath, processorFn, options = {}) {
        const analysis = await this.analyzeFileForProcessing(filePath);
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Check if we can start a new stream
        if (this.state.activeStreams.size >= this.config.maxConcurrentStreams) {
            throw new Error(`Maximum concurrent streams (${this.config.maxConcurrentStreams}) reached`);
        }

        this.state.activeStreams.add(streamId);

        try {
            const startTime = Date.now();
            let totalBytesProcessed = 0;
            const results = [];

            console.log(`🌊 Starting streaming processing for ${filePath} (${Math.round(analysis.fileSize / 1024 / 1024)}MB)`);

            if (analysis.processingStrategy === 'streaming') {
                // Use streaming for very large files
                const readStream = fs.createReadStream(filePath, {
                    highWaterMark: analysis.recommendedChunkSize
                });

                const processor = this.createStreamingProcessor(processorFn, options);

                await pipeline(
                    readStream,
                    processor
                );

                results.push(...processor.getResults());
                totalBytesProcessed = analysis.fileSize;

            } else if (analysis.processingStrategy === 'chunked') {
                // Process in chunks for large files using fs.createReadStream
                const readStream = fs.createReadStream(filePath, {
                    highWaterMark: analysis.recommendedChunkSize
                });

                let position = 0;

                for await (const chunk of readStream) {
                    const chunkStr = chunk.toString('utf8');
                    const chunkResults = await processorFn(chunkStr, {
                        ...options,
                        chunkOffset: position,
                        isLastChunk: position + chunk.length >= analysis.fileSize
                    });

                    if (chunkResults) {
                        results.push(...(Array.isArray(chunkResults) ? chunkResults : [chunkResults]));
                    }

                    position += chunk.length;
                    totalBytesProcessed += chunk.length;

                    // Check memory usage periodically
                    if (position % (analysis.recommendedChunkSize * 10) === 0) {
                        this.updateMemoryStats();
                        if (this.state.memoryStats.heapUsed / this.state.memoryStats.heapTotal > 0.9) {
                            console.warn('⚠️ High memory usage during chunked processing, forcing GC');
                            if (global.gc) global.gc();
                        }
                    }
                }

            } else {
                // Process in memory for small files
                const content = await fs.readFile(filePath, 'utf8');
                const fileResults = await processorFn(content, options);

                if (fileResults) {
                    results.push(...(Array.isArray(fileResults) ? fileResults : [fileResults]));
                }

                totalBytesProcessed = analysis.fileSize;
            }

            const processingTime = Date.now() - startTime;

            // Update statistics
            this.state.resourceStats.totalFilesProcessed++;
            this.state.resourceStats.totalBytesProcessed += totalBytesProcessed;
            this.state.resourceStats.averageProcessingTime =
                (this.state.resourceStats.averageProcessingTime * (this.state.resourceStats.totalFilesProcessed - 1) + processingTime) /
                this.state.resourceStats.totalFilesProcessed;

            if (analysis.shouldStream) {
                this.state.resourceStats.streamingFilesCount++;
            }

            console.log(`✅ Completed processing ${filePath} in ${processingTime}ms (${results.length} results)`);

            this.emit('fileProcessed', {
                filePath,
                fileSize: analysis.fileSize,
                processingTime,
                strategy: analysis.processingStrategy,
                resultsCount: results.length,
                bytesProcessed: totalBytesProcessed
            });

            return {
                results,
                analysis,
                processingTime,
                bytesProcessed: totalBytesProcessed,
                strategy: analysis.processingStrategy
            };

        } finally {
            this.state.activeStreams.delete(streamId);
        }
    }

    /**
     * Create streaming processor transform
     * @param {Function} processorFn - Function to process each chunk
     * @param {Object} options - Processing options
     * @returns {Transform} Transform stream
     */
    createStreamingProcessor(processorFn, options = {}) {
        const results = [];
        let buffer = '';
        const overlap = options.overlap || 1000; // 1KB overlap for pattern matching

        const processor = new Transform({
            objectMode: false,
            transform(chunk, encoding, callback) {
                try {
                    // Add chunk to buffer
                    buffer += chunk.toString('utf8');

                    // Process complete lines or chunks
                    const lines = buffer.split('\n');

                    // Keep the last incomplete line in buffer
                    buffer = lines.pop() || '';

                    // Process complete lines
                    for (const line of lines) {
                        if (line.trim()) {
                            const lineResults = processorFn(line, options);
                            if (lineResults) {
                                results.push(...(Array.isArray(lineResults) ? lineResults : [lineResults]));
                            }
                        }
                    }

                    // If buffer is getting too large, process it anyway
                    if (buffer.length > overlap * 2) {
                        const bufferResults = processorFn(buffer, options);
                        if (bufferResults) {
                            results.push(...(Array.isArray(bufferResults) ? bufferResults : [bufferResults]));
                        }
                        buffer = buffer.slice(-overlap); // Keep overlap for pattern matching
                    }

                    callback();
                } catch (error) {
                    callback(error);
                }
            },

            flush(callback) {
                try {
                    // Process remaining buffer
                    if (buffer.trim()) {
                        const finalResults = processorFn(buffer, options);
                        if (finalResults) {
                            results.push(...(Array.isArray(finalResults) ? finalResults : [finalResults]));
                        }
                    }
                    callback();
                } catch (error) {
                    callback(error);
                }
            }
        });

        processor.getResults = () => results;
        return processor;
    }

    /**
     * Register temporary directory for cleanup
     * @param {string} dirPath - Path to temporary directory
     * @param {Object} metadata - Directory metadata
     */
    registerTempDirectory(dirPath, metadata = {}) {
        this.state.tempDirectories.set(dirPath, {
            createdAt: Date.now(),
            ...metadata
        });
    }

    /**
     * Clean up temporary directories
     */
    async cleanupTempDirectories() {
        const now = Date.now();
        const toCleanup = [];

        for (const [dirPath, metadata] of this.state.tempDirectories.entries()) {
            const age = now - metadata.createdAt;

            if (age > this.config.tempDirCleanupAge) {
                toCleanup.push(dirPath);
            }
        }

        for (const dirPath of toCleanup) {
            try {
                if (await fs.pathExists(dirPath)) {
                    const stats = await fs.stat(dirPath);
                    await fs.remove(dirPath);

                    console.log(`🧹 Cleaned up temp directory: ${dirPath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
                    this.emit('tempDirectoryCleanedUp', { dirPath, size: stats.size });
                }

                this.state.tempDirectories.delete(dirPath);
            } catch (error) {
                console.warn(`Failed to cleanup temp directory ${dirPath}: ${error.message}`);
            }
        }
    }

    /**
     * Get current resource statistics
     * @returns {Object} Resource statistics
     */
    getResourceStats() {
        return {
            memoryStats: { ...this.state.memoryStats },
            resourceStats: { ...this.state.resourceStats },
            activeStreams: this.state.activeStreams.size,
            tempDirectories: this.state.tempDirectories.size,
            alerts: this.state.alerts.slice(-10), // Last 10 alerts
            config: { ...this.config }
        };
    }

    /**
     * Force garbage collection
     * @returns {Object} GC results
     */
    forceGarbageCollection() {
        if (!global.gc) {
            throw new Error('Garbage collection not available. Start Node.js with --expose-gc flag.');
        }

        const beforeGC = process.memoryUsage();
        global.gc();
        const afterGC = process.memoryUsage();

        const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;

        this.state.resourceStats.gcCount++;
        this.state.resourceStats.lastGCTime = new Date();

        const result = {
            memoryFreed,
            beforeGC,
            afterGC,
            gcCount: this.state.resourceStats.gcCount
        };

        this.emit('garbageCollectionCompleted', result);
        return result;
    }

    /**
     * Shutdown resource monitoring service
     */
    async shutdown() {
        this.stopMonitoring();

        // Clean up all temp directories
        await this.cleanupTempDirectories();

        // Clear state
        this.state.activeStreams.clear();
        this.state.tempDirectories.clear();
        this.state.alerts = [];

        this.emit('shutdown');
    }
}

module.exports = { ResourceMonitoringService };