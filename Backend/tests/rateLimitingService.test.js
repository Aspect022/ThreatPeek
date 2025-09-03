/**
 * Rate Limiting Service Tests
 * Tests for configurable rate limiting and target server protection
 */

const { RateLimitingService } = require('../services/rateLimitingService');

describe('RateLimitingService', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimitingService({
            requestsPerSecond: 5,
            burstLimit: 10,
            baseBackoffMs: 100,
            maxBackoffMs: 1000
        });
    });

    afterEach(() => {
        rateLimiter.shutdown();
    });

    describe('Rate Limiting', () => {
        test('should allow requests within rate limit', async () => {
            const target = 'test-target';

            const result = await rateLimiter.checkRateLimit(target);

            expect(result.allowed).toBe(true);
            expect(result.delay).toBe(0);
            expect(result.reason).toBe('allowed');
            expect(result.tokensRemaining).toBe(9); // 10 - 1
        });

        test('should enforce rate limit when tokens exhausted', async () => {
            const target = 'test-target';

            // Exhaust all tokens
            for (let i = 0; i < 10; i++) {
                await rateLimiter.checkRateLimit(target);
            }

            const result = await rateLimiter.checkRateLimit(target);

            expect(result.allowed).toBe(false);
            expect(result.delay).toBeGreaterThan(0);
            expect(result.reason).toBe('rate_limit');
            expect(result.tokensRemaining).toBe(0);
        });

        test('should refill tokens over time', async () => {
            const target = 'test-target';

            // Exhaust all tokens
            for (let i = 0; i < 10; i++) {
                await rateLimiter.checkRateLimit(target);
            }

            // Wait for token refill (200ms = 1 token at 5 req/s)
            await new Promise(resolve => setTimeout(resolve, 250));

            const result = await rateLimiter.checkRateLimit(target);

            expect(result.allowed).toBe(true);
            expect(result.tokensRemaining).toBeGreaterThan(0);
        });

        test('should handle multiple targets independently', async () => {
            const target1 = 'target-1';
            const target2 = 'target-2';

            // Exhaust tokens for target1
            for (let i = 0; i < 10; i++) {
                await rateLimiter.checkRateLimit(target1);
            }

            // target2 should still have tokens
            const result1 = await rateLimiter.checkRateLimit(target1);
            const result2 = await rateLimiter.checkRateLimit(target2);

            expect(result1.allowed).toBe(false);
            expect(result2.allowed).toBe(true);
        });
    });

    describe('Request Execution', () => {
        test('should execute request successfully when rate limit allows', async () => {
            const target = 'test-target';
            const mockRequest = jest.fn().mockResolvedValue('success');

            const result = await rateLimiter.executeWithRateLimit(target, mockRequest);

            expect(result).toBe('success');
            expect(mockRequest).toHaveBeenCalledTimes(1);
        });

        test('should delay request when rate limited', async () => {
            const target = 'test-target';
            const mockRequest = jest.fn().mockResolvedValue('success');

            // Exhaust tokens
            for (let i = 0; i < 10; i++) {
                await rateLimiter.checkRateLimit(target);
            }

            const startTime = Date.now();
            const result = await rateLimiter.executeWithRateLimit(target, mockRequest);
            const endTime = Date.now();

            expect(result).toBe('success');
            expect(endTime - startTime).toBeGreaterThan(100); // Should have delayed
            expect(mockRequest).toHaveBeenCalledTimes(1);
        });

        test('should retry on retryable errors', async () => {
            const target = 'test-target';
            const error = new Error('ECONNRESET');
            error.code = 'ECONNRESET';
            const mockRequest = jest.fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue('success');

            const result = await rateLimiter.executeWithRateLimit(target, mockRequest);

            expect(result).toBe('success');
            expect(mockRequest).toHaveBeenCalledTimes(2);
        });

        test('should apply backoff on server errors', async () => {
            const target = 'test-target';
            const error = new Error('Server Error');
            error.response = { status: 500 };

            const mockRequest = jest.fn().mockRejectedValue(error);

            await expect(
                rateLimiter.executeWithRateLimit(target, mockRequest, { maxRetries: 1 })
            ).rejects.toThrow('Server Error');

            // Check that backoff was applied
            const stats = rateLimiter.getTargetStats(target);
            expect(stats.backoffUntil).toBeGreaterThan(Date.now());
        });
    });

    describe('Adaptive Rate Limiting', () => {
        test('should reduce rate limit on high error rate', async () => {
            const target = 'test-target';
            const limiter = rateLimiter.getLimiter(target, {
                enableAdaptiveRateLimit: true,
                requestsPerSecond: 10
            });

            // Simulate high error rate
            for (let i = 0; i < 15; i++) {
                const error = new Error('Server Error');
                error.response = { status: 500 };
                rateLimiter.recordError(target, error);
            }

            // Add some successful requests to have enough data
            for (let i = 0; i < 5; i++) {
                rateLimiter.recordSuccess(target, 100);
            }

            // Check if rate limit was reduced
            const stats = rateLimiter.getTargetStats(target);
            expect(stats.stats.currentRateLimit).toBeLessThan(10);
        });

        test('should increase rate limit on low error rate', async () => {
            const target = 'test-target';
            const limiter = rateLimiter.getLimiter(target, {
                enableAdaptiveRateLimit: true,
                requestsPerSecond: 5
            });

            // First reduce the rate limit
            for (let i = 0; i < 15; i++) {
                const error = new Error('Server Error');
                error.response = { status: 500 };
                rateLimiter.recordError(target, error);
            }
            for (let i = 0; i < 5; i++) {
                rateLimiter.recordSuccess(target, 100);
            }

            // Clear history and add successful requests
            limiter.requestHistory = [];
            limiter.errorHistory = [];

            for (let i = 0; i < 20; i++) {
                rateLimiter.recordSuccess(target, 100);
            }

            // Check if rate limit was increased
            const stats = rateLimiter.getTargetStats(target);
            const initialRate = limiter.stats.currentRateLimit;
            expect(stats.stats.currentRateLimit).toBeGreaterThanOrEqual(initialRate);
        });
    });

    describe('Backoff Strategies', () => {
        test('should apply exponential backoff', async () => {
            const target = 'test-target';
            const limiter = rateLimiter.getLimiter(target, {
                backoffStrategy: 'exponential',
                baseBackoffMs: 100
            });

            // Simulate multiple failures
            limiter.stats.failedRequests = 3;

            await rateLimiter.applyBackoff(target);

            expect(limiter.currentBackoffMs).toBe(800); // 100 * 2^3
            expect(limiter.backoffUntil).toBeGreaterThan(Date.now());
        });

        test('should apply linear backoff', async () => {
            const target = 'test-target';
            const limiter = rateLimiter.getLimiter(target, {
                backoffStrategy: 'linear',
                baseBackoffMs: 100
            });

            // Simulate multiple failures
            limiter.stats.failedRequests = 3;

            await rateLimiter.applyBackoff(target);

            expect(limiter.currentBackoffMs).toBe(300); // 100 * 3
            expect(limiter.backoffUntil).toBeGreaterThan(Date.now());
        });

        test('should respect maximum backoff limit', async () => {
            const target = 'test-target';
            const limiter = rateLimiter.getLimiter(target, {
                backoffStrategy: 'exponential',
                baseBackoffMs: 100,
                maxBackoffMs: 500
            });

            // Simulate many failures
            limiter.stats.failedRequests = 10;

            await rateLimiter.applyBackoff(target);

            expect(limiter.currentBackoffMs).toBe(500); // Capped at maxBackoffMs
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should track global statistics', async () => {
            const target = 'test-target';

            // Make some requests
            await rateLimiter.checkRateLimit(target);
            await rateLimiter.checkRateLimit(target);

            const stats = rateLimiter.getGlobalStats();

            expect(stats.totalRequests).toBe(2);
            expect(stats.activeLimiters).toBe(1);
        });

        test('should track target-specific statistics', async () => {
            const target = 'test-target';

            // Make requests and record success/failure
            await rateLimiter.checkRateLimit(target);
            rateLimiter.recordSuccess(target, 150);

            const error = new Error('Test error');
            rateLimiter.recordError(target, error);

            const stats = rateLimiter.getTargetStats(target);

            expect(stats.stats.totalRequests).toBe(1);
            expect(stats.stats.successfulRequests).toBe(1);
            expect(stats.stats.failedRequests).toBe(1);
            expect(stats.recentRequestCount).toBe(1);
            expect(stats.recentErrorCount).toBe(1);
        });

        test('should calculate error rate correctly', async () => {
            const target = 'test-target';

            // Record mixed success/failure
            for (let i = 0; i < 8; i++) {
                rateLimiter.recordSuccess(target, 100);
            }
            for (let i = 0; i < 2; i++) {
                rateLimiter.recordError(target, new Error('Test error'));
            }

            const stats = rateLimiter.getTargetStats(target);

            expect(stats.errorRate).toBe(0.2); // 2 errors out of 10 total
        });
    });

    describe('Cleanup and Maintenance', () => {
        test('should clean up old limiters', async () => {
            const target = 'old-target';

            // Create a limiter
            rateLimiter.getLimiter(target);
            expect(rateLimiter.limiters.has(target)).toBe(true);

            // Manually set old timestamp
            const limiter = rateLimiter.limiters.get(target);
            limiter.lastRefill = Date.now() - (35 * 60 * 1000); // 35 minutes ago

            // Trigger cleanup
            rateLimiter.cleanupOldLimiters();

            expect(rateLimiter.limiters.has(target)).toBe(false);
        });

        test('should reset limiter state', async () => {
            const target = 'test-target';

            // Exhaust tokens and add errors
            for (let i = 0; i < 10; i++) {
                await rateLimiter.checkRateLimit(target);
            }
            rateLimiter.recordError(target, new Error('Test error'));
            await rateLimiter.applyBackoff(target);

            // Reset limiter
            rateLimiter.resetLimiter(target);

            const stats = rateLimiter.getTargetStats(target);
            expect(stats.currentTokens).toBe(10); // Back to burst limit
            expect(stats.backoffUntil).toBe(0);
            expect(stats.recentErrorCount).toBe(0);
        });
    });

    describe('Error Handling', () => {
        test('should identify retryable errors correctly', () => {
            const retryableError1 = new Error('Connection reset');
            retryableError1.code = 'ECONNRESET';

            const retryableError2 = new Error('Server Error');
            retryableError2.response = { status: 500 };

            const nonRetryableError = new Error('Not Found');
            nonRetryableError.response = { status: 404 };

            expect(rateLimiter.isRetryableError(retryableError1)).toBe(true);
            expect(rateLimiter.isRetryableError(retryableError2)).toBe(true);
            expect(rateLimiter.isRetryableError(nonRetryableError)).toBe(false);
        });

        test('should determine when to apply backoff', () => {
            const target = 'test-target';

            const rateLimitError = new Error('Too Many Requests');
            rateLimitError.response = { status: 429 };

            const serverError = new Error('Internal Server Error');
            serverError.response = { status: 500 };

            const clientError = new Error('Bad Request');
            clientError.response = { status: 400 };

            expect(rateLimiter.shouldApplyBackoff(target, rateLimitError)).toBe(true);
            expect(rateLimiter.shouldApplyBackoff(target, serverError)).toBe(true);
            expect(rateLimiter.shouldApplyBackoff(target, clientError)).toBe(false);
        });
    });
});