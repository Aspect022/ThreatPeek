/**
 * Deduplication Engine - Core deduplication system for security scan findings
 * Implements multi-level deduplication with fingerprint generation and memory-efficient caching
 */

const crypto = require('crypto');
const path = require('path');

class DeduplicationEngine {
    constructor(options = {}) {
        // Configuration options
        this.options = {
            enableFileLevel: true,
            enableScanLevel: true,
            preserveContext: true,
            maxCacheSize: 10000,
            includeLocationInFingerprint: false,
            ...options
        };

        // Deduplication state
        this.fingerprintCache = new Map();
        this.deduplicatedFindings = new Map();
        this.statistics = {
            totalFindings: 0,
            duplicatesRemoved: 0,
            uniqueFindings: 0,
            deduplicationTime: 0,
            memoryUsage: 0
        };

        // LRU cache implementation for memory management
        this.cacheAccessOrder = [];
    }

    /**
     * Generate unique fingerprint for a finding
     * @param {Object} finding - Finding object to fingerprint
     * @param {boolean} includeLocation - Whether to include location in fingerprint
     * @returns {string} SHA-256 hash fingerprint
     */
    generateFingerprint(finding, includeLocation = false) {
        try {
            // Handle null/undefined findings
            if (!finding) {
                return crypto.createHash('sha256').update('null-finding').digest('hex');
            }

            // Normalize file path (convert to forward slashes, remove leading ./)
            const normalizedFilePath = this.normalizeFilePath(finding.file || '');

            // Normalize matched value (trim whitespace, normalize line endings)
            const normalizedValue = this.normalizeValue(finding.value || '');

            // Create fingerprint components
            const components = [
                finding.pattern?.id || finding.type || 'unknown',
                normalizedFilePath,
                normalizedValue
            ];

            // Optionally include location for exact duplicate detection
            if (includeLocation || this.options.includeLocationInFingerprint) {
                const location = finding.location || {};
                components.push(`${location.line || 0}:${location.column || 0}`);
            }

            // Generate SHA-256 hash
            const fingerprintData = components.join('|');
            return crypto.createHash('sha256').update(fingerprintData).digest('hex');
        } catch (error) {
            console.warn('[DEDUPLICATION] Error generating fingerprint:', error.message);
            // Fallback fingerprint - handle null finding safely
            const safeType = (finding && finding.type) || 'unknown';
            const safeFile = (finding && finding.file) || '';
            const safeValue = (finding && finding.value) || '';
            return crypto.createHash('sha256')
                .update(`${safeType}|${safeFile}|${safeValue}`)
                .digest('hex');
        }
    }

    /**
     * Normalize file path for consistent fingerprinting
     * @param {string} filePath - File path to normalize
     * @returns {string} Normalized file path
     */
    normalizeFilePath(filePath) {
        if (!filePath) return '';

        // Convert to forward slashes and remove leading ./
        return path.normalize(filePath)
            .replace(/\\/g, '/')
            .replace(/^\.\//, '')
            .toLowerCase();
    }

    /**
     * Normalize matched value for consistent fingerprinting
     * @param {string} value - Value to normalize
     * @returns {string} Normalized value
     */
    normalizeValue(value) {
        if (!value) return '';

        // Trim whitespace and normalize line endings
        return value.trim()
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
    }

    /**
     * Deduplicate findings within a single file
     * @param {Array} findings - Array of findings from a single file
     * @param {string} filePath - Path of the file being processed
     * @returns {Array} Deduplicated findings
     */
    deduplicateFileFindings(findings, filePath) {
        if (!this.options.enableFileLevel || !findings || findings.length === 0) {
            return findings;
        }

        const startTime = Date.now();
        const fileFingerprints = new Map();
        const fingerprintToIndex = new Map();

        for (const finding of findings) {
            // Skip null/undefined findings
            if (!finding) {
                continue;
            }

            const fingerprint = this.generateFingerprint(finding, false);

            if (fileFingerprints.has(fingerprint)) {
                // Merge with existing finding
                const existingFinding = fileFingerprints.get(fingerprint);
                const mergedFinding = this.mergeFindings(existingFinding, finding);
                fileFingerprints.set(fingerprint, mergedFinding);
                this.statistics.duplicatesRemoved++;
            } else {
                // New unique finding
                const enhancedFinding = this.enhanceFinding(finding);
                if (enhancedFinding) {
                    fileFingerprints.set(fingerprint, enhancedFinding);
                    // Add to cache for tracking
                    this.manageCacheSize(fingerprint);
                }
            }
        }

        // Convert map to array
        const deduplicatedFindings = Array.from(fileFingerprints.values());

        // Update statistics
        this.statistics.totalFindings += findings.length;
        this.statistics.uniqueFindings += deduplicatedFindings.length;
        this.statistics.deduplicationTime += Date.now() - startTime;

        return deduplicatedFindings;
    }

    /**
     * Deduplicate findings across entire scan
     * @param {Array} allFindings - Array of all findings from scan
     * @returns {Array} Deduplicated findings
     */
    deduplicateScanFindings(allFindings) {
        if (!this.options.enableScanLevel || !allFindings || allFindings.length === 0) {
            return allFindings;
        }

        const startTime = Date.now();
        const scanFingerprints = new Map();

        for (const finding of allFindings) {
            // Skip null/undefined findings
            if (!finding) {
                continue;
            }

            const fingerprint = this.generateFingerprint(finding, false);

            if (scanFingerprints.has(fingerprint)) {
                // Merge with existing finding
                const existingFinding = scanFingerprints.get(fingerprint);
                const mergedFinding = this.mergeFindings(existingFinding, finding);
                scanFingerprints.set(fingerprint, mergedFinding);
                this.statistics.duplicatesRemoved++;
            } else {
                // New unique finding
                const enhancedFinding = this.enhanceFinding(finding);
                if (enhancedFinding) {
                    scanFingerprints.set(fingerprint, enhancedFinding);
                    // Manage cache size
                    this.manageCacheSize(fingerprint);
                }
            }
        }

        // Convert map to array
        const deduplicatedFindings = Array.from(scanFingerprints.values());

        // Update statistics
        this.statistics.totalFindings += allFindings.length;
        this.statistics.uniqueFindings += deduplicatedFindings.length;
        this.statistics.deduplicationTime += Date.now() - startTime;

        return deduplicatedFindings;
    }

    /**
     * Merge duplicate findings preserving important data
     * @param {Object} existingFinding - Existing finding
     * @param {Object} newFinding - New finding to merge
     * @returns {Object} Merged finding
     */
    mergeFindings(existingFinding, newFinding) {
        // Preserve highest confidence score
        const highestConfidence = Math.max(
            existingFinding.confidence || 0,
            newFinding.confidence || 0
        );

        // Preserve most severe severity level
        const mostSevereSeverity = this.getMostSevereSeverity(
            existingFinding.severity,
            newFinding.severity
        );

        // Increment occurrence count
        const occurrenceCount = (existingFinding.occurrenceCount || 1) + 1;

        // Merge locations if preserving context
        const locations = this.options.preserveContext ?
            this.mergeLocations(existingFinding, newFinding) :
            [existingFinding.location || {}];

        // Update timestamps
        const now = Date.now();
        const firstSeen = existingFinding.firstSeen || now;
        const lastSeen = now;

        return {
            ...existingFinding,
            confidence: highestConfidence,
            severity: mostSevereSeverity,
            occurrenceCount,
            locations,
            highestConfidence,
            mostSevereSeverity,
            firstSeen,
            lastSeen,
            // Preserve original finding data
            originalValue: existingFinding.originalValue || existingFinding.value,
            // Add deduplication metadata
            deduplicationMetadata: {
                fingerprint: this.generateFingerprint(existingFinding),
                mergedAt: now,
                duplicateCount: occurrenceCount - 1
            }
        };
    }

    /**
     * Enhance finding with deduplication metadata
     * @param {Object} finding - Finding to enhance
     * @returns {Object} Enhanced finding
     */
    enhanceFinding(finding) {
        // Handle null/undefined findings
        if (!finding) {
            return null;
        }

        const now = Date.now();
        return {
            ...finding,
            occurrenceCount: 1,
            locations: this.options.preserveContext ?
                [finding.location || {}] :
                undefined,
            highestConfidence: finding.confidence || 0,
            mostSevereSeverity: finding.severity || 'medium',
            firstSeen: now,
            lastSeen: now,
            originalValue: finding.value,
            deduplicationMetadata: {
                fingerprint: this.generateFingerprint(finding),
                createdAt: now,
                duplicateCount: 0
            }
        };
    }

    /**
     * Merge location information from findings
     * @param {Object} existingFinding - Existing finding
     * @param {Object} newFinding - New finding
     * @returns {Array} Merged locations
     */
    mergeLocations(existingFinding, newFinding) {
        const existingLocations = existingFinding.locations || [existingFinding.location || {}];
        const newLocation = newFinding.location || {};

        // Check if location already exists
        const locationExists = existingLocations.some(loc =>
            loc.file === newLocation.file &&
            loc.line === newLocation.line &&
            loc.column === newLocation.column
        );

        if (!locationExists && newLocation.file) {
            existingLocations.push({
                file: newLocation.file,
                line: newLocation.line,
                column: newLocation.column,
                context: newFinding.context
            });
        }

        return existingLocations;
    }

    /**
     * Determine most severe severity level
     * @param {string} severity1 - First severity level
     * @param {string} severity2 - Second severity level
     * @returns {string} Most severe severity level
     */
    getMostSevereSeverity(severity1, severity2) {
        const severityOrder = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1,
            'info': 0
        };

        const level1 = severityOrder[severity1?.toLowerCase()] ?? 2;
        const level2 = severityOrder[severity2?.toLowerCase()] ?? 2;

        const maxLevel = Math.max(level1, level2);
        return Object.keys(severityOrder).find(key => severityOrder[key] === maxLevel) || 'medium';
    }

    /**
     * Manage cache size using LRU eviction
     * @param {string} fingerprint - Fingerprint being accessed
     */
    manageCacheSize(fingerprint) {
        // Add to fingerprint cache for tracking
        this.fingerprintCache.set(fingerprint, true);

        // Update access order
        const existingIndex = this.cacheAccessOrder.indexOf(fingerprint);
        if (existingIndex !== -1) {
            this.cacheAccessOrder.splice(existingIndex, 1);
        }
        this.cacheAccessOrder.push(fingerprint);

        // Evict oldest entries if cache is too large
        while (this.fingerprintCache.size > this.options.maxCacheSize) {
            const oldestFingerprint = this.cacheAccessOrder.shift();
            if (oldestFingerprint) {
                this.fingerprintCache.delete(oldestFingerprint);
                this.deduplicatedFindings.delete(oldestFingerprint);
            }
        }
    }

    /**
     * Get deduplication statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        return {
            ...this.statistics,
            memoryUsage: this.getMemoryUsage(),
            cacheSize: this.fingerprintCache.size,
            deduplicationRate: this.statistics.totalFindings > 0 ?
                (this.statistics.duplicatesRemoved / this.statistics.totalFindings) : 0
        };
    }

    /**
     * Estimate memory usage of deduplication engine
     * @returns {number} Estimated memory usage in bytes
     */
    getMemoryUsage() {
        // Rough estimation of memory usage
        const fingerprintCacheSize = this.fingerprintCache.size * 64; // 64 bytes per fingerprint
        const findingsCacheSize = this.deduplicatedFindings.size * 1024; // ~1KB per finding
        const accessOrderSize = this.cacheAccessOrder.length * 64;

        return fingerprintCacheSize + findingsCacheSize + accessOrderSize;
    }

    /**
     * Clear all deduplication state
     */
    clearState() {
        this.fingerprintCache.clear();
        this.deduplicatedFindings.clear();
        this.cacheAccessOrder = [];
        this.statistics = {
            totalFindings: 0,
            duplicatesRemoved: 0,
            uniqueFindings: 0,
            deduplicationTime: 0,
            memoryUsage: 0
        };
    }

    /**
     * Reset statistics while preserving cache
     */
    resetStatistics() {
        this.statistics = {
            totalFindings: 0,
            duplicatesRemoved: 0,
            uniqueFindings: 0,
            deduplicationTime: 0,
            memoryUsage: 0
        };
    }
}

module.exports = { DeduplicationEngine };