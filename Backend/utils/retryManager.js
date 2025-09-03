/**
 * Retry Manager - Implements retry logic with exponential backoff for network failures
 * Provides error recovery mechanisms and graceful degradation
 */

class RetryManager {
    constructor(options = {}) {
        this.defaultMaxRetries = options.maxRetries || 3;
        this.defaultBaseDelay = options.baseDelay || 1000; // 1 second
        this.defaultMaxDelay = options.maxDelay || 30000; // 30 seconds
        this.defaultBackoffStrategy = options.backoffStrategy || 'exponential';
        this.defaultJitter = options.jitter !== false; // Add jitter by default

        // Error classification
        this.retryableErrors = new Set([
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'EAI_AGAIN',
            'EPIPE',
            'ECONNABORTED'
        ]);

        this.retryableHttpCodes = new Set([
            408, // Request Timeout
            429, // Too Many Requests
            500, // Internal Server Error
            502, // Bad Gateway
            503, // Service Unavailable
            504, // Gateway Timeout
            520, // Unknown Error (Cloudflare)
            521, // Web Server Is Down (Cloudflare)
            522, // Connection Timed Out (Cloudflare)
            523, // Origin Is Unreachable (Cloudflare)
            524  // A Timeout Occurred (Cloudflare)
        ]);

        // Statistics
        this.stats = {
            totalAttempts: 0,
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            averageRetryDelay: 0,
            errorsByType: new Map()
        };
    }

    /**
     * Execute a function with retry logic
     * @param {Function} fn - Function to execute
     * @param {Object} options - Retry options
     * @returns {Promise} Promise that resolves with function result
     */
    async executeWithRetry(fn, options = {}) {
        const config = {
            maxRetries: options.maxRetries || this.defaultMaxRetries,
            baseDelay: options.baseDelay || this.defaultBaseDelay,
            maxDelay: options.maxDelay || this.defaultMaxDelay,
            backoffStrategy: options.backoffStrategy || this.defaultBackoffStrategy,
            jitter: options.jitter !== false,
            retryCondition: options.retryCondition || this.defaultRetryCondition.bind(this),
            onRetry: options.onRetry || null,
            context: options.context || 'unknown'
        };

        let lastError;
        let attempt = 0;

        while (attempt <= config.maxRetries) {
            this.stats.totalAttempts++;

            try {
                const result = await fn();

                if (attempt > 0) {
                    this.stats.successfulRetries++;
                    console.log(`✅ Retry successful after ${attempt} attempts for ${config.context}`);
                }

                return result;
            } catch (error) {
                lastError = error;
                this.updateErrorStats(error);

                // Check if we should retry
                if (attempt >= config.maxRetries || !config.retryCondition(error, attempt)) {
                    if (attempt > 0) {
                        this.stats.failedRetries++;
                    }
                    throw this.createRetryExhaustedError(error, attempt, config.context);
                }

                // Calculate delay for next attempt
                const delay = this.calculateDelay(attempt, config);

                console.log(`⚠️ Attempt ${attempt + 1} failed for ${config.context}: ${error.message}. Retrying in ${delay}ms...`);

                // Call retry callback if provided
                if (config.onRetry) {
                    try {
                        await config.onRetry(error, attempt, delay);
                    } catch (callbackError) {
                        console.warn(`Retry callback error: ${callbackError.message}`);
                    }
                }

                // Wait before retry
                await this.delay(delay);

                attempt++;
                this.stats.totalRetries++;
                this.stats.averageRetryDelay = (this.stats.averageRetryDelay * (this.stats.totalRetries - 1) + delay) / this.stats.totalRetries;
            }
        }

        throw lastError;
    }

    /**
     * Execute multiple functions with retry logic in parallel
     * @param {Array} functions - Array of functions to execute
     * @param {Object} options - Retry options
     * @returns {Promise<Array>} Array of results
     */
    async executeParallelWithRetry(functions, options = {}) {
        const promises = functions.map((fn, index) =>
            this.executeWithRetry(fn, {
                ...options,
                context: options.context ? `${options.context}[${index}]` : `parallel[${index}]`
            })
        );

        if (options.failFast === false) {
            // Return all results, including failures
            return Promise.allSettled(promises);
        } else {
            // Fail if any function fails
            return Promise.all(promises);
        }
    }

    /**
     * Execute with circuit breaker pattern
     * @param {Function} fn - Function to execute
     * @param {Object} options - Circuit breaker options
     * @returns {Promise} Promise that resolves with function result
     */
    async executeWithCircuitBreaker(fn, options = {}) {
        const circuitKey = options.circuitKey || 'default';
        const failureThreshold = options.failureThreshold || 5;
        const resetTimeout = options.resetTimeout || 60000; // 1 minute
        const monitoringWindow = options.monitoringWindow || 300000; // 5 minutes

        // Get or create circuit state
        if (!this.circuits) {
            this.circuits = new Map();
        }

        let circuit = this.circuits.get(circuitKey);
        if (!circuit) {
            circuit = {
                state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
                failures: 0,
                lastFailureTime: null,
                lastResetAttempt: null,
                successCount: 0,
                totalRequests: 0
            };
            this.circuits.set(circuitKey, circuit);
        }

        const now = Date.now();

        // Check if circuit should be reset
        if (circuit.state === 'OPEN' &&
            circuit.lastFailureTime &&
            (now - circuit.lastFailureTime) > resetTimeout) {
            circuit.state = 'HALF_OPEN';
            circuit.lastResetAttempt = now;
            console.log(`🔄 Circuit breaker ${circuitKey} transitioning to HALF_OPEN`);
        }

        // Check circuit state
        if (circuit.state === 'OPEN') {
            throw this.createCircuitOpenError(circuitKey, circuit);
        }

        try {
            const result = await this.executeWithRetry(fn, {
                ...options,
                context: `circuit[${circuitKey}]`
            });

            // Success - update circuit state
            circuit.successCount++;
            circuit.totalRequests++;

            if (circuit.state === 'HALF_OPEN') {
                // Reset circuit on successful half-open attempt
                circuit.state = 'CLOSED';
                circuit.failures = 0;
                circuit.lastFailureTime = null;
                console.log(`✅ Circuit breaker ${circuitKey} reset to CLOSED`);
            }

            return result;
        } catch (error) {
            // Failure - update circuit state
            circuit.failures++;
            circuit.totalRequests++;
            circuit.lastFailureTime = now;

            if (circuit.failures >= failureThreshold) {
                circuit.state = 'OPEN';
                console.log(`🚨 Circuit breaker ${circuitKey} opened after ${circuit.failures} failures`);
            }

            throw error;
        }
    }

    /**
     * Default retry condition
     * @param {Error} error - Error to check
     * @param {number} attempt - Current attempt number
     * @returns {boolean} True if should retry
     */
    defaultRetryCondition(error, attempt) {
        // Check for retryable error codes
        if (error.code && this.retryableErrors.has(error.code)) {
            return true;
        }

        // Check for retryable HTTP status codes
        if (error.response && error.response.status &&
            this.retryableHttpCodes.has(error.response.status)) {
            return true;
        }

        // Check for timeout errors
        if (error.message && error.message.toLowerCase().includes('timeout')) {
            return true;
        }

        // Check for network errors
        if (error.message && (
            error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('connection') ||
            error.message.toLowerCase().includes('fetch')
        )) {
            return true;
        }

        // Check for specific error messages that indicate retryable conditions
        const retryableMessages = [
            'econnreset',
            'etimedout',
            'enotfound',
            'econnrefused',
            'ehostunreach',
            'enetunreach',
            'eai_again',
            'epipe',
            'econnaborted'
        ];

        if (error.message) {
            const lowerMessage = error.message.toLowerCase();
            if (retryableMessages.some(msg => lowerMessage.includes(msg))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate delay for next retry attempt
     * @param {number} attempt - Current attempt number (0-based)
     * @param {Object} config - Retry configuration
     * @returns {number} Delay in milliseconds
     */
    calculateDelay(attempt, config) {
        let delay;

        switch (config.backoffStrategy) {
            case 'linear':
                delay = config.baseDelay * (attempt + 1);
                break;
            case 'exponential':
                delay = config.baseDelay * Math.pow(2, attempt);
                break;
            case 'fixed':
                delay = config.baseDelay;
                break;
            default:
                delay = config.baseDelay * Math.pow(2, attempt);
        }

        // Apply jitter to avoid thundering herd
        if (config.jitter) {
            const jitterAmount = delay * 0.1; // 10% jitter
            delay += (Math.random() - 0.5) * 2 * jitterAmount;
        }

        // Ensure delay doesn't exceed maximum
        return Math.min(delay, config.maxDelay);
    }

    /**
     * Create a delay promise
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update error statistics
     * @param {Error} error - Error to track
     */
    updateErrorStats(error) {
        let errorType = error.code || error.name || 'Unknown';

        // If no code, try to extract from message
        if (!error.code && error.message) {
            const message = error.message.toLowerCase();
            const knownErrors = ['econnreset', 'etimedout', 'enotfound', 'econnrefused'];
            const foundError = knownErrors.find(err => message.includes(err));
            if (foundError) {
                errorType = foundError.toUpperCase();
            }
        }

        const count = this.stats.errorsByType.get(errorType) || 0;
        this.stats.errorsByType.set(errorType, count + 1);
    }

    /**
     * Create retry exhausted error
     * @param {Error} originalError - Original error
     * @param {number} attempts - Number of attempts made
     * @param {string} context - Context information
     * @returns {Error} Retry exhausted error
     */
    createRetryExhaustedError(originalError, attempts, context) {
        const error = new Error(
            `Retry exhausted after ${attempts} attempts for ${context}: ${originalError.message}`
        );
        error.code = 'RETRY_EXHAUSTED';
        error.originalError = originalError;
        error.attempts = attempts;
        error.context = context;
        return error;
    }

    /**
     * Create circuit open error
     * @param {string} circuitKey - Circuit identifier
     * @param {Object} circuit - Circuit state
     * @returns {Error} Circuit open error
     */
    createCircuitOpenError(circuitKey, circuit) {
        const error = new Error(
            `Circuit breaker ${circuitKey} is OPEN. ${circuit.failures} failures detected.`
        );
        error.code = 'CIRCUIT_OPEN';
        error.circuitKey = circuitKey;
        error.failures = circuit.failures;
        error.lastFailureTime = circuit.lastFailureTime;
        return error;
    }

    /**
     * Get retry statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            errorsByType: Object.fromEntries(this.stats.errorsByType),
            circuits: this.circuits ? Object.fromEntries(
                Array.from(this.circuits.entries()).map(([key, circuit]) => [
                    key,
                    {
                        state: circuit.state,
                        failures: circuit.failures,
                        successCount: circuit.successCount,
                        totalRequests: circuit.totalRequests,
                        failureRate: circuit.totalRequests > 0 ?
                            circuit.failures / circuit.totalRequests : 0
                    }
                ])
            ) : {}
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalAttempts: 0,
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            averageRetryDelay: 0,
            errorsByType: new Map()
        };
    }

    /**
     * Reset circuit breaker
     * @param {string} circuitKey - Circuit to reset
     */
    resetCircuit(circuitKey) {
        if (this.circuits && this.circuits.has(circuitKey)) {
            const circuit = this.circuits.get(circuitKey);
            circuit.state = 'CLOSED';
            circuit.failures = 0;
            circuit.lastFailureTime = null;
            circuit.lastResetAttempt = null;
            console.log(`🔄 Circuit breaker ${circuitKey} manually reset`);
        }
    }

    /**
     * Get circuit breaker status
     * @param {string} circuitKey - Circuit to check
     * @returns {Object|null} Circuit status or null if not found
     */
    getCircuitStatus(circuitKey) {
        if (!this.circuits || !this.circuits.has(circuitKey)) {
            return null;
        }

        const circuit = this.circuits.get(circuitKey);
        return {
            state: circuit.state,
            failures: circuit.failures,
            successCount: circuit.successCount,
            totalRequests: circuit.totalRequests,
            failureRate: circuit.totalRequests > 0 ?
                circuit.failures / circuit.totalRequests : 0,
            lastFailureTime: circuit.lastFailureTime,
            lastResetAttempt: circuit.lastResetAttempt
        };
    }
}

module.exports = { RetryManager };