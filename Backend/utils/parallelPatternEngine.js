/**
 * Parallel Pattern Engine - Extends EnhancedPatternEngine with parallel processing capabilities
 * Provides concurrent pattern matching for large content and multiple files
 */

const { EnhancedPatternEngine } = require('./enhancedPatternEngine');
const { WorkerPool } = require('./workerPool');
const path = require('path');

class ParallelPatternEngine extends EnhancedPatternEngine {
    constructor(options = {}) {
        super();

        this.workerPool = new WorkerPool({
            maxWorkers: options.maxWorkers || Math.min(require('os').cpus().length, 4),
            workerScript: path.join(__dirname, 'scanWorker.js')
        });

        this.parallelThreshold = options.parallelThreshold || 50000; // 50KB
        this.chunkSize = options.chunkSize || 100000; // 100KB chunks
        this.chunkOverlap = options.chunkOverlap || 1000; // 1KB overlap
    }

    /**
     * Scan content with automatic parallel processing for large content
     * @param {string} content - Content to scan
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Pattern matches
     */
    async scanContentParallel(content, options = {}) {
        // Use sequential processing for small content
        if (content.length < this.parallelThreshold) {
            return super.scanContent(content, options);
        }

        // Use parallel processing for large content
        return this.workerPool.scanContentParallel(content, {
            ...options,
            chunkSize: this.chunkSize,
            overlap: this.chunkOverlap
        });
    }

    /**
     * Scan multiple files in parallel
     * @param {Array} filePaths - Array of file paths to scan
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Array of scan results
     */
    async scanFilesParallel(filePaths, options = {}) {
        if (filePaths.length === 0) {
            return [];
        }

        // Use sequential processing for single file
        if (filePaths.length === 1) {
            const result = await this.scanSingleFile(filePaths[0], options);
            return [result];
        }

        // Use parallel processing for multiple files
        return this.workerPool.scanFilesParallel(filePaths, options);
    }

    /**
     * Scan a single file (helper method)
     * @param {string} filePath - Path to file
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan result
     */
    async scanSingleFile(filePath, options = {}) {
        const fs = require('fs-extra');

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const matches = await this.scanContentParallel(content, options);

            return {
                file: filePath,
                findings: matches,
                size: content.length,
                scanTime: Date.now()
            };
        } catch (error) {
            return {
                file: filePath,
                findings: [],
                error: error.message
            };
        }
    }

    /**
     * Validate patterns against test cases in parallel
     * @param {Array} patterns - Patterns to validate
     * @param {Array} testCases - Test cases to run
     * @param {Object} options - Validation options
     * @returns {Promise<Object>} Validation results
     */
    async validatePatternsParallel(patterns, testCases, options = {}) {
        const batchSize = options.batchSize || 10;
        const batches = [];

        // Group patterns into batches
        for (let i = 0; i < patterns.length; i += batchSize) {
            batches.push(patterns.slice(i, i + batchSize));
        }

        const allResults = [];

        for (const batch of batches) {
            try {
                const batchResult = await this.workerPool.executeTask('validatePatterns', {
                    patterns: batch,
                    testCases: testCases.filter(tc =>
                        batch.some(p => p.id === tc.patternId)
                    )
                }, options);

                allResults.push(batchResult);
            } catch (error) {
                console.error(`Pattern validation batch error: ${error.message}`);
                allResults.push({
                    totalPatterns: batch.length,
                    totalTests: 0,
                    passed: 0,
                    failed: batch.length,
                    details: batch.map(p => ({
                        patternId: p.id,
                        status: 'error',
                        error: error.message
                    }))
                });
            }
        }

        // Merge results
        const mergedResult = {
            totalPatterns: patterns.length,
            totalTests: 0,
            passed: 0,
            failed: 0,
            details: []
        };

        allResults.forEach(result => {
            mergedResult.totalTests += result.totalTests;
            mergedResult.passed += result.passed;
            mergedResult.failed += result.failed;
            mergedResult.details.push(...result.details);
        });

        return mergedResult;
    }

    /**
     * Analyze entropy of multiple strings in parallel
     * @param {Array} strings - Strings to analyze
     * @param {Object} options - Analysis options
     * @returns {Promise<Array>} Entropy analysis results
     */
    async analyzeEntropyParallel(strings, options = {}) {
        const batchSize = options.batchSize || 100;
        const batches = [];

        // Group strings into batches
        for (let i = 0; i < strings.length; i += batchSize) {
            batches.push(strings.slice(i, i + batchSize));
        }

        const allResults = [];

        for (const batch of batches) {
            try {
                const batchResult = await this.workerPool.executeTask('analyzeEntropy', {
                    strings: batch
                }, options);

                allResults.push(...batchResult);
            } catch (error) {
                console.error(`Entropy analysis batch error: ${error.message}`);
                // Add error results for this batch
                batch.forEach(str => {
                    allResults.push({
                        value: str,
                        entropy: 0,
                        error: error.message
                    });
                });
            }
        }

        return allResults;
    }

    /**
     * Benchmark pattern matching performance
     * @param {Array} testContents - Array of content strings to test
     * @param {Object} options - Benchmark options
     * @returns {Promise<Object>} Benchmark results
     */
    async benchmarkPerformance(testContents, options = {}) {
        const results = {
            sequential: {
                totalTime: 0,
                averageTime: 0,
                matchesFound: 0
            },
            parallel: {
                totalTime: 0,
                averageTime: 0,
                matchesFound: 0
            },
            speedup: 0,
            efficiency: 0
        };

        // Benchmark sequential processing
        console.log('🔄 Benchmarking sequential processing...');
        const sequentialStart = Date.now();

        for (const content of testContents) {
            const matches = super.scanContent(content, options);
            results.sequential.matchesFound += matches.length;
        }

        results.sequential.totalTime = Date.now() - sequentialStart;
        results.sequential.averageTime = results.sequential.totalTime / testContents.length;

        // Benchmark parallel processing
        console.log('🔄 Benchmarking parallel processing...');
        const parallelStart = Date.now();

        const parallelPromises = testContents.map(content =>
            this.scanContentParallel(content, options)
        );

        const parallelResults = await Promise.all(parallelPromises);
        results.parallel.matchesFound = parallelResults.reduce((sum, matches) => sum + matches.length, 0);

        results.parallel.totalTime = Date.now() - parallelStart;
        results.parallel.averageTime = results.parallel.totalTime / testContents.length;

        // Calculate performance metrics
        results.speedup = results.sequential.totalTime / results.parallel.totalTime;
        results.efficiency = results.speedup / this.workerPool.maxWorkers;

        return results;
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    getPerformanceStats() {
        return {
            engine: super.getStats(),
            workerPool: this.workerPool.getStats(),
            configuration: {
                parallelThreshold: this.parallelThreshold,
                chunkSize: this.chunkSize,
                chunkOverlap: this.chunkOverlap
            }
        };
    }

    /**
     * Shutdown the parallel pattern engine
     * @param {number} timeout - Timeout for graceful shutdown
     * @returns {Promise<void>}
     */
    async shutdown(timeout = 5000) {
        if (this.workerPool) {
            await this.workerPool.shutdown(timeout);
        }
    }
}

module.exports = { ParallelPatternEngine };