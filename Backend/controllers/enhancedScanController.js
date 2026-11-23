/**
 * Enhanced Scan Controller - Multi-scan type coordination with orchestrator
 * Handles different scan types, progress tracking, and error recovery
 */

const { ScanOrchestrator } = require('../services/scanOrchestrator');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const { allPatterns } = require('../utils/enhancedPatternDefinitions');
const { ResultFormatter } = require('../services/resultFormatter');
const { OutputFormatters } = require('../services/outputFormatters');
const { ConfidenceScoring } = require('../services/confidenceScoring');

// Global orchestrator instance
const orchestrator = new ScanOrchestrator();

// Initialize pattern engine
const patternEngine = new EnhancedPatternEngine();
patternEngine.registerPatterns(allPatterns);

// Initialize result formatter and output formatters
const resultFormatter = new ResultFormatter();
const outputFormatters = new OutputFormatters();
const confidenceScoring = new ConfidenceScoring();

// Set up orchestrator event listeners for real-time updates
orchestrator.on('scanStatusChanged', (data) => {
    console.log(`[ORCHESTRATOR] Scan ${data.scanId} status changed to: ${data.status}`);
});

orchestrator.on('scanPhaseStarted', (data) => {
    console.log(`[ORCHESTRATOR] Scan ${data.scanId} started phase: ${data.phase}`);
});

orchestrator.on('scanPhaseCompleted', (data) => {
    console.log(`[ORCHESTRATOR] Scan ${data.scanId} completed phase: ${data.phase} with ${data.results?.length || 0} results`);
});

orchestrator.on('scanPhaseError', (data) => {
    console.log(`[ORCHESTRATOR] Scan ${data.scanId} error in phase ${data.phase}: ${data.error.error}`);
});

orchestrator.on('scanCompleted', (data) => {
    console.log(`[ORCHESTRATOR] Scan ${data.scanId} completed with status: ${data.status}`);
});

// Cleanup old scans every hour
setInterval(() => {
    const cleaned = orchestrator.cleanup();
    if (cleaned > 0) {
        console.log(`[CLEANUP] Removed ${cleaned} old scan records`);
    }
}, 60 * 60 * 1000);

/**
 * Start an enhanced scan with multiple scan types
 */
exports.startEnhancedScan = async (req, res) => {
    try {
        const {
            url,
            repositoryUrl,
            scanTypes = ['url'],
            options = {}
        } = req.body;

        // Validate request
        if (!url && !repositoryUrl) {
            return res.status(400).json({
                error: 'Either url or repositoryUrl must be provided'
            });
        }

        // Set default options
        const scanOptions = {
            maxDepth: options.maxDepth || 3,
            timeout: options.timeout || 30000,
            confidenceThreshold: options.confidenceThreshold || 0.5,
            includePatterns: options.includePatterns || [],
            excludePatterns: options.excludePatterns || [],
            rateLimit: {
                requestsPerSecond: options.rateLimit?.requestsPerSecond || 5,
                burstLimit: options.rateLimit?.burstLimit || 10,
                backoffStrategy: options.rateLimit?.backoffStrategy || 'exponential'
            },
            realTimeUpdates: options.realTimeUpdates || false,
            ...options
        };

        console.log(`🚀 Starting enhanced scan for: ${url || repositoryUrl}`);
        console.log(`📋 Scan types: ${scanTypes.join(', ')}`);

        // Start scan through orchestrator
        const scanId = await orchestrator.startScan({
            url,
            repositoryUrl,
            scanTypes,
            options: scanOptions
        });

        res.json({
            scanId,
            status: 'started',
            scanTypes,
            target: {
                type: repositoryUrl ? 'repository' : 'url',
                value: repositoryUrl || url
            },
            message: 'Enhanced scan started successfully'
        });

    } catch (error) {
        console.error('❌ Enhanced scan error:', error.message);
        res.status(500).json({
            error: `Failed to start enhanced scan: ${error.message}`
        });
    }
};

/**
 * Get scan status and progress
 */
exports.getScanStatus = async (req, res) => {
    try {
        const { scanId } = req.params;

        if (!scanId) {
            return res.status(400).json({
                error: 'Scan ID is required'
            });
        }

        const status = orchestrator.getScanStatus(scanId);

        if (!status) {
            return res.status(404).json({
                error: 'Scan not found'
            });
        }

        // Return status with progress information
        res.json({
            scanId,
            status: status.status,
            target: status.target,
            progress: {
                current: status.progress.current,
                total: status.progress.total,
                percentage: Math.round((status.progress.current / status.progress.total) * 100),
                phases: status.progress.phases.map(phase => ({
                    type: phase.type,
                    status: phase.status,
                    progress: phase.progress,
                    duration: phase.endTime && phase.startTime ?
                        phase.endTime - phase.startTime : null,
                    hasErrors: phase.errors.length > 0
                }))
            },
            startTime: status.startTime,
            endTime: status.endTime,
            duration: status.duration,
            summary: status.results.summary,
            // Include deduplication status if available
            deduplicationStatus: status.deduplicationStatus || null
        });

    } catch (error) {
        console.error('❌ Get scan status error:', error.message);
        res.status(500).json({
            error: `Failed to get scan status: ${error.message}`
        });
    }
};

/**
 * Get complete scan results with enhanced filtering and formatting
 */
exports.getScanResults = async (req, res) => {
    try {
        const { scanId } = req.params;
        const {
            format = 'json',
            category,
            severity,
            confidenceThreshold,
            includeContext = true,
            sortBy = 'severity',
            sortOrder = 'desc',
            limit,
            offset = 0,
            consolidated = false
        } = req.query;

        if (!scanId) {
            return res.status(400).json({
                error: 'Scan ID is required'
            });
        }

        const scanData = orchestrator.getScanResults(scanId);

        if (!scanData) {
            return res.status(404).json({
                error: 'Scan results not found'
            });
        }

        // Validate filter options
        const filterOptions = {
            category,
            severity,
            confidenceThreshold: confidenceThreshold ? parseFloat(confidenceThreshold) : undefined,
            includeContext: includeContext !== 'false' && includeContext !== false,
            sortBy,
            sortOrder,
            limit: limit ? parseInt(limit) : null,
            offset: parseInt(offset)
        };

        const validation = resultFormatter.validateFilterOptions(filterOptions);
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Invalid filter options',
                details: validation.errors
            });
        }

        // Apply enhanced filtering and formatting
        let formattedResults;
        if (consolidated === 'true' || consolidated === true) {
            formattedResults = resultFormatter.createConsolidatedReport(scanData, {
                groupBy: req.query.groupBy || 'category',
                includeRecommendations: req.query.includeRecommendations !== 'false'
            });
        } else {
            formattedResults = resultFormatter.formatResults(scanData, filterOptions);
        }

        // Handle different output formats
        const normalizedFormat = format.toLowerCase();
        if (normalizedFormat !== 'json') {
            const formatValidation = outputFormatters.validateFormat(normalizedFormat, req.query);
            if (!formatValidation.isValid) {
                return res.status(400).json({
                    error: 'Invalid format options',
                    details: formatValidation.errors
                });
            }

            const formattedOutput = outputFormatters.formatOutput(formattedResults, normalizedFormat, req.query);

            res.setHeader('Content-Type', formattedOutput.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${formattedOutput.filename}"`);

            if (formattedOutput.size) {
                res.setHeader('Content-Length', formattedOutput.size);
            }

            return res.send(formattedOutput.content);
        }

        // Return JSON response
        res.json(formattedResults);

    } catch (error) {
        console.error('❌ Get scan results error:', error.message);
        res.status(500).json({
            error: `Failed to get scan results: ${error.message}`
        });
    }
};

/**
 * Cancel an active scan
 */
exports.cancelScan = async (req, res) => {
    try {
        const { scanId } = req.params;

        if (!scanId) {
            return res.status(400).json({
                error: 'Scan ID is required'
            });
        }

        const cancelled = orchestrator.cancelScan(scanId);

        if (!cancelled) {
            return res.status(404).json({
                error: 'Scan not found or already completed'
            });
        }

        res.json({
            scanId,
            status: 'cancelled',
            message: 'Scan cancelled successfully'
        });

    } catch (error) {
        console.error('❌ Cancel scan error:', error.message);
        res.status(500).json({
            error: `Failed to cancel scan: ${error.message}`
        });
    }
};

/**
 * Record user feedback for false positive learning
 */
exports.recordFeedback = async (req, res) => {
    try {
        const { scanId } = req.params;
        const {
            findingId,
            isFalsePositive,
            patternId,
            value,
            metadata = {}
        } = req.body;

        if (!scanId || !findingId || isFalsePositive === undefined) {
            return res.status(400).json({
                error: 'scanId, findingId, and isFalsePositive are required'
            });
        }

        // Get the scan results to find the specific finding
        const scanData = orchestrator.getScanResults(scanId);
        if (!scanData) {
            return res.status(404).json({
                error: 'Scan not found'
            });
        }

        // Find the specific finding
        let targetFinding = null;
        let targetPattern = null;

        for (const category of scanData.results.categories) {
            const finding = category.findings.find(f => f.id === findingId);
            if (finding) {
                targetFinding = finding;
                // Try to reconstruct pattern info
                targetPattern = {
                    id: patternId || finding.type || 'unknown',
                    category: category.category
                };
                break;
            }
        }

        if (!targetFinding) {
            return res.status(404).json({
                error: 'Finding not found in scan results'
            });
        }

        // Record feedback in confidence scoring system
        confidenceScoring.recordFeedback(
            targetFinding,
            targetPattern,
            isFalsePositive,
            {
                ...metadata,
                scanId,
                timestamp: new Date(),
                userAgent: req.get('User-Agent')
            }
        );

        res.json({
            success: true,
            message: 'Feedback recorded successfully',
            findingId,
            isFalsePositive,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Record feedback error:', error.message);
        res.status(500).json({
            error: `Failed to record feedback: ${error.message}`
        });
    }
};

/**
 * Get confidence scoring statistics
 */
exports.getConfidenceStats = async (req, res) => {
    try {
        const stats = confidenceScoring.getStatistics();

        res.json({
            confidenceScoring: stats,
            patternEngine: patternEngine.getStats(),
            resultFormatter: {
                supportedFormats: outputFormatters.getSupportedFormats(),
                supportedCategories: resultFormatter.categories,
                supportedSeverityLevels: resultFormatter.severityLevels
            }
        });

    } catch (error) {
        console.error('❌ Get confidence stats error:', error.message);
        res.status(500).json({
            error: `Failed to get confidence statistics: ${error.message}`
        });
    }
};

/**
 * Get available scan types and their configurations
 */
exports.getScanTypes = async (req, res) => {
    try {
        const scanTypes = [
            {
                type: 'url',
                name: 'URL Scan',
                description: 'Scan web pages for exposed secrets and vulnerabilities',
                options: {
                    maxDepth: 'Maximum depth for crawling (default: 3)',
                    timeout: 'Request timeout in milliseconds (default: 30000)',
                    includePatterns: 'File patterns to include (array)',
                    excludePatterns: 'File patterns to exclude (array)'
                }
            },
            {
                type: 'repository',
                name: 'Repository Scan',
                description: 'Clone and scan Git repositories for security issues',
                options: {
                    branch: 'Specific branch to scan (default: main/master)',
                    maxSize: 'Maximum repository size in bytes',
                    includePatterns: 'File patterns to include (array)',
                    excludePatterns: 'File patterns to exclude (array)'
                }
            },
            {
                type: 'files',
                name: 'File Detection',
                description: 'Detect exposed sensitive files and directories',
                options: {
                    commonPaths: 'Check common sensitive file paths',
                    backupFiles: 'Check for backup file patterns',
                    configFiles: 'Analyze configuration file contents'
                }
            },
            {
                type: 'headers',
                name: 'Security Headers',
                description: 'Analyze HTTP security headers and configurations',
                options: {
                    checkCSP: 'Analyze Content Security Policy',
                    checkHSTS: 'Check HTTP Strict Transport Security',
                    checkCORS: 'Analyze CORS configuration'
                }
            },
            {
                type: 'owasp',
                name: 'OWASP Baseline',
                description: 'Check for OWASP Top 10 vulnerabilities',
                options: {
                    categories: 'OWASP categories to check (array)',
                    depth: 'Analysis depth (basic, standard, comprehensive)'
                }
            }
        ];

        res.json({
            scanTypes,
            patternStats: patternEngine.getStats()
        });

    } catch (error) {
        console.error('❌ Get scan types error:', error.message);
        res.status(500).json({
            error: `Failed to get scan types: ${error.message}`
        });
    }
};



// Backward compatibility endpoint
exports.scanWebsite = exports.startEnhancedScan;