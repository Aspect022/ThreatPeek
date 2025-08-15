/**
 * Enhanced Pattern Engine with confidence scoring and false positive filtering
 * Supports pattern categorization and context-aware matching
 */

class EnhancedPatternEngine {
    constructor() {
        this.patterns = new Map();
        this.categories = {
            secrets: [],
            vulnerabilities: [],
            configurations: []
        };
        this.contextAnalysisEnabled = true;
        this.confidenceThreshold = 0.5;
    }

    /**
     * Register a pattern with the engine
     * @param {PatternDefinition} pattern - Pattern definition object
     */
    registerPattern(pattern) {
        if (!this.validatePattern(pattern)) {
            throw new Error(`Invalid pattern definition: ${pattern.id || 'unknown'}`);
        }

        // Compile regex if it's a string
        if (typeof pattern.regex === 'string') {
            pattern.regex = new RegExp(pattern.regex, pattern.flags || 'gi');
        }

        // Set default values
        pattern.confidence = pattern.confidence || 0.8;
        pattern.category = pattern.category || 'secrets';
        pattern.severity = pattern.severity || 'medium';
        pattern.falsePositiveFilters = pattern.falsePositiveFilters || [];

        this.patterns.set(pattern.id, pattern);
        this.categories[pattern.category].push(pattern.id);
    }

    /**
     * Register multiple patterns at once
     * @param {PatternDefinition[]} patterns - Array of pattern definitions
     */
    registerPatterns(patterns) {
        patterns.forEach(pattern => this.registerPattern(pattern));
    }

    /**
     * Scan content for pattern matches with confidence scoring
     * @param {string} content - Content to scan
     * @param {ScanOptions} options - Scan configuration options
     * @returns {PatternMatch[]} Array of matches with confidence scores
     */
    scanContent(content, options = {}) {
        const {
            categories = ['secrets', 'vulnerabilities', 'configurations'],
            confidenceThreshold = this.confidenceThreshold,
            maxMatches = 100,
            contextWindow = 50
        } = options;

        const matches = [];
        const processedPatterns = this.getPatternsByCategories(categories);

        for (const pattern of processedPatterns) {
            const patternMatches = this.findPatternMatches(content, pattern, {
                contextWindow,
                maxMatches
            });

            for (const match of patternMatches) {
                const confidence = this.calculateConfidence(match, pattern, content);

                if (confidence >= confidenceThreshold) {
                    matches.push({
                        ...match,
                        confidence,
                        pattern: {
                            id: pattern.id,
                            name: pattern.name,
                            category: pattern.category,
                            severity: pattern.severity
                        }
                    });
                }
            }

            if (matches.length >= maxMatches) break;
        }

        return this.sortMatchesByConfidence(matches);
    }

    /**
     * Find all matches for a specific pattern
     * @param {string} content - Content to search
     * @param {PatternDefinition} pattern - Pattern to match
     * @param {Object} options - Search options
     * @returns {RawMatch[]} Array of raw matches
     */
    findPatternMatches(content, pattern, options = {}) {
        const { contextWindow = 50, maxMatches = 20 } = options;
        const matches = [];
        let match;

        // Reset regex lastIndex to ensure clean matching
        pattern.regex.lastIndex = 0;

        while ((match = pattern.regex.exec(content)) !== null && matches.length < maxMatches) {
            const startIndex = match.index;
            const endIndex = startIndex + match[0].length;

            // Extract context around the match
            const contextStart = Math.max(0, startIndex - contextWindow);
            const contextEnd = Math.min(content.length, endIndex + contextWindow);
            const beforeContext = content.slice(contextStart, startIndex);
            const afterContext = content.slice(endIndex, contextEnd);

            const rawMatch = {
                value: pattern.extractGroup ? match[pattern.extractGroup] : match[0],
                fullMatch: match[0],
                index: startIndex,
                length: match[0].length,
                context: {
                    before: beforeContext,
                    after: afterContext,
                    full: content.slice(contextStart, contextEnd)
                },
                groups: match.slice(1) // Capture groups
            };

            // Apply false positive filters
            if (!this.isFalsePositive(rawMatch, pattern)) {
                matches.push(rawMatch);
            }

            // Prevent infinite loops with zero-width matches
            if (match[0].length === 0) {
                pattern.regex.lastIndex++;
            }
        }

        // Reset regex lastIndex after scanning
        pattern.regex.lastIndex = 0;
        return matches;
    }

    /**
     * Calculate confidence score for a match
     * @param {RawMatch} match - Raw match object
     * @param {PatternDefinition} pattern - Pattern definition
     * @param {string} content - Full content being scanned
     * @returns {number} Confidence score between 0 and 1
     */
    calculateConfidence(match, pattern, content) {
        let confidence = pattern.confidence || 0.8;

        // Context-based confidence adjustments
        if (this.contextAnalysisEnabled) {
            confidence = this.adjustConfidenceByContext(confidence, match, pattern);
        }

        // Length-based confidence (longer matches are generally more reliable)
        if (pattern.minLength && match.value.length >= pattern.minLength) {
            confidence += 0.1;
        }

        // Validator function confidence boost
        if (pattern.validator && pattern.validator(match.value)) {
            confidence += 0.15;
        }

        // Entropy-based confidence (higher entropy = more likely to be real)
        const entropy = this.calculateEntropy(match.value);
        if (entropy > 3.5) {
            confidence += 0.1;
        } else if (entropy < 2.0) {
            confidence -= 0.2;
        }

        // Ensure confidence stays within bounds
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Adjust confidence based on surrounding context
     * @param {number} baseConfidence - Base confidence score
     * @param {RawMatch} match - Match object with context
     * @param {PatternDefinition} pattern - Pattern definition
     * @returns {number} Adjusted confidence score
     */
    adjustConfidenceByContext(baseConfidence, match, pattern) {
        let confidence = baseConfidence;
        const { before, after } = match.context;

        // Look for variable assignment patterns
        const assignmentPatterns = [
            /(?:const|let|var)\s+\w+\s*=\s*$/,
            /\w+\s*[:=]\s*$/,
            /['"`]\s*$/
        ];

        const hasAssignmentContext = assignmentPatterns.some(p => p.test(before));
        if (hasAssignmentContext) {
            confidence += 0.15;
        }

        // Look for environment variable patterns
        const envPatterns = [
            /process\.env\./,
            /process\.env\[/,
            /ENV\[/,
            /getenv\(/
        ];

        const hasEnvContext = envPatterns.some(p => p.test(before));
        if (hasEnvContext) {
            confidence += 0.2;
        }

        // Look for configuration object patterns
        const configPatterns = [
            /config\./,
            /settings\./,
            /options\./,
            /credentials\./
        ];

        const hasConfigContext = configPatterns.some(p => p.test(before));
        if (hasConfigContext) {
            confidence += 0.1;
        }

        // Reduce confidence for common false positive contexts
        const falsePositiveContexts = [
            /example/i,
            /placeholder/i,
            /test/i,
            /demo/i,
            /sample/i,
            /mock/i,
            /fake/i,
            /dummy/i
        ];

        const hasFalsePositiveContext = falsePositiveContexts.some(p =>
            p.test(before) || p.test(after)
        );
        if (hasFalsePositiveContext) {
            confidence -= 0.3;
        }

        // Look for comment contexts (usually examples or documentation)
        const commentPatterns = [
            /\/\*[\s\S]*$/,
            /\/\/.*$/,
            /<!--[\s\S]*$/,
            /#.*$/
        ];

        const hasCommentContext = commentPatterns.some(p => p.test(before));
        if (hasCommentContext) {
            confidence -= 0.2;
        }

        return confidence;
    }

    /**
     * Check if a match is a false positive
     * @param {RawMatch} match - Match to check
     * @param {PatternDefinition} pattern - Pattern definition
     * @returns {boolean} True if match is likely a false positive
     */
    isFalsePositive(match, pattern) {
        if (!pattern.falsePositiveFilters || pattern.falsePositiveFilters.length === 0) {
            return false;
        }

        // Check against false positive filters
        for (const filter of pattern.falsePositiveFilters) {
            if (filter.test(match.value) || filter.test(match.fullMatch)) {
                return true;
            }
        }

        // Check context for false positive indicators
        const contextText = match.context.full.toLowerCase();
        const falsePositiveKeywords = [
            'example', 'placeholder', 'test', 'demo', 'sample',
            'mock', 'fake', 'dummy', 'your_key_here', 'replace_with'
        ];

        return falsePositiveKeywords.some(keyword => contextText.includes(keyword));
    }

    /**
     * Calculate Shannon entropy of a string
     * @param {string} str - String to analyze
     * @returns {number} Entropy value
     */
    calculateEntropy(str) {
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
     * Get patterns filtered by categories
     * @param {string[]} categories - Categories to include
     * @returns {PatternDefinition[]} Filtered patterns
     */
    getPatternsByCategories(categories) {
        const patternIds = new Set();

        for (const category of categories) {
            if (this.categories[category]) {
                this.categories[category].forEach(id => patternIds.add(id));
            }
        }

        return Array.from(patternIds).map(id => this.patterns.get(id)).filter(Boolean);
    }

    /**
     * Sort matches by confidence score (descending)
     * @param {PatternMatch[]} matches - Matches to sort
     * @returns {PatternMatch[]} Sorted matches
     */
    sortMatchesByConfidence(matches) {
        return matches.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Validate pattern definition
     * @param {PatternDefinition} pattern - Pattern to validate
     * @returns {boolean} True if pattern is valid
     */
    validatePattern(pattern) {
        if (!pattern.id || typeof pattern.id !== 'string') {
            return false;
        }

        if (!pattern.name || typeof pattern.name !== 'string') {
            return false;
        }

        if (!pattern.regex) {
            return false;
        }

        if (pattern.category && !['secrets', 'vulnerabilities', 'configurations'].includes(pattern.category)) {
            return false;
        }

        if (pattern.severity && !['critical', 'high', 'medium', 'low'].includes(pattern.severity)) {
            return false;
        }

        return true;
    }

    /**
     * Get pattern statistics
     * @returns {Object} Statistics about registered patterns
     */
    getStats() {
        return {
            totalPatterns: this.patterns.size,
            categoryCounts: {
                secrets: this.categories.secrets.length,
                vulnerabilities: this.categories.vulnerabilities.length,
                configurations: this.categories.configurations.length
            },
            patterns: Array.from(this.patterns.values()).map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                severity: p.severity
            }))
        };
    }

    /**
     * Clear all registered patterns
     */
    clearPatterns() {
        this.patterns.clear();
        this.categories = {
            secrets: [],
            vulnerabilities: [],
            configurations: []
        };
    }
}

module.exports = { EnhancedPatternEngine };