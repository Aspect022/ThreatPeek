/**
 * Simple Enhanced Scan Controller - Basic version for development
 * Uses simplified orchestrator without resource management
 */

const { SimpleScanOrchestrator } = require('../services/simpleScanOrchestrator');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const { allPatterns } = require('../utils/enhancedPatternDefinitions');

// Global orchestrator instance
const orchestrator = new SimpleScanOrchestrator();

// Initialize pattern engine
const patternEngine = new EnhancedPatternEngine();
patternEngine.registerPatterns(allPatterns);

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

        // Set default options (spread user options first, then apply safe defaults)
        const scanOptions = {
            maxDepth: 3,
            timeout: 60000, // 60 seconds
            confidenceThreshold: 0.5,
            includePatterns: [],
            excludePatterns: [],
            ...options, // User options
            // Ensure minimum timeout - longer for repository scans
            timeout: repositoryUrl ?
                Math.max(options.timeout || 300000, 300000) : // 5 minutes for repositories
                Math.max(options.timeout || 60000, 30000) // 30 seconds for URLs
        };

        console.log(`[CONTROLLER] Using timeout: ${scanOptions.timeout}ms`);

        console.log(`🚀 Starting enhanced scan for: ${url || repositoryUrl}`);
        console.log(`📋 Scan types: ${scanTypes.join(', ')}`);

        // Start scan through orchestrator
        const scanId = await orchestrator.startScan({
            url,
            repositoryUrl,
            scanTypes,
            options: scanOptions
        });

        console.log(`✅ Enhanced scan started with ID: ${scanId}`);

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
            summary: status.results.summary
        });

    } catch (error) {
        console.error('❌ Get scan status error:', error.message);
        res.status(500).json({
            error: `Failed to get scan status: ${error.message}`
        });
    }
};

/**
 * Get complete scan results
 */
exports.getScanResults = async (req, res) => {
    try {
        const { scanId } = req.params;

        if (!scanId) {
            return res.status(400).json({
                error: 'Scan ID is required'
            });
        }

        console.log(`📊 Fetching results for scan ID: ${scanId}`);
        const scanData = orchestrator.getScanResults(scanId);

        if (!scanData) {
            console.log(`❌ Scan results not found for ID: ${scanId}`);
            // List available scan IDs for debugging
            const availableScans = Array.from(orchestrator.scanProgress.keys());
            console.log(`Available scan IDs: ${availableScans.join(', ')}`);

            return res.status(404).json({
                error: 'Scan results not found',
                availableScans: availableScans
            });
        }

        console.log(`✅ Found scan results for ${scanId}, status: ${scanData.status}`);

        // Return results in the expected format
        res.json(scanData);

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

// Placeholder functions for compatibility
exports.recordFeedback = async (req, res) => {
    res.json({ success: true, message: 'Feedback recording not implemented in simple version' });
};

exports.getConfidenceStats = async (req, res) => {
    res.json({
        message: 'Confidence stats not available in simple version',
        patternEngine: patternEngine.getStats()
    });
};

// Backward compatibility endpoint
exports.scanWebsite = exports.startEnhancedScan;