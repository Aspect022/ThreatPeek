/**
 * Scan Orchestrator - Coordinates multiple scan types and manages scan lifecycle
 * Handles progress tracking, error recovery, and result consolidation
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const { ResourceManager } = require('./resourceManager');
const { AIAnalysisService } = require('./aiAnalysisService');
const { SpecializedGuidanceService } = require('./specializedGuidanceService');
const { FindingConsolidationService } = require('./findingConsolidationService');

class ScanOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        this.activeScanners = new Map();
        this.scanResults = new Map();
        this.scanProgress = new Map();
        this.scanErrors = new Map();
        this.maxConcurrentScans = 5;
        this.scanTimeout = 300000; // 5 minutes

        // Initialize resource manager
        this.resourceManager = new ResourceManager(options.resourceManager || {});

        // Initialize AI analysis service
        this.aiAnalysisService = new AIAnalysisService(options.aiAnalysis || {});

        // Initialize specialized guidance service
        this.specializedGuidanceService = new SpecializedGuidanceService(options.specializedGuidance || {});

        // Initialize finding consolidation service
        this.findingConsolidationService = new FindingConsolidationService(options.findingConsolidation || {});

        // Start resource management
        this.resourceManager.start().catch(error => {
            console.error('Failed to start resource manager:', error);
        });
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
            // Update status to running
            scanState.status = 'running';
            this.emit('scanStatusChanged', { scanId, status: 'running' });

            // Execute scan phases
            await this.executeScanPhases(scanId, scanState);

            // Clear timeout
            clearTimeout(timeoutId);

            // Finalize scan
            await this.finalizeScan(scanId);

        } catch (error) {
            clearTimeout(timeoutId);
            await this.handleScanError(scanId, error);
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
                const scannerOptions = {
                    ...options,
                    onProgress: (progress) => {
                        phase.progress = progress;
                        this.emit('scanProgress', { scanId, phase: scanType, progress });
                    }
                };

                const results = await scanner.scan(target, scannerOptions);

                // Process and store results
                this.processPhaseResults(scanId, scanType, results);

                // Update phase completion
                phase.status = 'completed';
                phase.endTime = new Date();
                scanState.progress.current++;

                this.emit('scanPhaseCompleted', { scanId, phase: scanType, results });

            } catch (error) {
                // Handle phase error with recovery
                await this.handlePhaseError(scanId, scanType, error, phase);
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

        // Create result category
        const category = {
            category: this.mapScanTypeToCategory(scanType),
            scanType,
            findings: results || [],
            summary: this.calculateCategorySummary(results || [])
        };

        scanState.results.categories.push(category);

        // Update overall summary
        this.updateScanSummary(scanState, results || []);

        // Store results
        if (!this.scanResults.has(scanId)) {
            this.scanResults.set(scanId, []);
        }
        this.scanResults.get(scanId).push(...(results || []));
    }

    /**
     * Handle error in a scan phase with recovery logic
     * @param {string} scanId - Scan identifier
     * @param {string} scanType - Type of scan that failed
     * @param {Error} error - Error that occurred
     * @param {Object} phase - Phase object
     */
    async handlePhaseError(scanId, scanType, error, phase) {
        const scanState = this.scanProgress.get(scanId);
        const scanErrors = this.scanErrors.get(scanId) || [];

        const errorInfo = {
            phase: scanType,
            error: error.message,
            timestamp: new Date(),
            recoverable: this.isRecoverableError(error),
            retryCount: phase.retryCount || 0
        };

        // Don't add to scanErrors yet - only add if recovery fails
        phase.errors.push(errorInfo);

        // Attempt recovery if error is recoverable and within retry limits
        if (errorInfo.recoverable && errorInfo.retryCount < 3) {
            console.log(`Attempting recovery for scan ${scanId}, phase ${scanType}, attempt ${errorInfo.retryCount + 1}`);

            phase.retryCount = (phase.retryCount || 0) + 1;

            // Wait before retry (exponential backoff)
            const delay = Math.pow(2, phase.retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                // Retry the scan phase
                const scanner = this.getScannerForType(scanType);
                const results = await scanner.scan(scanState.target, scanState.options);

                // Process successful retry results
                this.processPhaseResults(scanId, scanType, results);
                phase.status = 'completed';
                phase.endTime = new Date();
                scanState.progress.current++;

                this.emit('scanPhaseRecovered', { scanId, phase: scanType, results });
                return;
            } catch (retryError) {
                errorInfo.error = retryError.message;
            }
        }

        // Mark phase as failed and add error to scanErrors
        phase.status = 'failed';
        phase.endTime = new Date();
        scanState.progress.current++; // Still increment to continue with other phases

        // Add error to scanErrors since recovery failed
        scanErrors.push(errorInfo);

        this.emit('scanPhaseError', { scanId, phase: scanType, error: errorInfo });

        // Continue with partial results unless it's a critical error
        if (!this.isCriticalError(error)) {
            console.log(`Continuing scan ${scanId} with partial results after ${scanType} failure`);
        } else {
            throw error;
        }
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

        // Apply AI analysis to findings if enabled
        if (hasResults && this.aiAnalysisService.enabled) {
            try {
                await this.applyAIAnalysis(scanId, scanState);
            } catch (error) {
                console.error(`AI analysis failed for scan ${scanId}:`, error.message);
                // Continue without AI analysis
            }
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
     * Get scanner instance for scan type
     * @param {string} scanType - Type of scan
     * @returns {Object} Scanner instance
     */
    getScannerForType(scanType) {
        // This will be implemented with actual scanner modules
        // For now, return mock scanners
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
     * Check if error is recoverable
     * @param {Error} error - Error to check
     * @returns {boolean} True if recoverable
     */
    isRecoverableError(error) {
        const recoverableErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'timeout'
        ];

        return recoverableErrors.some(type =>
            error.code === type || error.message.toLowerCase().includes(type)
        );
    }

    /**
     * Check if error is critical (should stop scan)
     * @param {Error} error - Error to check
     * @returns {boolean} True if critical
     */
    isCriticalError(error) {
        const criticalErrors = [
            'INVALID_URL',
            'INVALID_REPOSITORY',
            'AUTHENTICATION_FAILED',
            'PERMISSION_DENIED'
        ];

        return criticalErrors.some(type =>
            error.code === type || error.message.includes(type)
        );
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
        return this.scanProgress.get(scanId) || null;
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
        });

        return toDelete.length;
    }

    /**
     * Get resource statistics
     * @returns {Object} Resource statistics
     */
    getResourceStatistics() {
        return this.resourceManager.getResourceStatistics();
    }

    /**
     * Apply AI analysis to scan findings
     * @param {string} scanId - Scan identifier
     * @param {Object} scanState - Current scan state
     */
    async applyAIAnalysis(scanId, scanState) {
        // Collect all findings from all categories
        const allFindings = [];
        scanState.results.categories.forEach(category => {
            category.findings.forEach(finding => {
                allFindings.push({
                    ...finding,
                    category: category.category,
                    scanType: category.scanType
                });
            });
        });

        if (allFindings.length === 0) return;

        // Prepare context for AI analysis
        const context = {
            target: scanState.target,
            scanTypes: scanState.scanTypes,
            scanId: scanId
        };

        // Get AI analysis
        const aiResult = await this.aiAnalysisService.analyzeFindings(allFindings, context);

        // Get specialized guidance
        const specializedGuidance = this.specializedGuidanceService.generateGuidance(allFindings, context);

        // Get finding consolidation
        const consolidation = this.findingConsolidationService.consolidateFindings(allFindings, context);

        // Update findings with AI analysis
        const enhancedFindingsMap = new Map();
        aiResult.findings.forEach(finding => {
            enhancedFindingsMap.set(finding.id, finding);
        });

        // Apply enhanced findings back to categories
        scanState.results.categories.forEach(category => {
            category.findings = category.findings.map(finding => {
                const enhanced = enhancedFindingsMap.get(finding.id);
                return enhanced || finding;
            });
        });

        // Add overall AI analysis to results
        scanState.results.aiAnalysis = aiResult.analysis;
        scanState.results.aiMetadata = aiResult.metadata;

        // Add specialized guidance to results
        scanState.results.specializedGuidance = specializedGuidance;

        // Add finding consolidation to results
        scanState.results.consolidation = consolidation;

        // Update summary with risk scores if available
        if (aiResult.analysis && aiResult.analysis.summary) {
            scanState.results.summary = {
                ...scanState.results.summary,
                overallRiskScore: aiResult.analysis.summary.overallRiskScore,
                riskLevel: aiResult.analysis.summary.riskLevel
            };
        }

        this.emit('aiAnalysisCompleted', { scanId, aiAnalysis: aiResult.analysis });
    }

    /**
     * Shutdown the scan orchestrator
     */
    async shutdown() {
        console.log('🛑 Shutting down Scan Orchestrator...');

        // Cancel all active scans
        for (const scanId of this.scanProgress.keys()) {
            this.cancelScan(scanId);
        }

        // Stop resource manager
        await this.resourceManager.stop();

        // Clear AI analysis cache
        if (this.aiAnalysisService) {
            this.aiAnalysisService.clearCache();
        }

        console.log('✅ Scan Orchestrator shutdown complete');
    }
}

module.exports = { ScanOrchestrator };