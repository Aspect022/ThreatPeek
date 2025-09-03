/**
 * File Detection Scanner - Detects exposed sensitive files and directories
 * Implements detection for .env, .git/config, .DS_Store, config.js, .htaccess files
 * Requirements: 2.1, 2.2, 2.5
 */

const axios = require('axios');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const { allPatterns } = require('../utils/enhancedPatternDefinitions');
const { RetryManager } = require('../utils/retryManager');

class FileDetectionScanner {
    constructor() {
        this.patternEngine = new EnhancedPatternEngine();
        this.patternEngine.registerPatterns(allPatterns);

        // Define sensitive file paths to check
        this.sensitiveFiles = [
            '.env',
            '.env.local',
            '.env.production',
            '.env.development',
            '.git/config',
            '.DS_Store',
            'config.js',
            'config.json',
            '.htaccess',
            'web.config',
            'app.config',
            'database.yml',
            'secrets.yml',
            'credentials.json',
            'id_rsa',
            'id_dsa',
            'id_ecdsa',
            'id_ed25519',
            'private.key',
            'server.key',
            'cert.pem',
            'certificate.crt',
            'wp-config.php',
            'settings.py',
            'local_settings.py',
            'production.py',
            'development.py'
        ];

        // Define directories to check for listing vulnerabilities
        this.sensitiveDirectories = [
            '.git',
            '.svn',
            '.hg',
            '.bzr',
            'admin',
            'backup',
            'backups',
            'config',
            'configs',
            'logs',
            'log',
            'temp',
            'tmp',
            'uploads',
            'files',
            'data',
            'db',
            'database',
            'sql',
            'private',
            'secret',
            'secrets',
            'keys',
            'certs',
            'certificates'
        ];

        // Define backup file extensions to check
        this.backupExtensions = [
            '.bak',
            '.backup',
            '.old',
            '.orig',
            '.save',
            '.tmp',
            '.swp',
            '.swo',
            '~',
            '.copy',
            '.1',
            '.2'
        ];

        // HTTP client configuration
        this.httpClient = axios.create({
            timeout: 60000, // 60 seconds
            maxRedirects: 3,
            validateStatus: (status) => status < 500, // Don't throw on 4xx errors
            headers: {
                'User-Agent': 'ThreatPeek-Scanner/1.0'
            }
        });

        // Initialize retry manager for network operations
        this.retryManager = new RetryManager({
            maxRetries: 3,
            baseDelay: 500,
            maxDelay: 5000,
            backoffStrategy: 'exponential',
            jitter: true
        });
    }

    /**
     * Scan target URL for exposed sensitive files
     * @param {Object} target - Target object with URL
     * @param {Object} options - Scan options
     * @returns {Array} Array of findings
     */
    async scan(target, options = {}) {
        const { value: url } = target;
        const { onProgress, timeout = 60000 } = options;

        console.log(`[FILE_DETECTION_SCANNER] Starting scan for: ${url}`);
        console.log(`[FILE_DETECTION_SCANNER] Using timeout: ${timeout}ms`);

        const findings = [];
        const totalFiles = this.sensitiveFiles.length;
        let processedFiles = 0;

        try {
            // Normalize URL
            const baseUrl = this.normalizeUrl(url);

            // Validate URL format
            if (!this.isValidUrl(baseUrl)) {
                throw new Error('Invalid URL format');
            }

            // Calculate total items to scan (files + directories + backup files)
            const totalItems = this.sensitiveFiles.length + this.sensitiveDirectories.length + 10; // Estimate for backup files
            let processedItems = 0;

            // Check each sensitive file
            for (const filePath of this.sensitiveFiles) {
                try {
                    const fileUrl = `${baseUrl}/${filePath}`;
                    const result = await this.checkFileAccessibility(fileUrl, filePath);

                    if (result) {
                        findings.push(result);
                    }

                    processedItems++;

                    // Update progress
                    if (onProgress) {
                        const progress = Math.round((processedItems / totalItems) * 100);
                        onProgress(Math.min(progress, 100));
                    }

                    // Small delay to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.warn(`[FILE_DETECTION_SCANNER] Error checking ${filePath}:`, error.message);
                    processedItems++;
                }
            }

            // Check for directory listing vulnerabilities
            for (const dirPath of this.sensitiveDirectories) {
                try {
                    const dirUrl = `${baseUrl}/${dirPath}/`;
                    const result = await this.checkDirectoryListing(dirUrl, dirPath);

                    if (result) {
                        findings.push(result);
                    }

                    processedItems++;

                    // Update progress
                    if (onProgress) {
                        const progress = Math.round((processedItems / totalItems) * 100);
                        onProgress(Math.min(progress, 100));
                    }

                    // Small delay to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {
                    console.warn(`[FILE_DETECTION_SCANNER] Error checking directory ${dirPath}:`, error.message);
                    processedItems++;
                }
            }

            // Check for exposed backup files
            const backupFindings = await this.checkBackupFiles(baseUrl);
            findings.push(...backupFindings);

            // Update final progress
            if (onProgress) {
                onProgress(100);
            }

            console.log(`[FILE_DETECTION_SCANNER] Completed scan. Found ${findings.length} exposed files.`);
            return findings;

        } catch (error) {
            console.error(`[FILE_DETECTION_SCANNER] Scan failed:`, error.message);
            throw new Error(`File detection scan failed: ${error.message}`);
        }
    }

    /**
     * Check if a specific file is accessible
     * @param {string} fileUrl - Full URL to the file
     * @param {string} filePath - Relative file path
     * @returns {Object|null} Finding object if file is accessible, null otherwise
     */
    async checkFileAccessibility(fileUrl, filePath) {
        try {
            const response = await this.retryManager.executeWithRetry(async () => {
                return await this.httpClient.get(fileUrl);
            }, {
                context: `file-accessibility-${filePath}`,
                retryCondition: (error, attempt) => {
                    // Don't retry on 404 or other client errors
                    if (error.response && error.response.status >= 400 && error.response.status < 500) {
                        return false;
                    }
                    return this.retryManager.defaultRetryCondition(error, attempt);
                },
                onRetry: async (error, attempt, delay) => {
                    console.log(`🔄 Retrying file accessibility check for ${filePath} (attempt ${attempt + 1}) after ${delay}ms: ${error.message}`);
                }
            });

            // Check if file is accessible (2xx status codes)
            if (response.status >= 200 && response.status < 300) {
                const contentLength = response.headers['content-length'];
                const contentType = response.headers['content-type'] || '';
                const content = response.data || '';

                // Skip if it's clearly a 404 page or error page
                if (this.isErrorPage(content, response.status)) {
                    return null;
                }

                // Create base finding
                const finding = {
                    type: 'Exposed Sensitive File',
                    severity: this.getFileSeverity(filePath),
                    confidence: this.calculateFileConfidence(filePath, content, response),
                    value: filePath,
                    file: fileUrl,
                    context: {
                        before: 'File accessibility check',
                        after: `File accessible at ${fileUrl}`,
                        full: `Exposed file: ${filePath} (${contentLength || 'unknown'} bytes)`
                    },
                    pattern: {
                        id: `exposed-file-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
                        category: 'files',
                        name: `Exposed ${filePath} file`
                    },
                    metadata: {
                        url: fileUrl,
                        statusCode: response.status,
                        contentType,
                        contentLength: contentLength ? parseInt(contentLength) : null,
                        responseTime: null // Response time tracking not implemented yet
                    }
                };

                // Analyze file content if it's a configuration file
                if (this.isConfigurationFile(filePath) && content && typeof content === 'string') {
                    const contentFindings = await this.analyzeFileContent(content, fileUrl, filePath);
                    if (contentFindings.length > 0) {
                        finding.contentAnalysis = contentFindings;
                        // Increase severity if secrets found in content
                        if (contentFindings.some(f => f.pattern.category === 'secrets')) {
                            finding.severity = 'critical';
                            finding.confidence = Math.min(1.0, finding.confidence + 0.2);
                        }
                    }
                }

                return finding;
            }

            return null;

        } catch (error) {
            // Only log non-404 errors
            if (error.response?.status !== 404) {
                console.debug(`[FILE_DETECTION_SCANNER] Error accessing ${fileUrl}: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Analyze content of configuration files for embedded secrets
     * @param {string} content - File content
     * @param {string} fileUrl - URL of the file
     * @param {string} filePath - Relative file path
     * @returns {Array} Array of content findings
     */
    async analyzeFileContent(content, fileUrl, filePath) {
        try {
            // Use pattern engine to scan content for secrets
            const matches = this.patternEngine.scanContent(content, {
                categories: ['secrets', 'configurations'],
                confidenceThreshold: 0.6,
                maxMatches: 20
            });

            return matches.map(match => ({
                type: 'Secret in Configuration File',
                severity: match.pattern.severity,
                confidence: match.confidence,
                value: match.value,
                file: fileUrl,
                context: {
                    before: match.context.before,
                    after: match.context.after,
                    full: `Found in ${filePath}: ${match.context.full}`
                },
                pattern: match.pattern,
                location: {
                    file: filePath,
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }
            }));

        } catch (error) {
            console.warn(`[FILE_DETECTION_SCANNER] Error analyzing content of ${filePath}:`, error.message);
            return [];
        }
    }

    /**
     * Determine if content represents an error page
     * @param {string} content - Response content
     * @param {number} statusCode - HTTP status code
     * @returns {boolean} True if it's likely an error page
     */
    isErrorPage(content, statusCode) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const errorIndicators = [
            '404',
            'not found',
            'page not found',
            'file not found',
            'error',
            '<title>404',
            '<title>Not Found',
            'nginx/',
            'apache/',
            'server error'
        ];

        const lowerContent = content.toLowerCase();
        return errorIndicators.some(indicator => lowerContent.includes(indicator));
    }

    /**
     * Determine if a file is a configuration file that should be analyzed
     * @param {string} filePath - File path
     * @returns {boolean} True if it's a configuration file
     */
    isConfigurationFile(filePath) {
        const configExtensions = ['.config', '.yml', '.yaml', '.json', '.js', '.py', '.php'];
        const configFiles = ['.env', '.env.local', '.env.production', '.env.development', 'config.js', 'config.json', 'settings.py', 'wp-config.php'];

        return configFiles.includes(filePath) ||
            configExtensions.some(ext => filePath.endsWith(ext)) ||
            filePath.startsWith('.env');
    }

    /**
     * Calculate confidence score for file detection
     * @param {string} filePath - File path
     * @param {string} content - File content
     * @param {Object} response - HTTP response object
     * @returns {number} Confidence score between 0 and 1
     */
    calculateFileConfidence(filePath, content, response) {
        let confidence = 0.7; // Base confidence

        // Higher confidence for specific file types
        const highConfidenceFiles = ['.env', '.git/config', 'config.js', '.htaccess'];
        if (highConfidenceFiles.includes(filePath)) {
            confidence += 0.2;
        }

        // Check content type header
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/') || contentType.includes('application/json')) {
            confidence += 0.1;
        }

        // Check content length (very small files might be empty or error pages)
        const contentLength = parseInt(response.headers['content-length'] || '0');
        if (contentLength > 10 && contentLength < 10000) {
            confidence += 0.1;
        } else if (contentLength === 0) {
            confidence -= 0.4; // Reduce confidence more for empty files
        }

        // Check for actual configuration content
        if (content && typeof content === 'string') {
            const configIndicators = ['=', ':', 'password', 'key', 'token', 'secret', 'api'];
            const hasConfigContent = configIndicators.some(indicator =>
                content.toLowerCase().includes(indicator)
            );
            if (hasConfigContent) {
                confidence += 0.15;
            }
        }

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Get severity level for different file types
     * @param {string} filePath - File path
     * @returns {string} Severity level
     */
    getFileSeverity(filePath) {
        const criticalFiles = [
            '.env', '.env.local', '.env.production',
            'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
            'private.key', 'server.key', 'credentials.json'
        ];

        const highFiles = [
            '.git/config', 'config.js', 'config.json',
            'database.yml', 'secrets.yml', 'wp-config.php',
            'settings.py', 'local_settings.py'
        ];

        const mediumFiles = [
            '.htaccess', 'web.config', 'app.config',
            '.DS_Store', 'cert.pem', 'certificate.crt'
        ];

        if (criticalFiles.includes(filePath)) return 'critical';
        if (highFiles.includes(filePath)) return 'high';
        if (mediumFiles.includes(filePath)) return 'medium';
        return 'low';
    }

    /**
     * Normalize URL for consistent processing
     * @param {string} url - Input URL
     * @returns {string} Normalized URL
     */
    normalizeUrl(url) {
        // Remove trailing slash
        let normalized = url.replace(/\/$/, '');

        // Add protocol if missing
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `https://${normalized}`;
        }

        return normalized;
    }

    /**
     * Validate if URL is properly formatted
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is valid
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get line number for a character index in content
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     */
    getLineNumber(content, index) {
        if (!content || index < 0) return 1;
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Get column number for a character index in content
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} Column number (1-based)
     */
    getColumnNumber(content, index) {
        if (!content || index < 0) return 1;
        const beforeIndex = content.substring(0, index);
        const lastNewlineIndex = beforeIndex.lastIndexOf('\n');
        return index - lastNewlineIndex;
    }

    /**
     * Check for directory listing vulnerabilities
     * @param {string} dirUrl - Full URL to the directory
     * @param {string} dirPath - Relative directory path
     * @returns {Object|null} Finding object if directory listing is exposed, null otherwise
     */
    async checkDirectoryListing(dirUrl, dirPath) {
        try {
            const response = await this.retryManager.executeWithRetry(async () => {
                return await this.httpClient.get(dirUrl);
            }, {
                context: `directory-listing-${dirPath}`,
                retryCondition: (error, attempt) => {
                    // Don't retry on 404 or other client errors
                    if (error.response && error.response.status >= 400 && error.response.status < 500) {
                        return false;
                    }
                    return this.retryManager.defaultRetryCondition(error, attempt);
                },
                onRetry: async (error, attempt, delay) => {
                    console.log(`🔄 Retrying directory listing check for ${dirPath} (attempt ${attempt + 1}) after ${delay}ms: ${error.message}`);
                }
            });

            // Check if directory is accessible (2xx status codes)
            if (response.status >= 200 && response.status < 300) {
                const content = response.data || '';
                const contentType = response.headers['content-type'] || '';

                // Skip if it's clearly a 404 page or error page
                if (this.isErrorPage(content, response.status)) {
                    return null;
                }

                // Check if content indicates directory listing
                if (this.isDirectoryListing(content, contentType)) {
                    return {
                        type: 'Directory Listing Vulnerability',
                        severity: this.getDirectorySeverity(dirPath),
                        confidence: this.calculateDirectoryConfidence(dirPath, content, response),
                        value: dirPath,
                        file: dirUrl,
                        context: {
                            before: 'Directory listing check',
                            after: `Directory listing exposed at ${dirUrl}`,
                            full: `Exposed directory: ${dirPath} with directory listing enabled`
                        },
                        pattern: {
                            id: `directory-listing-${dirPath.replace(/[^a-zA-Z0-9]/g, '-')}`,
                            category: 'vulnerabilities',
                            name: `Directory Listing: ${dirPath}`
                        },
                        metadata: {
                            url: dirUrl,
                            statusCode: response.status,
                            contentType,
                            contentLength: response.headers['content-length'] ? parseInt(response.headers['content-length']) : null,
                            listingType: this.getListingType(content, contentType)
                        }
                    };
                }
            }

            return null;

        } catch (error) {
            // Only log non-404 errors
            if (error.response?.status !== 404) {
                console.debug(`[FILE_DETECTION_SCANNER] Error accessing directory ${dirUrl}: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Check for exposed backup files
     * @param {string} baseUrl - Base URL to check
     * @returns {Array} Array of backup file findings
     */
    async checkBackupFiles(baseUrl) {
        const findings = [];
        const commonFiles = ['index', 'config', 'database', 'admin', 'login', 'app', 'main'];

        for (const fileName of commonFiles) {
            for (const extension of this.backupExtensions) {
                try {
                    const backupUrl = `${baseUrl}/${fileName}${extension}`;
                    const result = await this.checkFileAccessibility(backupUrl, `${fileName}${extension}`);

                    if (result) {
                        // Override the type and severity for backup files
                        result.type = 'Exposed Backup File';
                        result.severity = this.getBackupFileSeverity(fileName, extension);
                        result.pattern.category = 'vulnerabilities';
                        result.pattern.name = `Backup File: ${fileName}${extension}`;
                        findings.push(result);
                    }

                    // Small delay to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 50));

                } catch (error) {
                    console.debug(`[FILE_DETECTION_SCANNER] Error checking backup file ${fileName}${extension}: ${error.message}`);
                }
            }
        }

        return findings;
    }

    /**
     * Determine if content represents a directory listing
     * @param {string} content - Response content
     * @param {string} contentType - Content type header
     * @returns {boolean} True if it's a directory listing
     */
    isDirectoryListing(content, contentType) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        // Check content type indicators
        if (contentType.includes('text/html')) {
            // HTML directory listing indicators
            const htmlIndicators = [
                '<title>Index of',
                '<h1>Index of',
                'Directory Listing',
                'Parent Directory',
                '<a href="../">',
                'Last modified',
                'Size</th>',
                'Name</th>',
                '<pre><a href="../">../</a>',
                'Apache/.*Server at.*Port'
            ];

            const lowerContent = content.toLowerCase();
            if (htmlIndicators.some(indicator => {
                if (indicator.includes('.*')) {
                    // Handle regex patterns
                    const regex = new RegExp(indicator, 'i');
                    return regex.test(content);
                }
                return lowerContent.includes(indicator.toLowerCase());
            })) {
                return true;
            }
        }

        // Check for JSON directory listing (some APIs)
        if (contentType.includes('application/json')) {
            try {
                const jsonData = JSON.parse(content);
                if (Array.isArray(jsonData) && jsonData.length > 0) {
                    // Check if it looks like a file listing
                    const firstItem = jsonData[0];
                    if (typeof firstItem === 'object' &&
                        (firstItem.name || firstItem.filename || firstItem.path)) {
                        return true;
                    }
                }
            } catch (error) {
                // Not valid JSON, continue with other checks
            }
        }

        // Check for plain text directory listing
        if (contentType.includes('text/plain')) {
            const lines = content.split('\n');
            if (lines.length > 2) {
                // Look for file listing patterns
                const filePatterns = [
                    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+/,  // Date/time format
                    /^-rw-r--r--/,  // Unix permissions
                    /^\d+\s+\w+\s+\d+/,  // Size, month, day format
                ];

                const matchingLines = lines.filter(line =>
                    filePatterns.some(pattern => pattern.test(line.trim()))
                );

                if (matchingLines.length >= 2) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get severity level for different directory types
     * @param {string} dirPath - Directory path
     * @returns {string} Severity level
     */
    getDirectorySeverity(dirPath) {
        const criticalDirs = ['.git', '.svn', 'admin', 'private', 'secret', 'secrets', 'keys', 'certs'];
        const highDirs = ['backup', 'backups', 'config', 'configs', 'database', 'db', 'sql'];
        const mediumDirs = ['logs', 'log', 'temp', 'tmp', 'uploads', 'files', 'data'];

        if (criticalDirs.includes(dirPath)) return 'critical';
        if (highDirs.includes(dirPath)) return 'high';
        if (mediumDirs.includes(dirPath)) return 'medium';
        return 'low';
    }

    /**
     * Get severity level for backup files
     * @param {string} fileName - Base file name
     * @param {string} extension - Backup extension
     * @returns {string} Severity level
     */
    getBackupFileSeverity(fileName, extension) {
        const criticalFiles = ['config', 'database', 'admin', 'login'];
        const highFiles = ['index', 'app', 'main'];

        if (criticalFiles.includes(fileName)) return 'high';
        if (highFiles.includes(fileName)) return 'medium';
        return 'low';
    }

    /**
     * Calculate confidence score for directory listing detection
     * @param {string} dirPath - Directory path
     * @param {string} content - Response content
     * @param {Object} response - HTTP response object
     * @returns {number} Confidence score between 0 and 1
     */
    calculateDirectoryConfidence(dirPath, content, response) {
        let confidence = 0.6; // Base confidence

        const contentType = response.headers['content-type'] || '';

        // Higher confidence for HTML directory listings
        if (contentType.includes('text/html')) {
            if (content.includes('<title>Index of') || content.includes('<h1>Index of')) {
                confidence += 0.3;
            }
            if (content.includes('Parent Directory') || content.includes('<a href="../">')) {
                confidence += 0.2;
            }
        }

        // Higher confidence for sensitive directories
        const sensitiveDirs = ['.git', '.svn', 'admin', 'backup', 'config'];
        if (sensitiveDirs.includes(dirPath)) {
            confidence += 0.1;
        }

        // Check content length (very small responses might be error pages)
        const contentLength = parseInt(response.headers['content-length'] || '0');
        if (contentLength > 100) {
            confidence += 0.1;
        }

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Determine the type of directory listing
     * @param {string} content - Response content
     * @param {string} contentType - Content type header
     * @returns {string} Listing type
     */
    getListingType(content, contentType) {
        if (contentType.includes('text/html')) {
            if (content.includes('Apache/')) return 'Apache';
            if (content.includes('nginx/')) return 'Nginx';
            if (content.includes('Microsoft-IIS/')) return 'IIS';
            return 'HTML';
        }
        if (contentType.includes('application/json')) return 'JSON';
        if (contentType.includes('text/plain')) return 'Plain Text';
        return 'Unknown';
    }
}

module.exports = new FileDetectionScanner();