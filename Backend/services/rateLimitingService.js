/**
 * Rate Limiting Service - Configurable rate limiting for target server protection
 * Implements token bucket algorithm with burst capacity and backoff strategies
 */

const EventEmitter = require('events');

class RateLimitingService extends EventEmitter {
    constructor(options = {}) {
        super();

        // Default configuration
        this.defaultConfig = {
            requestsPerSecond: 10,
            burstLimit: 20,
            windowSizeMs: 1000,
            backoffStrategy: 'exponential', // 'linear', 'exponential', 'fixed'
            maxBackoffMs: 30000,
            baseBackoffMs: 1000,
            enableAdaptiveRateLimit: true,
            targetErrorRate: 0.05, // 5% error rate threshold
            adaptiveAdjustmentFactor: 0.8
        };

        this.config = { ...this.defaultConfig, ...options };

        // Rate limiting state per target
        this.limiters = new Map();

        // Global statistics
        this.globalStats = {
            totalRequests: 0,
            totalDelays: 0,
            totalBackoffs: 0,
            averageDelayMs: 0,
            adaptiveAdjustments: 0
        };

        // Cleanup interval for old limiters
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldLimiters();
        }, 60000); // Clean up every minute
    }

    /**
     * Get or create rate limiter for a target
     * @param {string} target - Target identifier (URL, domain, etc.)
     * @param {Object} customConfig - Custom configuration for this target
     * @returns {Object} Rate limiter instance
     */
    getLimiter(target, customConfig = {}) {
        if (!this.limiters.has(target)) {
            const limiterConfig = { ...this.config, ...customConfig };
            const limiter = {
                config: limiterConfig,
                tokens: limiterConfig.burstLimit,
                lastRefill: Date.now(),
                requestHistory: [],
                errorHistory: [],
                currentBackoffMs: 0,
                backoffUntil: 0,
                stats: {
                    totalRequests: 0,
                    successfulRequests: 0,
                    failedRequests: 0,
                    totalDelayMs: 0,
                    averageDelayMs: 0,
                    currentRateLimit: limiterConfig.requestsPerSecond,
                    adaptiveAdjustments: 0
                }
            };

            this.limiters.set(target, limiter);
        }

        return this.limiters.get(target);
    }

    /**
     * Check if request is allowed and calculate delay
     * @param {string} target - Target identifier
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Rate limit result
     */
    async checkRateLimit(target, options = {}) {
        const limiter = this.getLimiter(target, options.rateLimitConfig);
        const now = Date.now();

        // Check if we're in backoff period
        if (now < limiter.backoffUntil) {
            const backoffDelay = limiter.backoffUntil - now;
            return {
                allowed: false,
                delay: backoffDelay,
                reason: 'backoff',
                tokensRemaining: limiter.tokens,
                resetTime: limiter.backoffUntil
            };
        }

        // Refill tokens based on time elapsed
        this.refillTokens(limiter, now);

        // Check if we have tokens available
        if (limiter.tokens >= 1) {
            limiter.tokens -= 1;
            limiter.stats.totalRequests++;
            this.globalStats.totalRequests++;

            return {
                allowed: true,
                delay: 0,
                reason: 'allowed',
                tokensRemaining: limiter.tokens,
                resetTime: this.calculateResetTime(limiter, now)
            };
        }

        // Calculate delay until next token is available
        const delay = this.calculateDelay(limiter, now);

        return {
            allowed: false,
            delay,
            reason: 'rate_limit',
            tokensRemaining: limiter.tokens,
            resetTime: this.calculateResetTime(limiter, now)
        };
    }

    /**
     * Execute request with rate limiting
     * @param {string} target - Target identifier
     * @param {Function} requestFn - Function that makes the request
     * @param {Object} options - Execution options
     * @returns {Promise} Request result
     */
    async executeWithRateLimit(target, requestFn, options = {}) {
        const maxRetries = options.maxRetries || 3;
        let attempt = 0;
        let lastError;

        while (attempt <= maxRetries) {
            try {
                // Check rate limit
                const rateLimitResult = await this.checkRateLimit(target, options);

                if (!rateLimitResult.allowed) {
                    // Wait for the required delay
                    await this.delay(rateLimitResult.delay);
                    this.globalStats.totalDelays++;
                    this.globalStats.averageDelayMs =
                        (this.globalStats.averageDelayMs * (this.globalStats.totalDelays - 1) + rateLimitResult.delay) /
                        this.globalStats.totalDelays;

                    const limiter = this.getLimiter(target);
                    limiter.stats.totalDelayMs += rateLimitResult.delay;
                    limiter.stats.averageDelayMs =
                        limiter.stats.totalDelayMs / limiter.stats.totalRequests;
                }

                // Execute the request
                const startTime = Date.now();
                const result = await requestFn();
                const responseTime = Date.now() - startTime;

                // Record successful request
                this.recordSuccess(target, responseTime);

                return result;

            } catch (error) {
                lastError = error;
                attempt++;

                // Record failed request
                this.recordError(target, error);

                // Check if we should apply backoff
                if (this.shouldApplyBackoff(target, error)) {
                    await this.applyBackoff(target);
                }

                // Check if error is retryable
                if (attempt <= maxRetries && this.isRetryableError(error)) {
                    console.log(`Rate-limited request failed, retrying (${attempt}/${maxRetries}): ${error.message}`);
                    continue;
                }

                break;
            }
        }

        throw lastError;
    }

    /**
     * Refill tokens based on elapsed time
     * @param {Object} limiter - Rate limiter instance
     * @param {number} now - Current timestamp
     */
    refillTokens(limiter, now) {
        const timeSinceLastRefill = now - limiter.lastRefill;
        const tokensToAdd = (timeSinceLastRefill / 1000) * limiter.config.requestsPerSecond;

        limiter.tokens = Math.min(
            limiter.config.burstLimit,
            limiter.tokens + tokensToAdd
        );

        limiter.lastRefill = now;
    }

    /**
     * Calculate delay until next token is available
     * @param {Object} limiter - Rate limiter instance
     * @param {number} now - Current timestamp
     * @returns {number} Delay in milliseconds
     */
    calculateDelay(limiter, now) {
        const tokensNeeded = 1 - limiter.tokens;
        const timePerToken = 1000 / limiter.config.requestsPerSecond;
        return Math.ceil(tokensNeeded * timePerToken);
    }

    /**
     * Calculate when tokens will be fully replenished
     * @param {Object} limiter - Rate limiter instance
     * @param {number} now - Current timestamp
     * @returns {number} Reset timestamp
     */
    calculateResetTime(limiter, now) {
        const tokensToFill = limiter.config.burstLimit - limiter.tokens;
        const timePerToken = 1000 / limiter.config.requestsPerSecond;
        return now + (tokensToFill * timePerToken);
    }

    /**
     * Record successful request
     * @param {string} target - Target identifier
     * @param {number} responseTime - Response time in milliseconds
     */
    recordSuccess(target, responseTime) {
        const limiter = this.getLimiter(target);
        limiter.stats.successfulRequests++;

        // Add to request history for adaptive rate limiting
        limiter.requestHistory.push({
            timestamp: Date.now(),
            success: true,
            responseTime
        });

        // Keep only recent history (last 5 minutes)
        const fiveMinutesAgo = Date.now() - 300000;
        limiter.requestHistory = limiter.requestHistory.filter(
            req => req.timestamp > fiveMinutesAgo
        );

        // Apply adaptive rate limiting if enabled
        if (limiter.config.enableAdaptiveRateLimit) {
            this.adjustAdaptiveRateLimit(target);
        }

        this.emit('requestSuccess', { target, responseTime });
    }

    /**
     * Record failed request
     * @param {string} target - Target identifier
     * @param {Error} error - Error that occurred
     */
    recordError(target, error) {
        const limiter = this.getLimiter(target);
        limiter.stats.failedRequests++;

        // Add to error history
        limiter.errorHistory.push({
            timestamp: Date.now(),
            error: error.message,
            code: error.code,
            statusCode: error.response?.status
        });

        // Keep only recent error history (last 5 minutes)
        const fiveMinutesAgo = Date.now() - 300000;
        limiter.errorHistory = limiter.errorHistory.filter(
            err => err.timestamp > fiveMinutesAgo
        );

        // Apply adaptive rate limiting if enabled
        if (limiter.config.enableAdaptiveRateLimit) {
            this.adjustAdaptiveRateLimit(target);
        }

        this.emit('requestError', { target, error });
    }

    /**
     * Check if backoff should be applied
     * @param {string} target - Target identifier
     * @param {Error} error - Error that occurred
     * @returns {boolean} True if backoff should be applied
     */
    shouldApplyBackoff(target, error) {
        // Apply backoff for rate limiting errors
        if (error.response?.status === 429) {
            return true;
        }

        // Apply backoff for server errors
        if (error.response?.status >= 500) {
            return true;
        }

        // Apply backoff if error rate is too high
        const limiter = this.getLimiter(target);
        const recentRequests = limiter.requestHistory.length + limiter.errorHistory.length;
        const recentErrors = limiter.errorHistory.length;

        if (recentRequests > 10 && (recentErrors / recentRequests) > limiter.config.targetErrorRate) {
            return true;
        }

        return false;
    }

    /**
     * Apply backoff to target
     * @param {string} target - Target identifier
     */
    async applyBackoff(target) {
        const limiter = this.getLimiter(target);

        // Calculate backoff delay
        let backoffMs;
        switch (limiter.config.backoffStrategy) {
            case 'linear':
                backoffMs = limiter.config.baseBackoffMs * (limiter.stats.failedRequests || 1);
                break;
            case 'exponential':
                backoffMs = limiter.config.baseBackoffMs * Math.pow(2, limiter.stats.failedRequests || 1);
                break;
            case 'fixed':
                backoffMs = limiter.config.baseBackoffMs;
                break;
            default:
                backoffMs = limiter.config.baseBackoffMs;
        }

        // Apply maximum backoff limit
        backoffMs = Math.min(backoffMs, limiter.config.maxBackoffMs);

        limiter.currentBackoffMs = backoffMs;
        limiter.backoffUntil = Date.now() + backoffMs;

        this.globalStats.totalBackoffs++;

        console.log(`Applied ${backoffMs}ms backoff to target: ${target}`);
        this.emit('backoffApplied', { target, backoffMs });
    }

    /**
     * Adjust adaptive rate limiting based on recent performance
     * @param {string} target - Target identifier
     */
    adjustAdaptiveRateLimit(target) {
        const limiter = this.getLimiter(target);
        const recentRequests = limiter.requestHistory.length + limiter.errorHistory.length;
        const recentErrors = limiter.errorHistory.length;

        if (recentRequests < 10) {
            return; // Not enough data for adjustment
        }

        const errorRate = recentErrors / recentRequests;
        const currentRate = limiter.stats.currentRateLimit;

        if (errorRate > limiter.config.targetErrorRate) {
            // Too many errors, reduce rate limit
            const newRate = Math.max(1, currentRate * limiter.config.adaptiveAdjustmentFactor);
            if (newRate !== currentRate) {
                limiter.stats.currentRateLimit = newRate;
                limiter.config.requestsPerSecond = newRate;
                limiter.stats.adaptiveAdjustments++;
                this.globalStats.adaptiveAdjustments++;

                console.log(`Reduced rate limit for ${target}: ${currentRate} -> ${newRate} req/s`);
                this.emit('rateLimitAdjusted', { target, oldRate: currentRate, newRate, reason: 'high_error_rate' });
            }
        } else if (errorRate < limiter.config.targetErrorRate * 0.5) {
            // Low error rate, can potentially increase rate limit
            const maxIncrease = limiter.config.requestsPerSecond * 1.2; // Max 20% increase
            const newRate = Math.min(maxIncrease, currentRate / limiter.config.adaptiveAdjustmentFactor);
            if (newRate > currentRate) {
                limiter.stats.currentRateLimit = newRate;
                limiter.config.requestsPerSecond = newRate;
                limiter.stats.adaptiveAdjustments++;
                this.globalStats.adaptiveAdjustments++;

                console.log(`Increased rate limit for ${target}: ${currentRate} -> ${newRate} req/s`);
                this.emit('rateLimitAdjusted', { target, oldRate: currentRate, newRate, reason: 'low_error_rate' });
            }
        }
    }

    /**
     * Check if error is retryable
     * @param {Error} error - Error to check
     * @returns {boolean} True if retryable
     */
    isRetryableError(error) {
        const retryableStatusCodes = [429, 500, 502, 503, 504];
        const retryableErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];

        return (
            (error.response && retryableStatusCodes.includes(error.response.status)) ||
            (error.code && retryableErrorCodes.includes(error.code)) ||
            (error.message && error.message.toLowerCase().includes('timeout'))
        );
    }

    /**
     * Create delay promise
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get rate limiting statistics for a target
     * @param {string} target - Target identifier
     * @returns {Object|null} Statistics or null if target not found
     */
    getTargetStats(target) {
        const limiter = this.limiters.get(target);
        if (!limiter) return null;

        return {
            target,
            config: { ...limiter.config },
            stats: { ...limiter.stats },
            currentTokens: limiter.tokens,
            backoffUntil: limiter.backoffUntil,
            recentRequestCount: limiter.requestHistory.length,
            recentErrorCount: limiter.errorHistory.length,
            errorRate: limiter.requestHistory.length + limiter.errorHistory.length > 0 ?
                limiter.errorHistory.length / (limiter.requestHistory.length + limiter.errorHistory.length) : 0
        };
    }

    /**
     * Get global rate limiting statistics
     * @returns {Object} Global statistics
     */
    getGlobalStats() {
        return {
            ...this.globalStats,
            activeLimiters: this.limiters.size,
            totalTargets: this.limiters.size
        };
    }

    /**
     * Reset rate limiter for a target
     * @param {string} target - Target identifier
     */
    resetLimiter(target) {
        const limiter = this.limiters.get(target);
        if (limiter) {
            limiter.tokens = limiter.config.burstLimit;
            limiter.lastRefill = Date.now();
            limiter.requestHistory = [];
            limiter.errorHistory = [];
            limiter.currentBackoffMs = 0;
            limiter.backoffUntil = 0;
            limiter.stats.currentRateLimit = limiter.config.requestsPerSecond;

            console.log(`Reset rate limiter for target: ${target}`);
            this.emit('limiterReset', { target });
        }
    }

    /**
     * Clean up old limiters that haven't been used recently
     */
    cleanupOldLimiters() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        const toDelete = [];

        for (const [target, limiter] of this.limiters.entries()) {
            const lastActivity = Math.max(
                limiter.lastRefill,
                limiter.requestHistory.length > 0 ?
                    Math.max(...limiter.requestHistory.map(r => r.timestamp)) : 0,
                limiter.errorHistory.length > 0 ?
                    Math.max(...limiter.errorHistory.map(e => e.timestamp)) : 0
            );

            if (now - lastActivity > maxAge) {
                toDelete.push(target);
            }
        }

        toDelete.forEach(target => {
            this.limiters.delete(target);
            console.log(`Cleaned up old rate limiter for target: ${target}`);
        });

        if (toDelete.length > 0) {
            this.emit('limitersCleanedUp', { count: toDelete.length, targets: toDelete });
        }
    }

    /**
     * Shutdown the rate limiting service
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        this.limiters.clear();
        this.emit('shutdown');
    }
}

module.exports = { RateLimitingService };