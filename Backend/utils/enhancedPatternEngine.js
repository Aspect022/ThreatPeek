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
            contextWindow = 50,
            enableDeduplication = true
        } = options;

        const matches = [];
        const processedPatterns = this.getPatternsByCategories(categories);

        // Enhanced position tracking to prevent overlapping matches across all patterns
        const globalProcessedPositions = new Map(); // Map of position ranges to pattern info

        // Track unique matches for internal deduplication
        const uniqueMatches = new Map();

        for (const pattern of processedPatterns) {
            const patternMatches = this.findPatternMatches(content, pattern, {
                contextWindow,
                maxMatches,
                processedPositions: globalProcessedPositions
            });

            // Internal match deduplication within pattern results
            const deduplicatedPatternMatches = this.deduplicatePatternMatches(patternMatches, pattern);

            for (const match of deduplicatedPatternMatches) {
                const confidence = this.calculateConfidence(match, pattern, content);

                if (confidence >= confidenceThreshold) {
                    const enhancedMatch = {
                        ...match,
                        confidence,
                        pattern: {
                            id: pattern.id,
                            name: pattern.name,
                            category: pattern.category,
                            severity: pattern.severity
                        }
                    };

                    if (enableDeduplication) {
                        // Create a deduplication key based on pattern ID and normalized value
                        const deduplicationKey = this.generateDeduplicationKey(enhancedMatch);

                        if (uniqueMatches.has(deduplicationKey)) {
                            // Merge with existing match, keeping the higher confidence
                            const existingMatch = uniqueMatches.get(deduplicationKey);
                            const mergedMatch = this.mergeMatches(existingMatch, enhancedMatch);
                            uniqueMatches.set(deduplicationKey, mergedMatch);
                        } else {
                            // Add occurrence count for tracking
                            enhancedMatch.occurrenceCount = 1;
                            enhancedMatch.locations = [{
                                index: match.index,
                                line: this.getLineNumber(content, match.index),
                                column: this.getColumnNumber(content, match.index)
                            }];
                            uniqueMatches.set(deduplicationKey, enhancedMatch);
                        }
                    } else {
                        matches.push(enhancedMatch);
                    }

                    // Mark position as processed with pattern information
                    const positionKey = `${match.index}-${match.index + match.length}`;
                    globalProcessedPositions.set(positionKey, {
                        patternId: pattern.id,
                        value: match.value,
                        confidence: confidence
                    });
                }
            }

            if (matches.length >= maxMatches && !enableDeduplication) break;
        }

        // Convert unique matches map to array if deduplication is enabled
        const finalMatches = enableDeduplication ? Array.from(uniqueMatches.values()) : matches;

        return this.sortMatchesByConfidence(finalMatches.slice(0, maxMatches));
    }

    /**
     * Find all matches for a specific pattern with enhanced position tracking
     * @param {string} content - Content to search
     * @param {PatternDefinition} pattern - Pattern to match
     * @param {Object} options - Search options
     * @returns {RawMatch[]} Array of raw matches
     */
    findPatternMatches(content, pattern, options = {}) {
        const { contextWindow = 50, maxMatches = 20, processedPositions = new Map() } = options;
        const matches = [];
        const patternProcessedPositions = new Set(); // Track positions for this pattern
        let match;

        // Reset regex lastIndex to ensure clean matching
        pattern.regex.lastIndex = 0;

        while ((match = pattern.regex.exec(content)) !== null && matches.length < maxMatches) {
            const startIndex = match.index;
            const endIndex = startIndex + match[0].length;

            // Enhanced position tracking - check for overlaps with global processed positions
            const hasGlobalOverlap = this.checkPositionOverlap(startIndex, endIndex, processedPositions);

            // Check for overlaps within this pattern's matches
            const hasPatternOverlap = this.checkPatternPositionOverlap(startIndex, endIndex, patternProcessedPositions);

            if (hasGlobalOverlap || hasPatternOverlap) {
                // Prevent infinite loops with zero-width matches
                if (match[0].length === 0) {
                    pattern.regex.lastIndex++;
                }
                continue;
            }

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

                // Track this position for pattern-level deduplication
                const positionKey = `${startIndex}-${endIndex}`;
                patternProcessedPositions.add(positionKey);
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

    /**
     * Generate a deduplication key for a match
     * @param {PatternMatch} match - Match object
     * @returns {string} Deduplication key
     */
    generateDeduplicationKey(match) {
        // Normalize the value for consistent comparison
        const normalizedValue = match.value.toLowerCase().trim();
        return `${match.pattern.id}:${normalizedValue}`;
    }

    /**
     * Merge two matches, preserving the best attributes
     * @param {PatternMatch} existingMatch - Existing match
     * @param {PatternMatch} newMatch - New match to merge
     * @returns {PatternMatch} Merged match
     */
    mergeMatches(existingMatch, newMatch) {
        return {
            ...existingMatch,
            // Keep the higher confidence score
            confidence: Math.max(existingMatch.confidence, newMatch.confidence),
            // Increment occurrence count
            occurrenceCount: existingMatch.occurrenceCount + 1,
            // Add new location
            locations: [
                ...existingMatch.locations,
                {
                    index: newMatch.index,
                    line: this.getLineNumber(newMatch.context.full, newMatch.index),
                    column: this.getColumnNumber(newMatch.context.full, newMatch.index)
                }
            ],
            // Keep the most severe severity (critical > high > medium > low)
            pattern: {
                ...existingMatch.pattern,
                severity: this.getMostSevereSeverity(existingMatch.pattern.severity, newMatch.pattern.severity)
            }
        };
    }

    /**
     * Get line number for a given index in content
     * @param {string} content - Full content
     * @param {number} index - Character index
     * @returns {number} Line number (1-based)
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Get column number for a given index in content
     * @param {string} content - Full content
     * @param {number} index - Character index
     * @returns {number} Column number (1-based)
     */
    getColumnNumber(content, index) {
        const beforeIndex = content.substring(0, index);
        const lastNewlineIndex = beforeIndex.lastIndexOf('\n');
        return lastNewlineIndex === -1 ? index + 1 : index - lastNewlineIndex;
    }

    /**
     * Compare two severity levels and return the most severe
     * @param {string} severity1 - First severity level
     * @param {string} severity2 - Second severity level
     * @returns {string} Most severe level
     */
    getMostSevereSeverity(severity1, severity2) {
        const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        const level1 = severityOrder[severity1] || 1;
        const level2 = severityOrder[severity2] || 1;

        return level1 >= level2 ? severity1 : severity2;
    }

    /**
     * Check for position overlap with globally processed positions
     * @param {number} startIndex - Start index of current match
     * @param {number} endIndex - End index of current match
     * @param {Map} processedPositions - Map of processed positions
     * @returns {boolean} True if there's an overlap
     */
    checkPositionOverlap(startIndex, endIndex, processedPositions) {
        for (const [positionKey, positionInfo] of processedPositions) {
            const [procStart, procEnd] = positionKey.split('-').map(Number);

            // Check for any overlap between ranges
            if ((startIndex >= procStart && startIndex < procEnd) ||
                (endIndex > procStart && endIndex <= procEnd) ||
                (startIndex <= procStart && endIndex >= procEnd)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check for position overlap within pattern-specific processed positions
     * @param {number} startIndex - Start index of current match
     * @param {number} endIndex - End index of current match
     * @param {Set} patternProcessedPositions - Set of processed positions for this pattern
     * @returns {boolean} True if there's an overlap
     */
    checkPatternPositionOverlap(startIndex, endIndex, patternProcessedPositions) {
        for (const positionKey of patternProcessedPositions) {
            const [procStart, procEnd] = positionKey.split('-').map(Number);

            // Check for any overlap between ranges
            if ((startIndex >= procStart && startIndex < procEnd) ||
                (endIndex > procStart && endIndex <= procEnd) ||
                (startIndex <= procStart && endIndex >= procEnd)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Deduplicate matches within a single pattern's results
     * @param {RawMatch[]} matches - Array of raw matches from a pattern
     * @param {PatternDefinition} pattern - Pattern definition
     * @returns {RawMatch[]} Deduplicated matches
     */
    deduplicatePatternMatches(matches, pattern) {
        if (matches.length <= 1) {
            return matches;
        }

        const uniqueMatches = new Map();

        for (const match of matches) {
            // Create a deduplication key based on normalized value and position proximity
            const normalizedValue = match.value.toLowerCase().trim();
            const deduplicationKey = `${pattern.id}:${normalizedValue}`;

            if (uniqueMatches.has(deduplicationKey)) {
                const existingMatch = uniqueMatches.get(deduplicationKey);

                // Check if matches are close enough to be considered duplicates
                const positionDifference = Math.abs(match.index - existingMatch.index);

                // If positions are very close (within 10 characters), merge them
                if (positionDifference <= 10) {
                    // Keep the match with better context or earlier position
                    const betterMatch = this.selectBetterMatch(existingMatch, match);
                    uniqueMatches.set(deduplicationKey, betterMatch);
                } else {
                    // Different positions, create a new key with position info
                    const positionKey = `${deduplicationKey}:${Math.floor(match.index / 100)}`;
                    if (!uniqueMatches.has(positionKey)) {
                        uniqueMatches.set(positionKey, match);
                    }
                }
            } else {
                uniqueMatches.set(deduplicationKey, match);
            }
        }

        return Array.from(uniqueMatches.values());
    }

    /**
     * Select the better match between two similar matches
     * @param {RawMatch} match1 - First match
     * @param {RawMatch} match2 - Second match
     * @returns {RawMatch} Better match
     */
    selectBetterMatch(match1, match2) {
        // Prefer matches with more context
        const context1Length = match1.context.before.length + match1.context.after.length;
        const context2Length = match2.context.before.length + match2.context.after.length;

        if (context1Length !== context2Length) {
            return context1Length > context2Length ? match1 : match2;
        }

        // Prefer matches with longer values
        if (match1.value.length !== match2.value.length) {
            return match1.value.length > match2.value.length ? match1 : match2;
        }

        // Prefer earlier position
        return match1.index <= match2.index ? match1 : match2;
    }
}

module.exports = { EnhancedPatternEngine };