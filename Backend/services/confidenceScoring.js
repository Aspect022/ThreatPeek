/**
 * Confidence Scoring System - Advanced confidence calculation and false positive reduction
 * Provides context-aware confidence scoring and learning mechanisms
 */

class ConfidenceScoring {
    constructor(options = {}) {
        this.baseConfidence = options.baseConfidence || 0.5;
        this.contextWeights = {
            assignment: 0.15,
            environment: 0.2,
            configuration: 0.1,
            falsePositive: -0.3,
            comment: -0.2,
            entropy: 0.1,
            validation: 0.15,
            length: 0.05
        };

        // Learning data for false positive reduction
        this.falsePositivePatterns = new Set();
        this.truePosistivePatterns = new Set();
        this.feedbackData = new Map();

        // Initialize with common false positive patterns
        this.initializeFalsePositivePatterns();
    }

    /**
     * Calculate comprehensive confidence score for a finding
     * @param {Object} finding - Finding object with match data
     * @param {Object} pattern - Pattern definition
     * @param {Object} context - Additional context information
     * @returns {number} Confidence score between 0 and 1
     */
    calculateConfidence(finding, pattern, context = {}) {
        let confidence = pattern.confidence || this.baseConfidence;

        // Apply context-based adjustments
        confidence = this.applyContextAnalysis(confidence, finding, pattern);

        // Apply entropy-based scoring
        confidence = this.applyEntropyScoring(confidence, finding);

        // Apply validation-based scoring
        confidence = this.applyValidationScoring(confidence, finding, pattern);

        // Apply length-based scoring
        confidence = this.applyLengthScoring(confidence, finding, pattern);

        // Apply false positive learning
        confidence = this.applyFalsePositiveLearning(confidence, finding, pattern);

        // Apply pattern-specific adjustments
        confidence = this.applyPatternSpecificAdjustments(confidence, finding, pattern);

        // Ensure confidence stays within bounds
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Apply context analysis to confidence score
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    applyContextAnalysis(baseConfidence, finding, pattern) {
        let confidence = baseConfidence;
        const context = finding.context || {};
        const before = context.before || '';
        const after = context.after || '';

        // Variable assignment patterns (positive indicators)
        const assignmentPatterns = [
            /(?:const|let|var)\s+\w+\s*=\s*$/,
            /\w+\s*[:=]\s*$/,
            /['"`]\s*$/,
            /process\.env\.\w+\s*=\s*$/,
            /config\[\s*['"`]\w+['"`]\s*\]\s*=\s*$/
        ];

        if (assignmentPatterns.some(p => p.test(before))) {
            confidence += this.contextWeights.assignment;
        }

        // Environment variable patterns (strong positive indicators)
        const envPatterns = [
            /process\.env\./,
            /process\.env\[/,
            /ENV\[/,
            /getenv\(/,
            /os\.environ/,
            /System\.getenv/
        ];

        if (envPatterns.some(p => p.test(before))) {
            confidence += this.contextWeights.environment;
        }

        // Configuration object patterns (positive indicators)
        const configPatterns = [
            /config\./,
            /settings\./,
            /options\./,
            /credentials\./,
            /auth\./,
            /api\./
        ];

        if (configPatterns.some(p => p.test(before))) {
            confidence += this.contextWeights.configuration;
        }

        // False positive context patterns (negative indicators)
        const falsePositiveContexts = [
            /example/i,
            /placeholder/i,
            /test/i,
            /demo/i,
            /sample/i,
            /mock/i,
            /fake/i,
            /dummy/i,
            /your_key_here/i,
            /replace_with/i,
            /insert_your/i,
            /add_your/i
        ];

        if (falsePositiveContexts.some(p => p.test(before) || p.test(after))) {
            confidence += this.contextWeights.falsePositive;
        }

        // Comment context patterns (negative indicators)
        const commentPatterns = [
            /\/\*[\s\S]*$/,
            /\/\/.*$/,
            /<!--[\s\S]*$/,
            /#.*$/,
            /\*.*$/,
            /\/\*\*[\s\S]*$/
        ];

        if (commentPatterns.some(p => p.test(before))) {
            confidence += this.contextWeights.comment;
        }

        return confidence;
    }

    /**
     * Apply entropy-based scoring
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @returns {number} Adjusted confidence score
     */
    applyEntropyScoring(baseConfidence, finding) {
        const value = finding.value || '';
        const entropy = this.calculateEntropy(value);

        let adjustment = 0;

        // High entropy indicates more randomness (likely real secrets)
        if (entropy > 4.0) {
            adjustment = this.contextWeights.entropy * 1.5;
        } else if (entropy > 3.5) {
            adjustment = this.contextWeights.entropy;
        } else if (entropy < 2.0) {
            adjustment = this.contextWeights.entropy * -2;
        } else if (entropy < 2.5) {
            adjustment = this.contextWeights.entropy * -1;
        }

        return baseConfidence + adjustment;
    }

    /**
     * Apply validation-based scoring
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    applyValidationScoring(baseConfidence, finding, pattern) {
        let confidence = baseConfidence;

        // Apply pattern validator if available
        if (pattern.validator && typeof pattern.validator === 'function') {
            try {
                const isValid = pattern.validator(finding.value);
                if (isValid) {
                    confidence += this.contextWeights.validation;
                } else {
                    confidence += this.contextWeights.validation * -1;
                }
            } catch (error) {
                // Validator error - slight confidence reduction
                confidence += this.contextWeights.validation * -0.5;
            }
        }

        // Apply format-specific validation
        confidence = this.applyFormatValidation(confidence, finding, pattern);

        return confidence;
    }

    /**
     * Apply format-specific validation
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    applyFormatValidation(baseConfidence, finding, pattern) {
        const value = finding.value || '';
        let confidence = baseConfidence;

        // Check for common secret formats
        const formatChecks = {
            // Base64 encoded (common for secrets)
            base64: /^[A-Za-z0-9+/]{20,}={0,2}$/,
            // Hex encoded
            hex: /^[a-fA-F0-9]{20,}$/,
            // UUID format
            uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            // JWT token format
            jwt: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/
        };

        // Positive format indicators
        if (formatChecks.base64.test(value) && value.length >= 20) {
            confidence += 0.1;
        }

        if (formatChecks.hex.test(value) && value.length >= 32) {
            confidence += 0.08;
        }

        if (formatChecks.uuid.test(value)) {
            confidence += 0.05;
        }

        if (formatChecks.jwt.test(value)) {
            confidence += 0.15;
        }

        // Check for obvious non-secrets
        const nonSecretPatterns = [
            /^(true|false)$/i,
            /^(yes|no)$/i,
            /^(on|off)$/i,
            /^(enabled|disabled)$/i,
            /^\d+$/,
            /^(http|https):\/\//i,
            /^[a-zA-Z]+$/
        ];

        if (nonSecretPatterns.some(p => p.test(value))) {
            confidence -= 0.2;
        }

        return confidence;
    }

    /**
     * Apply length-based scoring
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    applyLengthScoring(baseConfidence, finding, pattern) {
        const value = finding.value || '';
        const length = value.length;
        let adjustment = 0;

        // Check against pattern's expected length
        if (pattern.minLength && length >= pattern.minLength) {
            adjustment += this.contextWeights.length;
        }

        if (pattern.maxLength && length <= pattern.maxLength) {
            adjustment += this.contextWeights.length * 0.5;
        }

        // General length-based scoring
        if (length >= 32) {
            adjustment += this.contextWeights.length;
        } else if (length >= 20) {
            adjustment += this.contextWeights.length * 0.5;
        } else if (length < 8) {
            adjustment -= this.contextWeights.length;
        }

        return baseConfidence + adjustment;
    }

    /**
     * Apply false positive learning
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    applyFalsePositiveLearning(baseConfidence, finding, pattern) {
        const value = finding.value || '';
        const fingerprint = this.generateFindingFingerprint(finding, pattern);

        // Check against known false positives
        if (this.falsePositivePatterns.has(value) || this.falsePositivePatterns.has(fingerprint)) {
            return baseConfidence * 0.3; // Significant reduction for known false positives
        }

        // Check against known true positives
        if (this.truePosistivePatterns.has(value) || this.truePosistivePatterns.has(fingerprint)) {
            return Math.min(1, baseConfidence * 1.2); // Boost for known true positives
        }

        // Check feedback data
        const feedbackKey = `${pattern.id}:${value}`;
        if (this.feedbackData.has(feedbackKey)) {
            const feedback = this.feedbackData.get(feedbackKey);
            const adjustment = feedback.isFalsePositive ? -0.3 : 0.2;
            return baseConfidence + adjustment;
        }

        return baseConfidence;
    }

    /**
     * Apply pattern-specific adjustments
     * @param {number} baseConfidence - Base confidence score
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    applyPatternSpecificAdjustments(baseConfidence, finding, pattern) {
        let confidence = baseConfidence;

        // Pattern category adjustments
        switch (pattern.category) {
            case 'secrets':
                // Secrets generally have higher confidence requirements
                if (confidence < 0.6) {
                    confidence *= 0.8;
                }
                break;

            case 'configurations':
                // Configuration issues can be more lenient
                confidence *= 1.1;
                break;

            case 'vulnerabilities':
                // Vulnerabilities need careful validation
                if (confidence < 0.7) {
                    confidence *= 0.9;
                }
                break;
        }

        // Severity-based adjustments
        switch (pattern.severity) {
            case 'critical':
                // Critical findings need high confidence
                if (confidence < 0.8) {
                    confidence *= 0.7;
                }
                break;

            case 'low':
                // Low severity can be more permissive
                confidence *= 1.1;
                break;
        }

        return confidence;
    }

    /**
     * Calculate Shannon entropy of a string
     * @param {string} str - String to analyze
     * @returns {number} Entropy value
     */
    calculateEntropy(str) {
        if (!str || str.length === 0) return 0;

        const freq = {};
        for (const char of str) {
            freq[char] = (freq[char] || 0) + 1;
        }

        let entropy = 0;
        const length = str.length;

        for (const count of Object.values(freq)) {
            const p = count / length;
            entropy -= p * Math.log2(p);
        }

        return entropy;
    }

    /**
     * Generate fingerprint for a finding
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @returns {string} Finding fingerprint
     */
    generateFindingFingerprint(finding, pattern) {
        const crypto = require('crypto');
        const data = [
            pattern.id,
            finding.value || '',
            finding.file || '',
            finding.context?.before?.substring(0, 50) || ''
        ].join('|');

        return crypto.createHash('md5').update(data).digest('hex');
    }

    /**
     * Record user feedback for learning
     * @param {Object} finding - Finding object
     * @param {Object} pattern - Pattern definition
     * @param {boolean} isFalsePositive - Whether the finding is a false positive
     * @param {Object} metadata - Additional feedback metadata
     */
    recordFeedback(finding, pattern, isFalsePositive, metadata = {}) {
        const feedbackKey = `${pattern.id}:${finding.value}`;
        const fingerprint = this.generateFindingFingerprint(finding, pattern);

        // Store feedback data
        this.feedbackData.set(feedbackKey, {
            isFalsePositive,
            timestamp: new Date(),
            metadata,
            fingerprint
        });

        // Update pattern sets
        if (isFalsePositive) {
            this.falsePositivePatterns.add(finding.value);
            this.falsePositivePatterns.add(fingerprint);
        } else {
            this.truePosistivePatterns.add(finding.value);
            this.truePosistivePatterns.add(fingerprint);
        }

        console.log(`📝 Recorded feedback: ${feedbackKey} -> ${isFalsePositive ? 'False Positive' : 'True Positive'}`);
    }

    /**
     * Initialize common false positive patterns
     */
    initializeFalsePositivePatterns() {
        const commonFalsePositives = [
            // Common placeholder values
            'your_api_key_here',
            'your_secret_key',
            'replace_with_your_key',
            'insert_your_key_here',
            'add_your_api_key',
            'your_token_here',

            // Test/example values
            'test_key_123',
            'example_secret',
            'demo_token',
            'sample_api_key',
            'mock_secret_key',
            'fake_token_123',

            // Common non-secrets
            'localhost',
            'example.com',
            'test.com',
            'development',
            'production',
            'staging',

            // Default/empty values
            'null',
            'undefined',
            'empty',
            'none',
            'default',
            ''
        ];

        commonFalsePositives.forEach(pattern => {
            this.falsePositivePatterns.add(pattern);
        });
    }

    /**
     * Get confidence statistics
     * @returns {Object} Confidence scoring statistics
     */
    getStatistics() {
        return {
            falsePositivePatterns: this.falsePositivePatterns.size,
            truePositivePatterns: this.truePosistivePatterns.size,
            feedbackEntries: this.feedbackData.size,
            contextWeights: this.contextWeights,
            baseConfidence: this.baseConfidence
        };
    }

    /**
     * Export learning data for persistence
     * @returns {Object} Serializable learning data
     */
    exportLearningData() {
        return {
            falsePositivePatterns: Array.from(this.falsePositivePatterns),
            truePositivePatterns: Array.from(this.truePosistivePatterns),
            feedbackData: Array.from(this.feedbackData.entries()),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import learning data from persistence
     * @param {Object} learningData - Previously exported learning data
     */
    importLearningData(learningData) {
        if (learningData.falsePositivePatterns) {
            learningData.falsePositivePatterns.forEach(pattern => {
                this.falsePositivePatterns.add(pattern);
            });
        }

        if (learningData.truePositivePatterns) {
            learningData.truePositivePatterns.forEach(pattern => {
                this.truePosistivePatterns.add(pattern);
            });
        }

        if (learningData.feedbackData) {
            learningData.feedbackData.forEach(([key, value]) => {
                this.feedbackData.set(key, value);
            });
        }

        console.log(`📚 Imported learning data: ${this.falsePositivePatterns.size} false positives, ${this.truePosistivePatterns.size} true positives`);
    }

    /**
     * Clear all learning data
     */
    clearLearningData() {
        this.falsePositivePatterns.clear();
        this.truePosistivePatterns.clear();
        this.feedbackData.clear();
        this.initializeFalsePositivePatterns();
    }
}

module.exports = { ConfidenceScoring };