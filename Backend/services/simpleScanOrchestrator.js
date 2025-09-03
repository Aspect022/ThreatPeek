/**
 * Simple Scan Orchestrator - Basic version without resource management
 * For development and testing purposes
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const { DeduplicationEngine } = require('../utils/deduplicationEngine');

class SimpleScanOrchestrator extends EventEmitter {
    constructor() {
        super();
        this.scanResults = new Map();
        this.scanProgress = new Map();
        this.scanErrors = new Map();
        this.scanTimeout = 600000; // 10 minutes

        // Deduplication engines per scan
        this.deduplicationEngines = new Map();
    }

    /**
     * Start a new scan with multiple scan types
     * @param {Object} scanRequest - Scan configuration
     * @returns {Promise<string>} Scan ID
     */
    async startScan(scanRequest) {
        const scanId = uuidv4();
        const {
            url,
            repositoryUrl,
            scanTypes = ['url'],
            options = {}
        } = scanRequest;

        // Validate scan request
        this.validateScanRequest(scanRequest);

        // Initialize scan state
        const scanState = {
            scanId,
            target: {
                type: repositoryUrl ? 'repository' : 'url',
                value: repositoryUrl || url
            },
            scanTypes,
            options,
            status: 'initializing',
            startTime: new Date(),
            progress: {
                current: 0,
                total: scanTypes.length,
                phases: scanTypes.map(type => ({
                    type,
                    status: 'pending',
                    progress: 0,
                    startTime: null,
                    endTime: null,
                    errors: []
                }))
            },
            results: {
                categories: [],
                summary: {
                    totalFindings: 0,
                    criticalCount: 0,
                    highCount: 0,
                    mediumCount: 0,
                    lowCount: 0
                }
            },
            errors: []
        };

        this.scanProgress.set(scanId, scanState);
        this.scanErrors.set(scanId, []);

        // Set scan timeout
        const timeoutId = setTimeout(() => {
            this.handleScanTimeout(scanId);
        }, this.scanTimeout);

        // Start scan execution asynchronously
        this.executeScanAsync(scanId, scanState, timeoutId);

        return scanId;
    }

    /**
     * Execute scan asynchronously
     * @param {string} scanId - Scan identifier
     * @param {Object} scanState - Current scan state
     * @param {number} timeoutId - Timeout ID to clear
     */
    async executeScanAsync(scanId, scanState, timeoutId) {
        try {
            // Initialize deduplication engine for this scan
            const deduplicationEngine = new DeduplicationEngine({
                enableFileLevel: true,
                enableScanLevel: true,
                preserveContext: true,
                maxCacheSize: 10000
            });
            this.deduplicationEngines.set(scanId, deduplicationEngine);

            // Update status to running
            scanState.status = 'running';
            this.emit('scanStatusChanged', { scanId, status: 'running' });

            // Execute scan phases
            await this.executeScanPhases(scanId, scanState);

            // Clear timeout
            clearTimeout(timeoutId);

            // Finalize scan with deduplication
            await this.finalizeScan(scanId);

        } catch (error) {
            clearTimeout(timeoutId);
            await this.handleScanError(scanId, error);
        } finally {
            // Clean up deduplication engine
            this.deduplicationEngines.delete(scanId);
        }
    }

    /**
     * Execute all scan phases for a scan
     * @param {string} scanId - Scan identifier
     * @param {Object} scanState - Current scan state
     */
    async executeScanPhases(scanId, scanState) {
        const { scanTypes, target, options } = scanState;

        for (let i = 0; i < scanTypes.length; i++) {
            const scanType = scanTypes[i];
            const phase = scanState.progress.phases[i];

            try {
                // Update phase status
                phase.status = 'running';
                phase.startTime = new Date();
                this.emit('scanPhaseStarted', { scanId, phase: scanType });

                // Execute scan type
                const scanner = this.getScannerForType(scanType);
                const results = await scanner.scan(target, options);

                // Process and store results
                this.processPhaseResults(scanId, scanType, results);

                // Update phase completion
                phase.status = 'completed';
                phase.endTime = new Date();
                scanState.progress.current++;

                this.emit('scanPhaseCompleted', { scanId, phase: scanType, results });

            } catch (error) {
                // Handle phase error
                phase.status = 'failed';
                phase.endTime = new Date();
                phase.errors.push({
                    error: error.message,
                    timestamp: new Date()
                });

                const scanErrors = this.scanErrors.get(scanId) || [];
                scanErrors.push({
                    phase: scanType,
                    error: error.message,
                    timestamp: new Date()
                });

                scanState.progress.current++;
                this.emit('scanPhaseError', { scanId, phase: scanType, error: { error: error.message } });

                console.log(`Continuing scan ${scanId} with partial results after ${scanType} failure`);
            }
        }
    }

    /**
     * Process results from a scan phase
     * @param {string} scanId - Scan identifier
     * @param {string} scanType - Type of scan
     * @param {Array} results - Scan results
     */
    processPhaseResults(scanId, scanType, results) {
        const scanState = this.scanProgress.get(scanId);
        if (!scanState) return;

        // Apply phase-level deduplication
        const deduplicationEngine = this.deduplicationEngines.get(scanId);
        let deduplicatedResults = results || [];

        if (deduplicationEngine && results && results.length > 0) {
            try {
                // Deduplicate results within this phase
                deduplicatedResults = deduplicationEngine.deduplicateFileFindings(results, `phase-${scanType}`);

                console.log(`[ORCHESTRATOR] Phase ${scanType}: ${results.length} -> ${deduplicatedResults.length} findings after deduplication`);
            } catch (error) {
                console.warn(`[ORCHESTRATOR] Deduplication failed for phase ${scanType}:`, error.message);
                // Fall back to original results
                deduplicatedResults = results;
            }
        }

        // Create result category with deduplicated findings
        const category = {
            category: this.mapScanTypeToCategory(scanType),
            scanType,
            findings: deduplicatedResults,
            summary: this.calculateCategorySummary(deduplicatedResults),
            deduplicationStats: deduplicationEngine ? {
                originalCount: results ? results.length : 0,
                deduplicatedCount: deduplicatedResults.length,
                duplicatesRemoved: (results ? results.length : 0) - deduplicatedResults.length
            } : null
        };

        scanState.results.categories.push(category);

        // Update overall summary with deduplicated results
        this.updateScanSummary(scanState, deduplicatedResults);

        // Store deduplicated results
        if (!this.scanResults.has(scanId)) {
            this.scanResults.set(scanId, []);
        }
        this.scanResults.get(scanId).push(...deduplicatedResults);
    }

    /**
     * Get scanner instance for scan type
     * @param {string} scanType - Type of scan
     * @returns {Object} Scanner instance
     */
    getScannerForType(scanType) {
        const scanners = {
            url: require('./urlScanner'),
            repository: require('./repositoryScanner'),
            files: require('./fileDetectionScanner'),
            headers: require('./headerAnalyzer'),
            owasp: require('./owaspChecker')
        };

        const scanner = scanners[scanType];
        if (!scanner) {
            throw new Error(`Unknown scan type: ${scanType}`);
        }

        return scanner;
    }

    /**
     * Map scan type to result category
     * @param {string} scanType - Scan type
     * @returns {string} Category name
     */
    mapScanTypeToCategory(scanType) {
        const mapping = {
            url: 'secrets',
            repository: 'secrets',
            files: 'files',
            headers: 'headers',
            owasp: 'owasp'
        };

        return mapping[scanType] || 'misconfiguration';
    }

    /**
     * Calculate summary for a category of results
     * @param {Array} results - Results to summarize
     * @returns {Object} Summary object
     */
    calculateCategorySummary(results) {
        const summary = {
            totalFindings: results.length,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0
        };

        results.forEach(result => {
            const severity = result.severity || 'medium';
            switch (severity.toLowerCase()) {
                case 'critical':
                    summary.criticalCount++;
                    break;
                case 'high':
                    summary.highCount++;
                    break;
                case 'medium':
                    summary.mediumCount++;
                    break;
                case 'low':
                    summary.lowCount++;
                    break;
            }
        });

        return summary;
    }

    /**
     * Calculate final summary for deduplicated results
     * @param {Array} results - Final deduplicated results
     * @returns {Object} Summary object
     */
    calculateFinalSummary(results) {
        const summary = {
            totalFindings: results.length,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0
        };

        results.forEach(result => {
            // Use mostSevereSeverity if available (from deduplication), otherwise severity
            const severity = result.mostSevereSeverity || result.severity || 'medium';
            switch (severity.toLowerCase()) {
                case 'critical':
                    summary.criticalCount++;
                    break;
                case 'high':
                    summary.highCount++;
                    break;
                case 'medium':
                    summary.mediumCount++;
                    break;
                case 'low':
                    summary.lowCount++;
                    break;
            }
        });

        return summary;
    }

    /**
     * Update overall scan summary
     * @param {Object} scanState - Current scan state
     * @param {Array} results - New results to add
     */
    updateScanSummary(scanState, results) {
        const summary = scanState.results.summary;

        results.forEach(result => {
            summary.totalFindings++;
            const severity = result.severity || 'medium';
            switch (severity.toLowerCase()) {
                case 'critical':
                    summary.criticalCount++;
                    break;
                case 'high':
                    summary.highCount++;
                    break;
                case 'medium':
                    summary.mediumCount++;
                    break;
                case 'low':
                    summary.lowCount++;
                    break;
            }
        });
    }

    /**
     * Finalize scan and update final status
     * @param {string} scanId - Scan identifier
     */
    async finalizeScan(scanId) {
        const scanState = this.scanProgress.get(scanId);
        if (!scanState) return;

        const errors = this.scanErrors.get(scanId) || [];
        const hasErrors = errors.length > 0;
        const hasResults = scanState.results.categories.length > 0;

        // Check if there are actually any findings
        const totalFindings = scanState.results.categories.reduce((total, category) => {
            return total + (category.findings ? category.findings.length : 0);
        }, 0);
        const hasFindings = totalFindings > 0;

        // Apply final scan-level deduplication
        const deduplicationEngine = this.deduplicationEngines.get(scanId);
        if (deduplicationEngine && hasFindings) {
            try {
                // Get all findings from all categories
                const allFindings = [];
                scanState.results.categories.forEach(category => {
                    if (category.findings) {
                        allFindings.push(...category.findings);
                    }
                });

                // Apply final deduplication across all scan phases
                const finalDeduplicatedFindings = deduplicationEngine.deduplicateScanFindings(allFindings);

                console.log(`[ORCHESTRATOR] Final deduplication: ${allFindings.length} -> ${finalDeduplicatedFindings.length} findings`);

                // Update scan results with final deduplicated findings
                this.scanResults.set(scanId, finalDeduplicatedFindings);

                // Recalculate summary with final deduplicated results
                scanState.results.summary = this.calculateFinalSummary(finalDeduplicatedFindings);

                // Add deduplication statistics
                const deduplicationStats = deduplicationEngine.getStats();
                scanState.results.deduplicationStats = {
                    ...deduplicationStats,
                    finalFindingsCount: finalDeduplicatedFindings.length,
                    totalDuplicatesRemoved: allFindings.length - finalDeduplicatedFindings.length,
                    deduplicationEnabled: true
                };

                console.log(`[ORCHESTRATOR] Deduplication stats:`, scanState.results.deduplicationStats);

            } catch (error) {
                console.warn(`[ORCHESTRATOR] Final deduplication failed:`, error.message);
                // Add error info to results
                scanState.results.deduplicationStats = {
                    deduplicationEnabled: false,
                    error: error.message,
                    fallbackUsed: true
                };
            }
        } else {
            // No deduplication applied
            scanState.results.deduplicationStats = {
                deduplicationEnabled: hasFindings && deduplicationEngine,
                reason: !deduplicationEngine ? 'No deduplication engine' : 'No results to deduplicate'
            };
        }

        // Determine final status
        if (hasErrors && !hasResults) {
            scanState.status = 'failed';
        } else if (hasErrors && hasResults) {
            scanState.status = 'partial';
        } else {
            scanState.status = 'completed';
        }

        scanState.endTime = new Date();
        scanState.duration = scanState.endTime - scanState.startTime;

        // Add error summary to results
        if (hasErrors) {
            scanState.results.errors = errors;
        }

        this.emit('scanCompleted', { scanId, status: scanState.status, results: scanState.results });
    }

    /**
     * Handle scan timeout
     * @param {string} scanId - Scan identifier
     */
    async handleScanTimeout(scanId) {
        const scanState = this.scanProgress.get(scanId);
        if (!scanState || scanState.status === 'completed') return;

        scanState.status = 'timeout';
        scanState.endTime = new Date();

        const timeoutError = {
            phase: 'timeout',
            error: 'Scan exceeded maximum time limit',
            timestamp: new Date(),
            recoverable: false
        };

        const scanErrors = this.scanErrors.get(scanId) || [];
        scanErrors.push(timeoutError);

        this.emit('scanTimeout', { scanId });
        await this.finalizeScan(scanId);
    }

    /**
     * Handle general scan error
     * @param {string} scanId - Scan identifier
     * @param {Error} error - Error that occurred
     */
    async handleScanError(scanId, error) {
        const scanState = this.scanProgress.get(scanId);
        if (scanState) {
            scanState.status = 'failed';
            scanState.endTime = new Date();
        }

        const errorInfo = {
            phase: 'general',
            error: error.message,
            timestamp: new Date(),
            recoverable: false
        };

        const scanErrors = this.scanErrors.get(scanId) || [];
        scanErrors.push(errorInfo);

        this.emit('scanError', { scanId, error: errorInfo });
    }

    /**
     * Validate scan request
     * @param {Object} scanRequest - Request to validate
     */
    validateScanRequest(scanRequest) {
        const { url, repositoryUrl, scanTypes } = scanRequest;

        if (!url && !repositoryUrl) {
            throw new Error('Either url or repositoryUrl must be provided');
        }

        if (url && repositoryUrl) {
            throw new Error('Cannot specify both url and repositoryUrl');
        }

        if (url) {
            try {
                new URL(url);
            } catch (error) {
                throw new Error('Invalid URL format');
            }
        }

        if (scanTypes && !Array.isArray(scanTypes)) {
            throw new Error('scanTypes must be an array');
        }

        const validScanTypes = ['url', 'repository', 'files', 'headers', 'owasp'];
        if (scanTypes) {
            for (const type of scanTypes) {
                if (!validScanTypes.includes(type)) {
                    throw new Error(`Unknown scan type: ${type}`);
                }
            }
        }
    }

    /**
     * Get scan status and progress
     * @param {string} scanId - Scan identifier
     * @returns {Object|null} Scan status or null if not found
     */
    getScanStatus(scanId) {
        const scanState = this.scanProgress.get(scanId);
        if (!scanState) return null;

        // Add deduplication status to progress reporting
        const deduplicationEngine = this.deduplicationEngines.get(scanId);
        const deduplicationStatus = deduplicationEngine ? {
            enabled: true,
            stats: deduplicationEngine.getStats(),
            currentCacheSize: deduplicationEngine.fingerprintCache?.size || 0
        } : {
            enabled: false,
            reason: 'No deduplication engine initialized'
        };

        return {
            ...scanState,
            deduplicationStatus
        };
    }

    /**
     * Get scan results
     * @param {string} scanId - Scan identifier
     * @returns {Object|null} Scan results or null if not found
     */
    getScanResults(scanId) {
        const scanState = this.scanProgress.get(scanId);
        const results = this.scanResults.get(scanId);
        const errors = this.scanErrors.get(scanId);

        if (!scanState) return null;

        return {
            scanId,
            target: scanState.target,
            status: scanState.status,
            startTime: scanState.startTime,
            endTime: scanState.endTime,
            duration: scanState.duration,
            progress: scanState.progress,
            results: scanState.results,
            rawResults: results || [],
            errors: errors || []
        };
    }

    /**
     * Cancel an active scan
     * @param {string} scanId - Scan identifier
     * @returns {boolean} True if scan was cancelled
     */
    cancelScan(scanId) {
        const scanState = this.scanProgress.get(scanId);
        if (!scanState) {
            return false;
        }

        // Only allow cancellation of running, initializing, or pending scans
        const cancellableStates = ['running', 'initializing', 'pending'];
        if (!cancellableStates.includes(scanState.status)) {
            return false;
        }

        scanState.status = 'cancelled';
        scanState.endTime = new Date();

        this.emit('scanCancelled', { scanId });
        return true;
    }

    /**
     * Clean up old scan data
     * @param {number} maxAge - Maximum age in milliseconds
     */
    cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const now = new Date();
        const toDelete = [];

        for (const [scanId, scanState] of this.scanProgress.entries()) {
            const age = now - scanState.startTime;
            if (age > maxAge) {
                toDelete.push(scanId);
            }
        }

        toDelete.forEach(scanId => {
            this.scanProgress.delete(scanId);
            this.scanResults.delete(scanId);
            this.scanErrors.delete(scanId);
            // Clean up deduplication engines
            this.deduplicationEngines.delete(scanId);
        });

        return toDelete.length;
    }

    /**
     * Shutdown the scan orchestrator
     */
    async shutdown() {
        console.log('🛑 Shutting down Simple Scan Orchestrator...');

        // Cancel all active scans
        for (const scanId of this.scanProgress.keys()) {
            this.cancelScan(scanId);
        }

        // Clean up all deduplication engines
        this.deduplicationEngines.clear();

        console.log('✅ Simple Scan Orchestrator shutdown complete');
    }
}

module.exports = { SimpleScanOrchestrator };