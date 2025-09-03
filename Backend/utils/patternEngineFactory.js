/**
 * Factory for creating and initializing Enhanced Pattern Engine instances
 * Provides convenient methods for setting up the engine with predefined patterns
 */

const { EnhancedPatternEngine } = require('./enhancedPatternEngine');
const {
    allPatterns,
    secretPatterns,
    vulnerabilityPatterns,
    configurationPatterns
} = require('./enhancedPatternDefinitions');

class PatternEngineFactory {
    /**
     * Create a new Enhanced Pattern Engine with all patterns registered
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Configured engine instance
     */
    static createFullEngine(options = {}) {
        const {
            confidenceThreshold = 0.5,
            contextAnalysisEnabled = true,
            categories = ['secrets', 'vulnerabilities', 'configurations']
        } = options;

        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = confidenceThreshold;
        engine.contextAnalysisEnabled = contextAnalysisEnabled;

        // Register patterns based on requested categories
        const patternsToRegister = allPatterns.filter(pattern =>
            categories.includes(pattern.category)
        );

        engine.registerPatterns(patternsToRegister);
        return engine;
    }

    /**
     * Create an engine with only secret detection patterns
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Engine with secret patterns only
     */
    static createSecretsEngine(options = {}) {
        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = options.confidenceThreshold || 0.6;
        engine.contextAnalysisEnabled = options.contextAnalysisEnabled !== false;

        engine.registerPatterns(secretPatterns);
        return engine;
    }

    /**
     * Create an engine with only vulnerability detection patterns
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Engine with vulnerability patterns only
     */
    static createVulnerabilityEngine(options = {}) {
        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = options.confidenceThreshold || 0.5;
        engine.contextAnalysisEnabled = options.contextAnalysisEnabled !== false;

        engine.registerPatterns(vulnerabilityPatterns);
        return engine;
    }

    /**
     * Create an engine with only configuration detection patterns
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Engine with configuration patterns only
     */
    static createConfigurationEngine(options = {}) {
        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = options.confidenceThreshold || 0.7;
        engine.contextAnalysisEnabled = options.contextAnalysisEnabled !== false;

        engine.registerPatterns(configurationPatterns);
        return engine;
    }

    /**
     * Create a lightweight engine for high-performance scanning
     * Uses only high-confidence patterns and reduced context analysis
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Lightweight engine instance
     */
    static createLightweightEngine(options = {}) {
        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = options.confidenceThreshold || 0.8;
        engine.contextAnalysisEnabled = false; // Disable for performance

        // Only register high-confidence patterns
        const highConfidencePatterns = allPatterns.filter(pattern =>
            (pattern.confidence || 0.8) >= 0.8
        );

        engine.registerPatterns(highConfidencePatterns);
        return engine;
    }

    /**
     * Create an engine optimized for specific requirements
     * @param {string[]} requiredPatternIds - Specific pattern IDs to include
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Custom engine instance
     */
    static createCustomEngine(requiredPatternIds, options = {}) {
        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = options.confidenceThreshold || 0.5;
        engine.contextAnalysisEnabled = options.contextAnalysisEnabled !== false;

        const customPatterns = allPatterns.filter(pattern =>
            requiredPatternIds.includes(pattern.id)
        );

        if (customPatterns.length === 0) {
            throw new Error('No valid patterns found for the specified IDs');
        }

        engine.registerPatterns(customPatterns);
        return engine;
    }

    /**
     * Get available pattern information
     * @returns {Object} Information about available patterns
     */
    static getAvailablePatterns() {
        return {
            total: allPatterns.length,
            categories: {
                secrets: secretPatterns.length,
                vulnerabilities: vulnerabilityPatterns.length,
                configurations: configurationPatterns.length
            },
            patterns: allPatterns.map(pattern => ({
                id: pattern.id,
                name: pattern.name,
                category: pattern.category,
                severity: pattern.severity,
                confidence: pattern.confidence || 0.8
            }))
        };
    }

    /**
     * Validate engine configuration
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    static validateConfig(config) {
        const errors = [];
        const warnings = [];

        if (config.confidenceThreshold !== undefined) {
            if (typeof config.confidenceThreshold !== 'number' ||
                config.confidenceThreshold < 0 ||
                config.confidenceThreshold > 1) {
                errors.push('confidenceThreshold must be a number between 0 and 1');
            }
        }

        if (config.categories !== undefined) {
            if (!Array.isArray(config.categories)) {
                errors.push('categories must be an array');
            } else {
                const validCategories = ['secrets', 'vulnerabilities', 'configurations'];
                const invalidCategories = config.categories.filter(cat =>
                    !validCategories.includes(cat)
                );
                if (invalidCategories.length > 0) {
                    errors.push(`Invalid categories: ${invalidCategories.join(', ')}`);
                }
            }
        }

        if (config.maxMatches !== undefined) {
            if (typeof config.maxMatches !== 'number' || config.maxMatches < 1) {
                errors.push('maxMatches must be a positive number');
            }
        }

        if (config.contextWindow !== undefined) {
            if (typeof config.contextWindow !== 'number' || config.contextWindow < 0) {
                errors.push('contextWindow must be a non-negative number');
            }
        }

        // Performance warnings
        if (config.confidenceThreshold !== undefined && config.confidenceThreshold < 0.3) {
            warnings.push('Very low confidence threshold may result in many false positives');
        }

        if (config.maxMatches !== undefined && config.maxMatches > 1000) {
            warnings.push('High maxMatches value may impact performance');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create an engine with backward compatibility for existing regex patterns
     * @param {Array} legacyPatterns - Array of legacy pattern objects
     * @param {Object} options - Configuration options
     * @returns {EnhancedPatternEngine} Engine with converted legacy patterns
     */
    static createFromLegacyPatterns(legacyPatterns, options = {}) {
        const engine = new EnhancedPatternEngine();
        engine.confidenceThreshold = options.confidenceThreshold || 0.5;
        engine.contextAnalysisEnabled = options.contextAnalysisEnabled !== false;

        // Convert legacy patterns to enhanced format
        const enhancedPatterns = legacyPatterns.map((pattern, index) => ({
            id: pattern.id || `legacy-pattern-${index}`,
            name: pattern.name || `Legacy Pattern ${index + 1}`,
            category: 'secrets', // Default category for legacy patterns
            severity: pattern.severity || 'medium',
            regex: pattern.regex,
            confidence: 0.7, // Default confidence for legacy patterns
            extractGroup: pattern.extractGroup || 0,
            falsePositiveFilters: pattern.filters?.excludePatterns || []
        }));

        engine.registerPatterns(enhancedPatterns);
        return engine;
    }
}

module.exports = { PatternEngineFactory };