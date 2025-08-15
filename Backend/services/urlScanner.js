/**
 * URL Scanner - Scans web pages for secrets and vulnerabilities
 * Integrates with enhanced pattern engine for improved detection
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { EnhancedPatternEngine } = require('../utils/enhancedPatternEngine');
const { allPatterns } = require('../utils/enhancedPatternDefinitions');

class URLScanner {
    constructor() {
        this.patternEngine = new EnhancedPatternEngine();
        this.patternEngine.registerPatterns(allPatterns);
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.timeout = 60000; // 60 seconds
    }

    /**
     * Scan a URL target for security issues
     * @param {Object} target - Target configuration
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Array of findings
     */
    async scan(target, options = {}) {
        const { value: url } = target;
        const {
            maxDepth = 3,
            timeout = this.timeout,
            confidenceThreshold = 0.5,
            onProgress
        } = options;

        console.log(`[URL_SCANNER] Using timeout: ${timeout}ms`);

        const findings = [];
        let progress = 0;

        try {
            // Update progress
            if (onProgress) onProgress(10);

            // Fetch main HTML page
            console.log(`[URL_SCANNER] Fetching: ${url}`);
            const htmlResponse = await axios.get(url, {
                timeout,
                maxContentLength: this.maxFileSize,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/2.0; +https://threatpeek.com)'
                }
            });

            if (!htmlResponse.headers["content-type"]?.includes("text/html")) {
                throw new Error("URL does not return HTML content");
            }

            const html = htmlResponse.data;
            progress = 30;
            if (onProgress) onProgress(progress);

            // Scan HTML content
            console.log(`[URL_SCANNER] Scanning HTML content...`);
            const htmlFindings = this.scanContent(html, 'HTML Content', {
                confidenceThreshold
            });
            findings.push(...htmlFindings);

            progress = 50;
            if (onProgress) onProgress(progress);

            // Extract and scan JavaScript files
            console.log(`[URL_SCANNER] Extracting JavaScript files...`);
            const jsFiles = this.extractJSFiles(html, url);
            const filteredJsFiles = jsFiles.filter(file => !this.isCDNUrl(file));

            console.log(`[URL_SCANNER] Found ${jsFiles.length} JS files (${filteredJsFiles.length} after filtering)`);

            // Scan each JS file
            const totalFiles = filteredJsFiles.length;
            for (let i = 0; i < filteredJsFiles.length; i++) {
                const jsUrl = filteredJsFiles[i];

                try {
                    const jsFindings = await this.scanJSFile(jsUrl, {
                        timeout,
                        confidenceThreshold
                    });
                    findings.push(...jsFindings);

                    // Update progress
                    progress = 50 + ((i + 1) / totalFiles) * 40;
                    if (onProgress) onProgress(Math.round(progress));

                } catch (error) {
                    console.log(`[URL_SCANNER] Failed to scan ${jsUrl}: ${error.message}`);
                }
            }

            progress = 100;
            if (onProgress) onProgress(progress);

            console.log(`[URL_SCANNER] Completed scan of ${url}, found ${findings.length} potential issues`);
            return findings;

        } catch (error) {
            console.error(`[URL_SCANNER] Error scanning ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Scan content using pattern engine
     * @param {string} content - Content to scan
     * @param {string} source - Source identifier
     * @param {Object} options - Scan options
     * @returns {Array} Array of findings
     */
    scanContent(content, source, options = {}) {
        const { confidenceThreshold = 0.5 } = options;

        const matches = this.patternEngine.scanContent(content, {
            confidenceThreshold,
            maxMatches: 50
        });

        return matches.map(match => ({
            type: match.pattern.name,
            severity: match.pattern.severity,
            confidence: match.confidence,
            value: match.value,
            file: source,
            context: {
                before: match.context.before,
                after: match.context.after
            },
            location: {
                index: match.index,
                length: match.length
            },
            pattern: {
                id: match.pattern.id,
                category: match.pattern.category
            }
        }));
    }

    /**
     * Extract JavaScript file URLs from HTML
     * @param {string} html - HTML content
     * @param {string} baseUrl - Base URL for resolving relative paths
     * @returns {Array} Array of JS file URLs
     */
    extractJSFiles(html, baseUrl) {
        const $ = cheerio.load(html);
        const jsFiles = new Set();

        $("script[src]").each((_, el) => {
            let src = $(el).attr("src");

            // Skip data URLs and inline scripts
            if (src.startsWith('data:') || src.startsWith('javascript:')) {
                return;
            }

            // Handle relative URLs
            if (!src.startsWith('http')) {
                if (src.startsWith('//')) {
                    src = new URL(src, baseUrl).href;
                } else if (src.startsWith('/')) {
                    src = new URL(src, baseUrl).href;
                } else {
                    src = new URL(src, baseUrl).href;
                }
            }

            // Skip if should be excluded
            if (!this.shouldExcludeUrl(src)) {
                jsFiles.add(src);
            }
        });

        return Array.from(jsFiles);
    }

    /**
     * Scan a JavaScript file
     * @param {string} url - JS file URL
     * @param {Object} options - Scan options
     * @returns {Promise<Array>} Array of findings
     */
    async scanJSFile(url, options = {}) {
        const { timeout = this.timeout, confidenceThreshold = 0.5 } = options;

        try {
            console.log(`[URL_SCANNER] Scanning JS file: ${url}`);

            const response = await axios.get(url, {
                timeout,
                maxContentLength: this.maxFileSize,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ThreatPeek/2.0; +https://threatpeek.com)'
                }
            });

            const contentType = response.headers["content-type"] || "";
            if (!contentType.includes("javascript") && !contentType.includes("text/plain")) {
                console.log(`[URL_SCANNER] Skipping non-JS content: ${url}`);
                return [];
            }

            const content = response.data;
            if (content.length > this.maxFileSize) {
                console.log(`[URL_SCANNER] Skipping large file: ${url} (${content.length} bytes)`);
                return [];
            }

            return this.scanContent(content, url, { confidenceThreshold });

        } catch (error) {
            console.log(`[URL_SCANNER] Error scanning JS file ${url}: ${error.message}`);
            return [];
        }
    }

    /**
     * Check if URL should be excluded from scanning
     * @param {string} url - URL to check
     * @returns {boolean} True if should be excluded
     */
    shouldExcludeUrl(url) {
        const excludePatterns = [
            /node_modules\//i,
            /vendor\//i,
            /\.min\.js$/i,
            /bundle\./i,
            /chunk\./i,
            /[a-f0-9]{8,}\.(js|css)$/i,
            /^(d3-|codemirror-|monaco-|ace-)/i,
            /vendors-node_modules/i,
            /_[a-f0-9]{8,}\./i,
            /\.production\.min\./i
        ];

        return excludePatterns.some(pattern => pattern.test(url));
    }

    /**
     * Check if URL is from a CDN
     * @param {string} url - URL to check
     * @returns {boolean} True if from CDN
     */
    isCDNUrl(url) {
        const cdnDomains = [
            'cdn.jsdelivr.net',
            'unpkg.com',
            'cdnjs.cloudflare.com',
            'ajax.googleapis.com',
            'gstatic.com',
            'googleapis.com',
            'cloudflare.com'
        ];

        try {
            const urlObj = new URL(url);
            return cdnDomains.some(domain => urlObj.hostname.includes(domain));
        } catch (err) {
            return false;
        }
    }
}

module.exports = new URLScanner();