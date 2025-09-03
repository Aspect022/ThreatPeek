/**
 * Repository Scanner - Comprehensive Git repository scanning service
 * Handles GitHub and GitLab repository cloning, scanning, and cleanup
 */

const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const enhancedPatternDefinitions = require('../utils/enhancedPatternDefinitions');
const { WorkerPool } = require('../utils/workerPool');
const { RetryManager } = require('../utils/retryManager');
const { ResourceManager } = require('./resourceManager');
const { DeduplicationEngine } = require('../utils/deduplicationEngine');

class RepositoryScanner {
    constructor(options = {}) {
        this.tempDir = path.join(__dirname, '..', 'temp', 'repos');
        this.maxRepoSize = 500 * 1024 * 1024; // 500MB limit
        this.cloneTimeout = 300000; // 5 minutes
        this.scanTimeout = 600000; // 10 minutes
        this.activeScans = new Map();

        // Initialize resource manager
        this.resourceManager = new ResourceManager(options.resourceManager || {});

        // Resource management settings
        this.maxConcurrentScans = 5;
        this.maxTempDirSize = 2 * 1024 * 1024 * 1024; // 2GB total temp directory limit
        this.cleanupInterval = 30 * 60 * 1000; // 30 minutes
        this.maxScanAge = 2 * 60 * 60 * 1000; // 2 hours
        this.maxRepoSizeBytes = 500 * 1024 * 1024; // 500MB per repository
        this.scanTimeoutMs = 10 * 60 * 1000; // 10 minutes per scan

        // Resource monitoring
        this.resourceMonitor = {
            diskUsage: 0,
            activeScanCount: 0,
            lastCleanup: Date.now(),
            totalScansStarted: 0,
            totalScansCompleted: 0,
            totalScansFailed: 0,
            totalBytesProcessed: 0
        };

        // Interval references for cleanup
        this.cleanupIntervalRef = null;
        this.monitoringIntervalRef = null;

        // Start periodic cleanup and monitoring (only in production)
        if (process.env.NODE_ENV !== 'test') {
            this.startPeriodicCleanup();
            this.startResourceMonitoring();
        }

        // Initialize pattern engine
        this.patternEngine = new EnhancedPatternEngine();
        this.patternEngine.registerPatterns(enhancedPatternDefinitions.allPatterns);

        // Initialize worker pool for parallel processing
        this.workerPool = new WorkerPool({
            maxWorkers: Math.min(require('os').cpus().length, 4),
            workerScript: path.join(__dirname, '..', 'utils', 'scanWorker.js')
        });

        // Initialize retry manager for error recovery
        this.retryManager = new RetryManager({
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            backoffStrategy: 'exponential',
            jitter: true
        });

        // Default ignore patterns
        this.defaultIgnorePatterns = [
            'node_modules/**',
            '.git/**',
            '*.log',
            '*.tmp',
            '*.temp',
            'dist/**',
            'build/**',
            'coverage/**',
            '.nyc_output/**',
            '*.min.js',
            '*.bundle.js',
            'vendor/**',
            'third_party/**'
        ];

        // Supported file extensions for scanning
        this.supportedExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.json', '.env', '.config',
            '.py', '.rb', '.php', '.java', '.go', '.rs', '.cpp', '.c',
            '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.yaml', '.yml',
            '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.sql', '.md', '.txt', '.conf', '.ini', '.properties'
        ];

        this.ensureTempDirectory();
    }

    /**
     * Validate and parse repository URL
     * @param {string} url - Repository URL to validate
     * @returns {Object} Parsed repository information
     * @throws {Error} If URL is invalid or unsupported
     */
    parseRepositoryUrl(url) {
        if (!url || typeof url !== 'string') {
            throw this.createError('INVALID_URL', 'Repository URL is required and must be a string');
        }

        // Remove trailing slash and whitespace
        url = url.trim().replace(/\/+$/, '');

        // GitHub URL patterns
        const githubPatterns = [
            /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /^https?:\/\/www\.github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
        ];

        // GitLab URL patterns
        const gitlabPatterns = [
            /^https?:\/\/gitlab\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /^git@gitlab\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
            /^https?:\/\/www\.gitlab\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
        ];

        // Check GitHub patterns
        for (const pattern of githubPatterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    platform: 'github',
                    owner: match[1],
                    repo: match[2],
                    fullName: `${match[1]}/${match[2]}`,
                    originalUrl: url,
                    cloneUrl: `https://github.com/${match[1]}/${match[2]}.git`,
                    webUrl: `https://github.com/${match[1]}/${match[2]}`
                };
            }
        }

        // Check GitLab patterns
        for (const pattern of gitlabPatterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    platform: 'gitlab',
                    owner: match[1],
                    repo: match[2],
                    fullName: `${match[1]}/${match[2]}`,
                    originalUrl: url,
                    cloneUrl: `https://gitlab.com/${match[1]}/${match[2]}.git`,
                    webUrl: `https://gitlab.com/${match[1]}/${match[2]}`
                };
            }
        }

        // If no patterns match, throw an error
        throw this.createError(
            'UNSUPPORTED_URL',
            'Unsupported repository URL format. Please provide a valid GitHub or GitLab repository URL.',
            {
                supportedFormats: [
                    'https://github.com/owner/repo',
                    'https://gitlab.com/owner/repo',
                    'git@github.com:owner/repo.git',
                    'git@gitlab.com:owner/repo.git'
                ],
                providedUrl: url
            }
        );
    }

    /**
       * Check repository accessibility
       * @param {Object} repoInfo - Parsed repository information
       * @returns {Promise<Object>} Repository accessibility status
       */
    async checkRepositoryAccessibility(repoInfo) {
        return await this.retryManager.executeWithRetry(async () => {
            const git = simpleGit();
            const tempCheckPath = path.join(this.tempDir, `check_${uuidv4()}`);

            try {
                // Ensure temp directory exists
                await fs.ensureDir(tempCheckPath);

                // Try to perform a shallow clone to check accessibility
                await git.clone(repoInfo.cloneUrl, tempCheckPath, {
                    '--depth': 1,
                    '--single-branch': null,
                    '--no-tags': null
                });

                // Get basic repository information
                const repoGit = simpleGit(tempCheckPath);
                const log = await repoGit.log(['-1']);
                const remotes = await repoGit.getRemotes(true);
                const branches = await repoGit.branch();

                const repoStats = await this.getRepositoryStats(tempCheckPath);

                return {
                    accessible: true,
                    lastCommit: log.latest ? {
                        hash: log.latest.hash,
                        date: log.latest.date,
                        message: log.latest.message,
                        author: log.latest.author_name
                    } : null,
                    defaultBranch: branches.current,
                    remotes: remotes.map(r => ({ name: r.name, url: r.refs.fetch })),
                    stats: repoStats
                };

            } catch (error) {
                // For non-retryable errors, return structured error immediately
                if (!this.retryManager.defaultRetryCondition(error, 0)) {
                    return this.handleRepositoryAccessError(error, repoInfo);
                }
                throw error; // Let retry manager handle retryable errors
            } finally {
                // Clean up temporary check directory
                try {
                    await fs.remove(tempCheckPath);
                } catch (cleanupError) {
                    console.warn(`Failed to cleanup temp check directory: ${cleanupError.message}`);
                }
            }
        }, {
            context: `repository-accessibility-check-${repoInfo.fullName}`,
            onRetry: async (error, attempt, delay) => {
                console.log(`🔄 Retrying repository accessibility check for ${repoInfo.fullName} (attempt ${attempt + 1}) after ${delay}ms: ${error.message}`);
            }
        }).catch(error => {
            // If retry exhausted, return structured error
            if (error.code === 'RETRY_EXHAUSTED') {
                return this.handleRepositoryAccessError(error.originalError, repoInfo);
            }
            return this.handleRepositoryAccessError(error, repoInfo);
        });
    }

    /**
     * Handle repository access errors with structured error responses
     * @param {Error} error - The error that occurred
     * @param {Object} repoInfo - Repository information
     * @returns {Object} Structured error response
     */
    handleRepositoryAccessError(error, repoInfo) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
            return {
                accessible: false,
                error: this.createError(
                    'REPOSITORY_NOT_FOUND',
                    `Repository not found: ${repoInfo.fullName}. Please check if the repository exists and is publicly accessible.`,
                    {
                        repository: repoInfo.fullName,
                        platform: repoInfo.platform,
                        suggestions: [
                            'Verify the repository name and owner are correct',
                            'Check if the repository is public',
                            'Ensure the repository has not been deleted or renamed'
                        ]
                    }
                )
            };
        }

        if (errorMessage.includes('permission denied') || errorMessage.includes('403')) {
            return {
                accessible: false,
                error: this.createError(
                    'REPOSITORY_ACCESS_DENIED',
                    `Access denied to repository: ${repoInfo.fullName}. The repository may be private or require authentication.`,
                    {
                        repository: repoInfo.fullName,
                        platform: repoInfo.platform,
                        suggestions: [
                            'Check if the repository is public',
                            'Verify you have access permissions',
                            'For private repositories, authentication is required'
                        ]
                    }
                )
            };
        }

        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            return {
                accessible: false,
                error: this.createError(
                    'REPOSITORY_TIMEOUT',
                    `Timeout while accessing repository: ${repoInfo.fullName}. The repository may be too large or the network connection is slow.`,
                    {
                        repository: repoInfo.fullName,
                        timeout: this.cloneTimeout,
                        suggestions: [
                            'Try again later',
                            'Check your network connection',
                            'The repository may be very large'
                        ]
                    }
                )
            };
        }

        if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            return {
                accessible: false,
                error: this.createError(
                    'NETWORK_ERROR',
                    `Network error while accessing repository: ${repoInfo.fullName}. Please check your internet connection.`,
                    {
                        repository: repoInfo.fullName,
                        suggestions: [
                            'Check your internet connection',
                            'Try again later',
                            'Verify the repository URL is correct'
                        ]
                    }
                )
            };
        }

        // Generic error for unhandled cases
        return {
            accessible: false,
            error: this.createError(
                'REPOSITORY_ACCESS_ERROR',
                `Failed to access repository: ${repoInfo.fullName}. ${error.message}`,
                {
                    repository: repoInfo.fullName,
                    originalError: error.message,
                    suggestions: [
                        'Verify the repository URL is correct',
                        'Check if the repository is publicly accessible',
                        'Try again later'
                    ]
                }
            )
        };
    }    /*
*
     * Get basic repository statistics
     * @param {string} repoPath - Path to the cloned repository
     * @returns {Promise<Object>} Repository statistics
     */
    async getRepositoryStats(repoPath) {
        try {
            const stats = await fs.stat(repoPath);
            const files = await this.countFiles(repoPath);

            return {
                size: stats.size,
                totalFiles: files.total,
                scannableFiles: files.scannable,
                lastModified: stats.mtime
            };
        } catch (error) {
            return {
                size: 0,
                totalFiles: 0,
                scannableFiles: 0,
                lastModified: null,
                error: error.message
            };
        }
    }

    /**
     * Count files in repository
     * @param {string} repoPath - Path to repository
     * @returns {Promise<Object>} File counts
     */
    async countFiles(repoPath) {
        let total = 0;
        let scannable = 0;

        const countRecursive = async (dirPath) => {
            try {
                const items = await fs.readdir(dirPath);

                for (const item of items) {
                    const itemPath = path.join(dirPath, item);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        // Skip ignored directories
                        if (!this.shouldIgnorePath(path.relative(repoPath, itemPath))) {
                            await countRecursive(itemPath);
                        }
                    } else if (stat.isFile()) {
                        total++;
                        if (this.isScannable(itemPath)) {
                            scannable++;
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };

        await countRecursive(repoPath);
        return { total, scannable };
    }

    /**
     * Check if a file is scannable based on extension
     * @param {string} filePath - Path to the file
     * @returns {boolean} True if file should be scanned
     */
    isScannable(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.includes(ext) || path.basename(filePath).startsWith('.');
    }

    /**
     * Check if a path should be ignored
     * @param {string} relativePath - Relative path from repository root
     * @returns {boolean} True if path should be ignored
     */
    shouldIgnorePath(relativePath) {
        const normalizedPath = relativePath.replace(/\\/g, '/');

        return this.defaultIgnorePatterns.some(pattern => {
            // Handle patterns that should match anywhere in the path (like node_modules/**)
            if (pattern.includes('**')) {
                // For patterns like 'node_modules/**', also match if node_modules appears anywhere in path
                const basePattern = pattern.replace('/**', '');
                if (normalizedPath.includes(basePattern + '/') || normalizedPath.endsWith(basePattern)) {
                    return true;
                }
            }

            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '[^/]');

            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(normalizedPath);
        });
    }    /**

     * Clone repository to temporary directory
     * @param {Object} repoInfo - Repository information
     * @param {Object} options - Clone options
     * @returns {Promise<Object>} Clone result with scanId and path
     */
    async cloneRepository(repoInfo, options = {}) {
        const {
            branch = null,
            depth = null,
            includePatterns = [],
            excludePatterns = []
        } = options;

        // Check resource availability before starting
        const resourceCheck = await this.checkResourceAvailability();
        if (!resourceCheck.available) {
            throw this.createError(
                'RESOURCE_LIMIT_EXCEEDED',
                `Cannot start new scan: ${resourceCheck.message}`,
                {
                    repository: repoInfo.fullName,
                    resourceChecks: resourceCheck.checks
                }
            );
        }

        const scanId = uuidv4();
        const clonePath = path.join(this.tempDir, `clone_${scanId}`);

        try {
            // Update resource monitoring
            this.resourceMonitor.totalScansStarted++;
            this.resourceMonitor.activeScanCount++;

            // Ensure temp directory exists
            await fs.ensureDir(clonePath);

            // Set up git clone options
            const cloneOptions = {
                '--single-branch': null,
                '--no-tags': null
            };

            if (depth) {
                cloneOptions['--depth'] = depth;
            }

            if (branch) {
                cloneOptions['--branch'] = branch;
            }

            // Perform the clone with retry logic and timeout
            await this.retryManager.executeWithRetry(async () => {
                const git = simpleGit();
                const clonePromise = git.clone(repoInfo.cloneUrl, clonePath, cloneOptions);

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Clone operation timed out')), this.cloneTimeout);
                });

                await Promise.race([clonePromise, timeoutPromise]);
            }, {
                context: `repository-clone-${repoInfo.fullName}`,
                maxRetries: 2, // Fewer retries for clone operations due to time/resource cost
                onRetry: async (error, attempt, delay) => {
                    console.log(`🔄 Retrying repository clone for ${repoInfo.fullName} (attempt ${attempt + 1}) after ${delay}ms: ${error.message}`);
                    // Clean up failed clone attempt
                    try {
                        await fs.remove(clonePath);
                        await fs.ensureDir(clonePath);
                    } catch (cleanupError) {
                        console.warn(`Failed to cleanup failed clone attempt: ${cleanupError.message}`);
                    }
                }
            });

            // Verify clone was successful
            const clonedGit = simpleGit(clonePath);
            await clonedGit.status(); // This will throw if not a valid git repo

            // Check repository size after cloning
            const repoSize = await this.getDirectorySize(clonePath);
            if (repoSize > this.maxRepoSizeBytes) {
                // Clean up oversized repository
                await fs.remove(clonePath);
                throw this.createError(
                    'REPOSITORY_TOO_LARGE',
                    `Repository ${repoInfo.fullName} is too large (${Math.round(repoSize / 1024 / 1024)}MB). Maximum allowed size is ${Math.round(this.maxRepoSizeBytes / 1024 / 1024)}MB.`,
                    {
                        repository: repoInfo.fullName,
                        actualSize: repoSize,
                        maxSize: this.maxRepoSizeBytes,
                        suggestions: [
                            'Try using a shallow clone with --depth parameter',
                            'Consider scanning specific directories instead of the entire repository',
                            'Contact administrator to increase size limits if needed'
                        ]
                    }
                );
            }

            // Store active scan info for cleanup
            this.activeScans.set(scanId, {
                path: clonePath,
                repoInfo,
                startTime: Date.now(),
                size: repoSize
            });

            // Update resource monitoring
            this.resourceMonitor.diskUsage += repoSize;
            this.resourceMonitor.totalBytesProcessed += repoSize;

            return { scanId, clonePath };

        } catch (error) {
            // Update failure count
            this.resourceMonitor.totalScansFailed++;
            this.resourceMonitor.activeScanCount = Math.max(0, this.resourceMonitor.activeScanCount - 1);

            // Clean up on failure
            try {
                await fs.remove(clonePath);
            } catch (cleanupError) {
                console.warn(`Failed to cleanup failed clone: ${cleanupError.message}`);
            }

            // Re-throw the error if it's already a structured error
            if (error.code) {
                throw error;
            }

            throw this.createError(
                'CLONE_FAILED',
                `Failed to clone repository ${repoInfo.fullName}: ${error.message}`,
                {
                    repository: repoInfo.fullName,
                    cloneUrl: repoInfo.cloneUrl,
                    originalError: error.message
                }
            );
        }
    }    /**

     * Recursively scan files in cloned repository
     * @param {string} repoPath - Path to cloned repository
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan results with findings and stats
     */
    async scanRepositoryFiles(repoPath, options = {}) {
        const {
            includePatterns = [],
            excludePatterns = [],
            maxFiles = 1000,
            onProgress = null,
            useParallelProcessing = true,
            batchSize = 20,
            enableDeduplication = true
        } = options;

        // Initialize deduplication engine
        const deduplicationEngine = new DeduplicationEngine({
            enableFileLevel: enableDeduplication,
            enableScanLevel: enableDeduplication,
            preserveContext: true,
            maxCacheSize: 10000
        });

        // First, collect all scannable files
        const scannableFiles = await this.collectScannableFiles(repoPath, {
            includePatterns,
            excludePatterns,
            maxFiles
        });

        const totalFiles = scannableFiles.length;
        let filesScanned = 0;
        const allFindings = [];

        if (useParallelProcessing && totalFiles > 5) {
            // Use parallel processing for multiple files
            console.log(`🔄 Scanning ${totalFiles} files using parallel processing`);

            // Process files in batches to avoid overwhelming the worker pool
            const batches = [];
            for (let i = 0; i < scannableFiles.length; i += batchSize) {
                batches.push(scannableFiles.slice(i, i + batchSize));
            }

            for (const batch of batches) {
                try {
                    const batchResults = await this.workerPool.scanFilesParallel(
                        batch.map(f => f.fullPath),
                        {
                            categories: options.categories || ['secrets', 'vulnerabilities', 'configurations'],
                            confidenceThreshold: options.confidenceThreshold || 0.5,
                            maxMatches: options.maxMatches || 50,
                            maxFileSize: options.maxFileSize || 10 * 1024 * 1024,
                            timeout: options.timeout || 30000
                        }
                    );

                    // Process batch results with file-level deduplication
                    batchResults.forEach((result, index) => {
                        if (result && result.findings) {
                            // Update relative paths
                            result.findings.forEach(finding => {
                                finding.file = batch[index].relativePath;
                            });

                            // Apply file-level deduplication
                            const deduplicatedFileFindings = enableDeduplication
                                ? deduplicationEngine.deduplicateFileFindings(result.findings, batch[index].relativePath)
                                : result.findings;

                            allFindings.push(...deduplicatedFileFindings);
                        }
                        filesScanned++;

                        // Update progress
                        if (onProgress && totalFiles > 0) {
                            const progress = Math.floor((filesScanned / totalFiles) * 100);
                            onProgress(progress);
                        }
                    });

                } catch (error) {
                    console.warn(`Batch processing error: ${error.message}`);
                    // Fall back to sequential processing for this batch
                    for (const file of batch) {
                        try {
                            const fileFindings = await this.scanFile(file.fullPath, file.relativePath);

                            // Apply file-level deduplication
                            const deduplicatedFileFindings = enableDeduplication
                                ? deduplicationEngine.deduplicateFileFindings(fileFindings, file.relativePath)
                                : fileFindings;

                            allFindings.push(...deduplicatedFileFindings);
                        } catch (fileError) {
                            console.warn(`Failed to scan file ${file.relativePath}: ${fileError.message}`);
                        }
                        filesScanned++;

                        if (onProgress && totalFiles > 0) {
                            const progress = Math.floor((filesScanned / totalFiles) * 100);
                            onProgress(progress);
                        }
                    }
                }
            }

        } else {
            // Use sequential processing for small numbers of files
            console.log(`🔄 Scanning ${totalFiles} files using sequential processing`);

            for (const file of scannableFiles) {
                try {
                    const fileFindings = await this.scanFile(file.fullPath, file.relativePath);

                    // Apply file-level deduplication
                    const deduplicatedFileFindings = enableDeduplication
                        ? deduplicationEngine.deduplicateFileFindings(fileFindings, file.relativePath)
                        : fileFindings;

                    allFindings.push(...deduplicatedFileFindings);
                } catch (error) {
                    console.warn(`Failed to scan file ${file.relativePath}: ${error.message}`);
                }

                filesScanned++;

                // Update progress
                if (onProgress && totalFiles > 0) {
                    const progress = Math.floor((filesScanned / totalFiles) * 100);
                    onProgress(progress);
                }
            }
        }

        // Apply scan-level deduplication for final results
        const finalFindings = enableDeduplication && !deduplicationEngine.shouldSkipDeduplication(allFindings)
            ? deduplicationEngine.deduplicateScanFindings(allFindings)
            : allFindings;

        // Get file counts for stats
        const fileCounts = await this.countFiles(repoPath);

        // Get deduplication statistics
        const deduplicationStats = enableDeduplication ? deduplicationEngine.getStats() : null;

        return {
            findings: finalFindings,
            filesScanned,
            totalFiles: fileCounts.total,
            scannableFiles: fileCounts.scannable,
            parallelProcessingUsed: useParallelProcessing && totalFiles > 5,
            deduplicationStats
        };
    }

    /**
     * Collect all scannable files from repository
     * @param {string} repoPath - Path to repository
     * @param {Object} options - Collection options
     * @returns {Promise<Array>} Array of file objects with paths
     */
    async collectScannableFiles(repoPath, options = {}) {
        const {
            includePatterns = [],
            excludePatterns = [],
            maxFiles = 1000
        } = options;

        const scannableFiles = [];

        const collectRecursive = async (dirPath) => {
            try {
                const items = await fs.readdir(dirPath);

                for (const item of items) {
                    if (scannableFiles.length >= maxFiles) break;

                    const itemPath = path.join(dirPath, item);
                    const relativePath = path.relative(repoPath, itemPath);
                    const stat = await fs.stat(itemPath);

                    if (stat.isDirectory()) {
                        // Skip ignored directories
                        if (!this.shouldIgnorePath(relativePath)) {
                            await collectRecursive(itemPath);
                        }
                    } else if (stat.isFile()) {
                        // Check if file should be scanned
                        if (this.shouldScanFile(relativePath, includePatterns, excludePatterns)) {
                            scannableFiles.push({
                                fullPath: itemPath,
                                relativePath,
                                size: stat.size
                            });
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
                console.warn(`Failed to read directory ${dirPath}: ${error.message}`);
            }
        };

        await collectRecursive(repoPath);
        return scannableFiles;
    }

    /**
     * Determine if a file should be scanned based on patterns
     * @param {string} relativePath - Relative path from repository root
     * @param {Array} includePatterns - Patterns to include
     * @param {Array} excludePatterns - Patterns to exclude
     * @returns {boolean} True if file should be scanned
     */
    shouldScanFile(relativePath, includePatterns = [], excludePatterns = []) {
        // First check if file is generally scannable
        if (!this.isScannable(relativePath)) {
            return false;
        }

        // Check if path should be ignored by default patterns
        if (this.shouldIgnorePath(relativePath)) {
            return false;
        }

        // Apply custom exclude patterns
        if (excludePatterns.length > 0) {
            const normalizedPath = relativePath.replace(/\\/g, '/');
            for (const pattern of excludePatterns) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                if (regex.test(normalizedPath)) {
                    return false;
                }
            }
        }

        // Apply custom include patterns (if specified, only include matching files)
        if (includePatterns.length > 0) {
            const normalizedPath = relativePath.replace(/\\/g, '/');
            return includePatterns.some(pattern => {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(normalizedPath);
            });
        }

        return true;
    }    /**

     * Scan individual file for patterns
     * @param {string} filePath - Absolute path to file
     * @param {string} relativePath - Relative path from repository root
     * @returns {Promise<Array>} Findings from the file
     */
    async scanFile(filePath, relativePath) {
        try {
            // Check file size to avoid scanning very large files
            const stats = await fs.stat(filePath);
            const maxFileSize = 10 * 1024 * 1024; // 10MB limit

            if (stats.size > maxFileSize) {
                return [{
                    type: 'Large File Skipped',
                    severity: 'info',
                    confidence: 1.0,
                    value: `File too large to scan (${Math.round(stats.size / 1024 / 1024)}MB)`,
                    file: relativePath,
                    context: {
                        before: 'File size check:',
                        after: `Maximum size: ${maxFileSize / 1024 / 1024}MB`
                    },
                    pattern: {
                        id: 'large-file-skip',
                        category: 'info'
                    }
                }];
            }

            // Read file content
            const content = await fs.readFile(filePath, 'utf8');

            // Scan content with pattern engine
            const matches = this.patternEngine.scanContent(content, {
                categories: ['secrets', 'vulnerabilities', 'configurations'],
                confidenceThreshold: 0.5,
                maxMatches: 50
            });

            // Convert matches to findings format
            return matches.map(match => ({
                type: match.pattern.name,
                severity: match.pattern.severity,
                confidence: match.confidence,
                value: match.value,
                file: relativePath,
                context: {
                    before: match.context.before,
                    after: match.context.after
                },
                pattern: {
                    id: match.pattern.id,
                    category: match.pattern.category
                },
                location: {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index),
                    index: match.index
                }
            }));

        } catch (error) {
            // Return error as finding if file can't be read
            return [{
                type: 'File Read Error',
                severity: 'low',
                confidence: 1.0,
                value: `Failed to read file: ${error.message}`,
                file: relativePath,
                context: {
                    before: 'File access error:',
                    after: error.message
                },
                pattern: {
                    id: 'file-read-error',
                    category: 'info'
                }
            }];
        }
    }

    /**
     * Get line number for a character index in content
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Get column number for a character index in content
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} Column number (1-based)
     */
    getColumnNumber(content, index) {
        const beforeIndex = content.substring(0, index);
        const lastNewlineIndex = beforeIndex.lastIndexOf('\n');
        return index - lastNewlineIndex;
    }

    /**
     * Clean up cloned repository
     * @param {string} scanId - Scan ID to clean up
     * @returns {Promise<boolean>} True if cleanup was successful
     */
    async cleanupRepository(scanId) {
        const scanInfo = this.activeScans.get(scanId);
        if (!scanInfo) {
            return false;
        }

        try {
            // Get directory size before cleanup for monitoring
            const dirSize = await this.getDirectorySize(scanInfo.path);

            await fs.remove(scanInfo.path);
            this.activeScans.delete(scanId);

            // Update resource monitoring
            this.resourceMonitor.diskUsage = Math.max(0, this.resourceMonitor.diskUsage - dirSize);
            this.resourceMonitor.activeScanCount = Math.max(0, this.resourceMonitor.activeScanCount - 1);

            return true;
        } catch (error) {
            console.warn(`Failed to cleanup repository ${scanId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Start periodic cleanup of old scan directories
     */
    startPeriodicCleanup() {
        if (this.cleanupIntervalRef) {
            clearInterval(this.cleanupIntervalRef);
        }
        this.cleanupIntervalRef = setInterval(async () => {
            await this.performPeriodicCleanup();
        }, this.cleanupInterval);
    }

    /**
     * Start resource monitoring
     */
    startResourceMonitoring() {
        if (this.monitoringIntervalRef) {
            clearInterval(this.monitoringIntervalRef);
        }
        this.monitoringIntervalRef = setInterval(async () => {
            await this.updateResourceMonitoring();
        }, 60000); // Update every minute
    }

    /**
     * Stop all periodic tasks (useful for testing and cleanup)
     */
    stopPeriodicTasks() {
        if (this.cleanupIntervalRef) {
            clearInterval(this.cleanupIntervalRef);
            this.cleanupIntervalRef = null;
        }
        if (this.monitoringIntervalRef) {
            clearInterval(this.monitoringIntervalRef);
            this.monitoringIntervalRef = null;
        }
    }

    /**
     * Perform periodic cleanup of old and orphaned scan directories
     */
    async performPeriodicCleanup() {
        try {
            const now = Date.now();
            this.resourceMonitor.lastCleanup = now;

            // Clean up expired active scans
            const expiredScans = [];
            for (const [scanId, scanInfo] of this.activeScans.entries()) {
                if (now - scanInfo.startTime > this.maxScanAge) {
                    expiredScans.push(scanId);
                }
            }

            for (const scanId of expiredScans) {
                console.warn(`Cleaning up expired scan: ${scanId}`);
                await this.cleanupRepository(scanId);
            }

            // Clean up orphaned directories in temp folder
            await this.cleanupOrphanedDirectories();

            // Check and enforce total temp directory size limit
            await this.enforceTempDirSizeLimit();

            console.log(`Periodic cleanup completed. Active scans: ${this.activeScans.size}, Disk usage: ${Math.round(this.resourceMonitor.diskUsage / 1024 / 1024)}MB`);

        } catch (error) {
            console.error('Error during periodic cleanup:', error);
        }
    }

    /**
     * Clean up orphaned directories that are not tracked in activeScans
     */
    async cleanupOrphanedDirectories() {
        try {
            if (!await fs.pathExists(this.tempDir)) {
                return;
            }

            const items = await fs.readdir(this.tempDir);
            const now = Date.now();

            for (const item of items) {
                const itemPath = path.join(this.tempDir, item);
                const stat = await fs.stat(itemPath);

                if (stat.isDirectory()) {
                    // Check if this directory is tracked in activeScans
                    const isTracked = Array.from(this.activeScans.values())
                        .some(scanInfo => scanInfo.path === itemPath);

                    if (!isTracked) {
                        // Check if directory is old enough to be considered orphaned
                        const ageMs = now - stat.mtime.getTime();
                        if (ageMs > this.cleanupInterval) {
                            console.warn(`Removing orphaned directory: ${item}`);
                            await fs.remove(itemPath);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error cleaning up orphaned directories:', error);
        }
    }

    /**
     * Enforce total temporary directory size limit
     */
    async enforceTempDirSizeLimit() {
        try {
            const totalSize = await this.getTempDirectorySize();

            if (totalSize > this.maxTempDirSize) {
                console.warn(`Temp directory size (${Math.round(totalSize / 1024 / 1024)}MB) exceeds limit (${Math.round(this.maxTempDirSize / 1024 / 1024)}MB)`);

                // Get all scan directories sorted by age (oldest first)
                const scanDirs = [];
                for (const [scanId, scanInfo] of this.activeScans.entries()) {
                    scanDirs.push({
                        scanId,
                        path: scanInfo.path,
                        startTime: scanInfo.startTime
                    });
                }

                scanDirs.sort((a, b) => a.startTime - b.startTime);

                // Remove oldest scans until we're under the limit
                let currentSize = totalSize;
                for (const scanDir of scanDirs) {
                    if (currentSize <= this.maxTempDirSize * 0.8) { // Leave 20% buffer
                        break;
                    }

                    const dirSize = await this.getDirectorySize(scanDir.path);
                    console.warn(`Force cleaning up scan ${scanDir.scanId} to free space`);
                    await this.cleanupRepository(scanDir.scanId);
                    currentSize -= dirSize;
                }
            }
        } catch (error) {
            console.error('Error enforcing temp directory size limit:', error);
        }
    }

    /**
     * Update resource monitoring statistics
     */
    async updateResourceMonitoring() {
        try {
            this.resourceMonitor.diskUsage = await this.getTempDirectorySize();
            this.resourceMonitor.activeScanCount = this.activeScans.size;
        } catch (error) {
            console.error('Error updating resource monitoring:', error);
        }
    }

    /**
     * Get total size of temporary directory
     * @returns {Promise<number>} Size in bytes
     */
    async getTempDirectorySize() {
        try {
            if (!await fs.pathExists(this.tempDir)) {
                return 0;
            }
            return await this.getDirectorySize(this.tempDir);
        } catch (error) {
            console.error('Error getting temp directory size:', error);
            return 0;
        }
    }

    /**
     * Get size of a directory recursively
     * @param {string} dirPath - Directory path
     * @returns {Promise<number>} Size in bytes
     */
    async getDirectorySize(dirPath) {
        try {
            let totalSize = 0;

            const items = await fs.readdir(dirPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = await fs.stat(itemPath);

                if (stat.isDirectory()) {
                    totalSize += await this.getDirectorySize(itemPath);
                } else {
                    totalSize += stat.size;
                }
            }

            return totalSize;
        } catch (error) {
            // Return 0 if we can't read the directory
            return 0;
        }
    }

    /**
     * Check if system resources allow for a new scan
     * @returns {Promise<Object>} Resource check result
     */
    async checkResourceAvailability() {
        const currentDiskUsage = await this.getTempDirectorySize();
        const activeScanCount = this.activeScans.size;

        const checks = {
            diskSpace: {
                available: currentDiskUsage < this.maxTempDirSize * 0.9, // 90% threshold
                current: currentDiskUsage,
                limit: this.maxTempDirSize,
                message: currentDiskUsage >= this.maxTempDirSize * 0.9
                    ? `Disk usage (${Math.round(currentDiskUsage / 1024 / 1024)}MB) approaching limit (${Math.round(this.maxTempDirSize / 1024 / 1024)}MB)`
                    : 'Disk space available'
            },
            concurrentScans: {
                available: activeScanCount < this.maxConcurrentScans,
                current: activeScanCount,
                limit: this.maxConcurrentScans,
                message: activeScanCount >= this.maxConcurrentScans
                    ? `Maximum concurrent scans (${this.maxConcurrentScans}) reached`
                    : 'Concurrent scan slots available'
            }
        };

        const allAvailable = checks.diskSpace.available && checks.concurrentScans.available;

        return {
            available: allAvailable,
            checks,
            message: allAvailable
                ? 'Resources available for new scan'
                : 'Resource limits reached - scan may be queued or rejected'
        };
    }

    /**
     * Get current resource monitoring statistics
     * @returns {Object} Resource monitoring data
     */
    getResourceStats() {
        return {
            ...this.resourceMonitor,
            limits: {
                maxConcurrentScans: this.maxConcurrentScans,
                maxTempDirSize: this.maxTempDirSize,
                maxRepoSize: this.maxRepoSizeBytes,
                scanTimeout: this.scanTimeoutMs
            },
            formattedStats: {
                diskUsage: `${Math.round(this.resourceMonitor.diskUsage / 1024 / 1024)}MB`,
                diskUsagePercent: Math.round((this.resourceMonitor.diskUsage / this.maxTempDirSize) * 100),
                activeScanCount: this.resourceMonitor.activeScanCount,
                totalBytesProcessed: `${Math.round(this.resourceMonitor.totalBytesProcessed / 1024 / 1024)}MB`
            }
        };
    }
    /**
       * Create structured error object
       * @param {string} code - Error code
       * @param {string} message - Error message
       * @param {Object} details - Additional error details
       * @returns {Error} Structured error object
       */
    createError(code, message, details = {}) {
        const error = new Error(message);
        error.code = code;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * Ensure temporary directory exists
     */
    async ensureTempDirectory() {
        try {
            await fs.ensureDir(this.tempDir);
        } catch (error) {
            console.error('Failed to create temp directory:', error);
            throw this.createError(
                'TEMP_DIR_ERROR',
                'Failed to create temporary directory for repository operations',
                { error: error.message }
            );
        }
    }

    /**
     * Main scan method with full repository cloning and scanning
     * @param {Object} target - Scan target with repository URL
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Scan results
     */
    async scan(target, options = {}) {
        const { value: repositoryUrl } = target;
        const {
            onProgress = null,
            includePatterns = [],
            excludePatterns = [],
            maxFiles = 1000,
            branch = null,
            depth = 1,
            timeout = this.scanTimeoutMs
        } = options;

        let scanId = null;
        const scanStartTime = Date.now();

        try {
            // Wrap entire scan in timeout
            const scanPromise = this.performScan(target, {
                onProgress,
                includePatterns,
                excludePatterns,
                maxFiles,
                branch,
                depth
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(this.createError(
                        'SCAN_TIMEOUT',
                        `Repository scan timed out after ${Math.round(timeout / 1000)} seconds`,
                        {
                            repository: repositoryUrl,
                            timeout: timeout,
                            suggestions: [
                                'Try using a shallow clone with --depth parameter',
                                'Reduce the number of files to scan',
                                'Contact administrator to increase timeout limits'
                            ]
                        }
                    ));
                }, timeout);
            });

            const result = await Promise.race([scanPromise, timeoutPromise]);

            // Update success count
            this.resourceMonitor.totalScansCompleted++;

            return result;

        } catch (error) {
            // Update failure count
            this.resourceMonitor.totalScansFailed++;

            // Cleanup on error
            if (scanId) {
                await this.cleanupRepository(scanId);
            }

            console.error('Repository scan error:', error);
            throw error;
        }
    }

    /**
     * Perform the actual scan operation (separated for timeout handling)
     * @param {Object} target - Scan target
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Scan results
     */
    async performScan(target, options) {
        const { value: repositoryUrl } = target;
        const {
            onProgress = null,
            includePatterns = [],
            excludePatterns = [],
            maxFiles = 1000,
            branch = null,
            depth = 1
        } = options;

        let scanId = null;

        try {
            // Parse and validate URL
            if (onProgress) onProgress(5);
            const repoInfo = this.parseRepositoryUrl(repositoryUrl);

            // Check accessibility
            if (onProgress) onProgress(10);
            const accessCheck = await this.checkRepositoryAccessibility(repoInfo);

            if (!accessCheck.accessible) {
                throw accessCheck.error;
            }

            // Clone repository
            if (onProgress) onProgress(20);
            const cloneResult = await this.cloneRepository(repoInfo, {
                branch,
                depth,
                includePatterns,
                excludePatterns
            });

            scanId = cloneResult.scanId;
            const clonePath = cloneResult.clonePath;

            // Scan repository files
            if (onProgress) onProgress(30);
            const scanResult = await this.scanRepositoryFiles(clonePath, {
                includePatterns,
                excludePatterns,
                maxFiles,
                onProgress: (fileProgress) => {
                    // Map file scanning progress to overall progress (30-90%)
                    const overallProgress = 30 + Math.floor(fileProgress * 0.6);
                    if (onProgress) onProgress(overallProgress);
                }
            });

            // Cleanup
            if (onProgress) onProgress(95);
            await this.cleanupRepository(scanId);

            if (onProgress) onProgress(100);

            // Add repository metadata to findings
            const findings = scanResult.findings.map(finding => ({
                ...finding,
                metadata: {
                    repository: repoInfo,
                    scanStats: {
                        filesScanned: scanResult.filesScanned,
                        totalFiles: scanResult.totalFiles,
                        scannableFiles: scanResult.scannableFiles
                    }
                }
            }));

            return findings;

        } catch (error) {
            // Cleanup on error
            if (scanId) {
                await this.cleanupRepository(scanId);
            }

            throw error;
        }
    }

    /**
     * Shutdown the repository scanner and cleanup resources
     * @param {number} timeout - Timeout for graceful shutdown
     * @returns {Promise<void>}
     */
    async shutdown(timeout = 5000) {
        console.log('🔄 Shutting down repository scanner...');

        // Stop periodic cleanup
        if (this.cleanupIntervalRef) {
            clearInterval(this.cleanupIntervalRef);
            this.cleanupIntervalRef = null;
        }

        if (this.monitoringIntervalRef) {
            clearInterval(this.monitoringIntervalRef);
            this.monitoringIntervalRef = null;
        }

        // Cleanup all active scans
        const cleanupPromises = [];
        for (const scanId of this.activeScans.keys()) {
            cleanupPromises.push(this.cleanupRepository(scanId));
        }

        await Promise.all(cleanupPromises);

        // Shutdown worker pool
        if (this.workerPool) {
            await this.workerPool.shutdown(timeout);
        }

        console.log('✅ Repository scanner shutdown complete');
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    getPerformanceStats() {
        const workerStats = this.workerPool ? this.workerPool.getStats() : {};

        return {
            resourceMonitor: { ...this.resourceMonitor },
            workerPool: workerStats,
            activeScans: this.activeScans.size,
            tempDirSize: this.resourceMonitor.diskUsage
        };
    }
}

module.exports = new RepositoryScanner();