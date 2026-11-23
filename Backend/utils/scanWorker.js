/**
 * Scan Worker - Worker thread for parallel file scanning and pattern matching
 * Handles individual scanning tasks in isolation
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs-extra');
const { EnhancedPatternEngine } = require('./enhancedPatternEngine');
const { DeduplicationEngine } = require('../services/deduplicationEngine');
const enhancedPatternDefinitions = require('./enhancedPatternDefinitions');

// Initialize pattern engine in worker
const patternEngine = new EnhancedPatternEngine();
patternEngine.registerPatterns(enhancedPatternDefinitions.allPatterns);

// Initialize deduplication engine for worker-level deduplication
const deduplicationEngine = new DeduplicationEngine({
    enableFileLevel: true,
    enableScanLevel: false, // Worker handles file-level only
    preserveContext: true,
    maxCacheSize: 5000 // Smaller cache for worker threads
});

// Worker state
let isShuttingDown = false;

/**
 * Handle messages from main thread
 */
parentPort.on('message', async (message) => {
    const { taskId, taskType, taskData, options, type } = message;

    if (type === 'shutdown') {
        isShuttingDown = true;
        process.exit(0);
        return;
    }

    try {
        let result;

        switch (taskType) {
            case 'scanFile':
                result = await scanFile(taskData, options);
                break;
            case 'scanContent':
                result = await scanContent(taskData, options);
                break;
            case 'validatePatterns':
                result = await validatePatterns(taskData, options);
                break;
            case 'analyzeEntropy':
                result = await analyzeEntropy(taskData, options);
                break;
            default:
                throw new Error(`Unknown task type: ${taskType}`);
        }

        parentPort.postMessage({
            taskId,
            type: 'taskComplete',
            result
        });

    } catch (error) {
        parentPort.postMessage({
            taskId,
            type: 'taskComplete',
            error: error.message
        });
    }
});

/**
 * Scan a single file for patterns
 * @param {Object} taskData - Task data containing file path and options
 * @param {Object} options - Task options
 * @returns {Promise<Object>} Scan results
 */
async function scanFile(taskData, options = {}) {
    const { filePath, scanOptions } = taskData;
    const { relativePath } = scanOptions;

    try {
        // Check if file exists and get stats
        const stats = await fs.stat(filePath);
        const maxFileSize = scanOptions.maxFileSize || 10 * 1024 * 1024; // 10MB default

        if (stats.size > maxFileSize) {
            return {
                file: relativePath || filePath,
                findings: [],
                skipped: true,
                reason: `File too large (${Math.round(stats.size / 1024 / 1024)}MB)`,
                size: stats.size
            };
        }

        // Read file content
        const content = await fs.readFile(filePath, 'utf8');

        // Scan content with pattern engine
        const matches = patternEngine.scanContent(content, {
            categories: scanOptions.categories || ['secrets', 'vulnerabilities', 'configurations'],
            confidenceThreshold: scanOptions.confidenceThreshold || 0.5,
            maxMatches: scanOptions.maxMatches || 50
        });

        // Convert matches to findings format
        const rawFindings = matches.map(match => ({
            type: match.pattern.name,
            severity: match.pattern.severity,
            confidence: match.confidence,
            value: match.value,
            file: relativePath || filePath,
            context: {
                before: match.context.before,
                after: match.context.after
            },
            pattern: {
                id: match.pattern.id,
                category: match.pattern.category
            },
            location: {
                line: getLineNumber(content, match.index),
                column: getColumnNumber(content, match.index),
                index: match.index
            }
        }));

        // Apply worker-level deduplication to prevent duplicate findings within the file
        const deduplicatedFindings = scanOptions.enableDeduplication !== false ?
            deduplicationEngine.deduplicateFileFindings(rawFindings, relativePath || filePath) :
            rawFindings;

        // Get deduplication statistics for this file
        const deduplicationStats = deduplicationEngine.getStatistics();

        return {
            file: relativePath || filePath,
            findings: deduplicatedFindings,
            size: stats.size,
            scanTime: Date.now(),
            deduplicationStats: {
                totalFindings: rawFindings.length,
                uniqueFindings: deduplicatedFindings.length,
                duplicatesRemoved: rawFindings.length - deduplicatedFindings.length,
                deduplicationTime: deduplicationStats.deduplicationTime,
                memoryUsage: deduplicationStats.memoryUsage
            }
        };

    } catch (error) {
        // Return error as finding if file can't be read
        return {
            file: relativePath || filePath,
            findings: [{
                type: 'File Read Error',
                severity: 'low',
                confidence: 1.0,
                value: `Failed to read file: ${error.message}`,
                context: {
                    before: 'File access error:',
                    after: error.message
                },
                pattern: {
                    id: 'file-read-error',
                    category: 'info'
                }
            }],
            error: error.message
        };
    }
}

/**
 * Scan content for patterns
 * @param {Object} taskData - Task data containing content and options
 * @param {Object} options - Task options
 * @returns {Promise<Array>} Pattern matches
 */
async function scanContent(taskData, options = {}) {
    const { content, scanOptions, chunkOffset = 0 } = taskData;

    try {
        const matches = patternEngine.scanContent(content, {
            categories: scanOptions.categories || ['secrets', 'vulnerabilities', 'configurations'],
            confidenceThreshold: scanOptions.confidenceThreshold || 0.5,
            maxMatches: scanOptions.maxMatches || 100
        });

        // Adjust match indices if this is a chunk
        if (chunkOffset > 0) {
            matches.forEach(match => {
                match.index += chunkOffset;
            });
        }

        return matches;

    } catch (error) {
        throw new Error(`Content scanning failed: ${error.message}`);
    }
}

/**
 * Validate patterns against test cases
 * @param {Object} taskData - Task data containing patterns and test cases
 * @param {Object} options - Task options
 * @returns {Promise<Object>} Validation results
 */
async function validatePatterns(taskData, options = {}) {
    const { patterns, testCases } = taskData;

    const results = {
        totalPatterns: patterns.length,
        totalTests: testCases.length,
        passed: 0,
        failed: 0,
        details: []
    };

    for (const pattern of patterns) {
        const patternTests = testCases.filter(test => test.patternId === pattern.id);

        for (const test of patternTests) {
            try {
                const matches = patternEngine.scanContent(test.content, {
                    categories: [pattern.category],
                    confidenceThreshold: 0.1 // Lower threshold for testing
                });

                const hasMatch = matches.some(match => match.pattern.id === pattern.id);
                const shouldMatch = test.shouldMatch;

                if (hasMatch === shouldMatch) {
                    results.passed++;
                    results.details.push({
                        patternId: pattern.id,
                        testCase: test.name,
                        status: 'passed',
                        expected: shouldMatch,
                        actual: hasMatch
                    });
                } else {
                    results.failed++;
                    results.details.push({
                        patternId: pattern.id,
                        testCase: test.name,
                        status: 'failed',
                        expected: shouldMatch,
                        actual: hasMatch,
                        matches: matches.filter(m => m.pattern.id === pattern.id)
                    });
                }
            } catch (error) {
                results.failed++;
                results.details.push({
                    patternId: pattern.id,
                    testCase: test.name,
                    status: 'error',
                    error: error.message
                });
            }
        }
    }

    return results;
}

/**
 * Analyze entropy of strings for confidence scoring
 * @param {Object} taskData - Task data containing strings to analyze
 * @param {Object} options - Task options
 * @returns {Promise<Array>} Entropy analysis results
 */
async function analyzeEntropy(taskData, options = {}) {
    const { strings } = taskData;

    return strings.map(str => ({
        value: str,
        entropy: calculateEntropy(str),
        length: str.length,
        uniqueChars: new Set(str).size,
        hasNumbers: /\d/.test(str),
        hasLetters: /[a-zA-Z]/.test(str),
        hasSpecialChars: /[^a-zA-Z0-9]/.test(str)
    }));
}

/**
 * Calculate Shannon entropy of a string
 * @param {string} str - String to analyze
 * @returns {number} Entropy value
 */
function calculateEntropy(str) {
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
 * Get line number for a character index in content
 * @param {string} content - File content
 * @param {number} index - Character index
 * @returns {number} Line number (1-based)
 */
function getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
}

/**
 * Get column number for a character index in content
 * @param {string} content - File content
 * @param {number} index - Character index
 * @returns {number} Column number (1-based)
 */
function getColumnNumber(content, index) {
    const beforeIndex = content.substring(0, index);
    const lastNewlineIndex = beforeIndex.lastIndexOf('\n');
    return index - lastNewlineIndex;
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Worker uncaught exception:', error);
    parentPort.postMessage({
        type: 'error',
        error: error.message
    });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Worker unhandled rejection:', reason);
    parentPort.postMessage({
        type: 'error',
        error: reason.toString()
    });
    process.exit(1);
});