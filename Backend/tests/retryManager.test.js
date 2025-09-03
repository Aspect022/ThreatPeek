/**
 * Retry Manager Tests - Test retry logic and error recovery mechanisms
 * Requirements: 7.2, 7.5
 */

const { RetryManager } = require('../utils/retryManager');

describe('RetryManager', () => {
    let retryManager;

    beforeEach(() => {
        retryManager = new RetryManager({
            maxRetries: 3,
            baseDelay: 100, // Shorter delays for testing
            maxDelay: 1000,
            backoffStrategy: 'exponential',
            jitter: false // Disable jitter for predictable tests
        });
    });

    afterEach(() => {
        retryManager.resetStats();
    });

    describe('Basic Retry Logic', () => {
        test('should succeed on first attempt', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(retryManager.getStats().totalRetries).toBe(0);
        });

        test('should retry on retryable errors', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn, {
                context: 'test-retry'
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
            expect(retryManager.getStats().totalRetries).toBe(2);
            expect(retryManager.getStats().successfulRetries).toBe(1);
        });

        test('should not retry on non-retryable errors', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Invalid input'));

            await expect(retryManager.executeWithRetry(mockFn)).rejects.toThrow('Invalid input');
            expect(mockFn).toHaveBeenCalledTimes(1);
            expect(retryManager.getStats().totalRetries).toBe(0);
        });

        test('should exhaust retries and throw final error', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            await expect(retryManager.executeWithRetry(mockFn, {
                context: 'test-exhausted'
            })).rejects.toThrow('Retry exhausted after 3 attempts for test-exhausted');

            expect(mockFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
            expect(retryManager.getStats().totalRetries).toBe(3);
            expect(retryManager.getStats().failedRetries).toBe(1);
        });
    });

    describe('Backoff Strategies', () => {
        test('should use exponential backoff', async () => {
            const delays = [];
            const mockFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            const startTime = Date.now();
            try {
                await retryManager.executeWithRetry(mockFn, {
                    baseDelay: 100,
                    backoffStrategy: 'exponential',
                    jitter: false, // Disable jitter for predictable tests
                    onRetry: async (error, attempt, delay) => {
                        delays.push(delay);
                    }
                });
            } catch (error) {
                // Expected to fail
            }

            expect(delays).toHaveLength(3);
            expect(delays[0]).toBe(100); // 100 * 2^0
            expect(delays[1]).toBe(200); // 100 * 2^1
            expect(delays[2]).toBe(400); // 100 * 2^2
        });

        test('should use linear backoff', async () => {
            const delays = [];
            const mockFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            try {
                await retryManager.executeWithRetry(mockFn, {
                    baseDelay: 100,
                    backoffStrategy: 'linear',
                    jitter: false, // Disable jitter for predictable tests
                    onRetry: async (error, attempt, delay) => {
                        delays.push(delay);
                    }
                });
            } catch (error) {
                // Expected to fail
            }

            expect(delays).toHaveLength(3);
            expect(delays[0]).toBe(100); // 100 * 1
            expect(delays[1]).toBe(200); // 100 * 2
            expect(delays[2]).toBe(300); // 100 * 3
        });

        test('should use fixed backoff', async () => {
            const delays = [];
            const mockFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            try {
                await retryManager.executeWithRetry(mockFn, {
                    baseDelay: 100,
                    backoffStrategy: 'fixed',
                    jitter: false, // Disable jitter for predictable tests
                    onRetry: async (error, attempt, delay) => {
                        delays.push(delay);
                    }
                });
            } catch (error) {
                // Expected to fail
            }

            expect(delays).toHaveLength(3);
            expect(delays[0]).toBe(100);
            expect(delays[1]).toBe(100);
            expect(delays[2]).toBe(100);
        });

        test('should respect maximum delay', async () => {
            const delays = [];
            const mockFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            try {
                await retryManager.executeWithRetry(mockFn, {
                    baseDelay: 1000,
                    maxDelay: 1500,
                    backoffStrategy: 'exponential',
                    jitter: false, // Disable jitter for predictable tests
                    onRetry: async (error, attempt, delay) => {
                        delays.push(delay);
                    }
                });
            } catch (error) {
                // Expected to fail
            }

            expect(delays).toHaveLength(3);
            expect(delays[0]).toBe(1000); // 1000 * 2^0
            expect(delays[1]).toBe(1500); // min(2000, 1500)
            expect(delays[2]).toBe(1500); // min(4000, 1500)
        });
    });

    describe('HTTP Error Handling', () => {
        test('should retry on 5xx HTTP errors', async () => {
            const error500 = new Error('Server Error');
            error500.response = { status: 500 };

            const error502 = new Error('Bad Gateway');
            error502.response = { status: 502 };

            const mockFn = jest.fn()
                .mockRejectedValueOnce(error500)
                .mockRejectedValueOnce(error502)
                .mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        test('should retry on 429 Too Many Requests', async () => {
            const error429 = new Error('Too Many Requests');
            error429.response = { status: 429 };

            const mockFn = jest.fn()
                .mockRejectedValueOnce(error429)
                .mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        test('should not retry on 4xx client errors (except 408, 429)', async () => {
            const error404 = new Error('Not Found');
            error404.response = { status: 404 };

            const mockFn = jest.fn().mockRejectedValue(error404);

            await expect(retryManager.executeWithRetry(mockFn)).rejects.toThrow('Not Found');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        test('should retry on 408 Request Timeout', async () => {
            const error408 = new Error('Request Timeout');
            error408.response = { status: 408 };

            const mockFn = jest.fn()
                .mockRejectedValueOnce(error408)
                .mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });

    describe('Custom Retry Conditions', () => {
        test('should use custom retry condition', async () => {
            const customError = new Error('Custom retryable error');
            const mockFn = jest.fn()
                .mockRejectedValueOnce(customError)
                .mockResolvedValue('success');

            const customRetryCondition = (error, attempt) => {
                return error.message.includes('Custom retryable');
            };

            const result = await retryManager.executeWithRetry(mockFn, {
                retryCondition: customRetryCondition
            });

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });

        test('should not retry when custom condition returns false', async () => {
            const customError = new Error('Custom non-retryable error');
            const mockFn = jest.fn().mockRejectedValue(customError);

            const customRetryCondition = (error, attempt) => {
                return error.message.includes('retryable') && !error.message.includes('non-retryable');
            };

            await expect(retryManager.executeWithRetry(mockFn, {
                retryCondition: customRetryCondition
            })).rejects.toThrow('Custom non-retryable error');

            expect(mockFn).toHaveBeenCalledTimes(1);
        });
    });

    describe('Parallel Execution with Retry', () => {
        test('should execute multiple functions with retry in parallel', async () => {
            const mockFn1 = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValue('result1');

            const mockFn2 = jest.fn()
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockResolvedValue('result2');

            const mockFn3 = jest.fn().mockResolvedValue('result3');

            const results = await retryManager.executeParallelWithRetry([
                mockFn1, mockFn2, mockFn3
            ]);

            expect(results).toEqual(['result1', 'result2', 'result3']);
            expect(mockFn1).toHaveBeenCalledTimes(2);
            expect(mockFn2).toHaveBeenCalledTimes(2);
            expect(mockFn3).toHaveBeenCalledTimes(1);
        });

        test('should handle partial failures with failFast=false', async () => {
            const mockFn1 = jest.fn().mockResolvedValue('result1');
            const mockFn2 = jest.fn().mockRejectedValue(new Error('Non-retryable error'));
            const mockFn3 = jest.fn().mockResolvedValue('result3');

            const results = await retryManager.executeParallelWithRetry([
                mockFn1, mockFn2, mockFn3
            ], { failFast: false });

            expect(results).toHaveLength(3);
            expect(results[0].status).toBe('fulfilled');
            expect(results[0].value).toBe('result1');
            expect(results[1].status).toBe('rejected');
            expect(results[1].reason.message).toContain('Non-retryable error');
            expect(results[2].status).toBe('fulfilled');
            expect(results[2].value).toBe('result3');
        });
    });

    describe('Circuit Breaker Pattern', () => {
        test('should open circuit after failure threshold', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            // Trigger failures to open circuit
            for (let i = 0; i < 5; i++) {
                try {
                    await retryManager.executeWithCircuitBreaker(mockFn, {
                        circuitKey: 'test-circuit',
                        failureThreshold: 5,
                        maxRetries: 0 // No retries to speed up test
                    });
                } catch (error) {
                    // Expected failures
                }
            }

            // Circuit should now be open
            await expect(retryManager.executeWithCircuitBreaker(mockFn, {
                circuitKey: 'test-circuit',
                failureThreshold: 5
            })).rejects.toThrow('Circuit breaker test-circuit is OPEN');

            const circuitStatus = retryManager.getCircuitStatus('test-circuit');
            expect(circuitStatus.state).toBe('OPEN');
            expect(circuitStatus.failures).toBe(5);
        });

        test('should reset circuit after timeout', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValue('success');

            // Open circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await retryManager.executeWithCircuitBreaker(mockFn, {
                        circuitKey: 'test-reset-circuit',
                        failureThreshold: 3,
                        resetTimeout: 100, // Short timeout for testing
                        maxRetries: 0
                    });
                } catch (error) {
                    // Expected failures
                }
            }

            // Wait for reset timeout
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should transition to HALF_OPEN and then CLOSED on success
            const result = await retryManager.executeWithCircuitBreaker(() => Promise.resolve('success'), {
                circuitKey: 'test-reset-circuit',
                failureThreshold: 3,
                resetTimeout: 100
            });

            expect(result).toBe('success');
            const circuitStatus = retryManager.getCircuitStatus('test-reset-circuit');
            expect(circuitStatus.state).toBe('CLOSED');
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should track retry statistics', async () => {
            // Create a fresh retry manager for this test
            const testRetryManager = new RetryManager({
                maxRetries: 3,
                baseDelay: 100,
                maxDelay: 1000,
                backoffStrategy: 'exponential',
                jitter: false
            });

            const mockFn1 = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValue('success');

            const mockFn2 = jest.fn()
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockResolvedValue('success');

            const mockFn3 = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

            await testRetryManager.executeWithRetry(mockFn1);
            await testRetryManager.executeWithRetry(mockFn2);

            try {
                await testRetryManager.executeWithRetry(mockFn3);
            } catch (error) {
                // Expected failure
            }

            const stats = testRetryManager.getStats();
            expect(stats.totalAttempts).toBeGreaterThanOrEqual(7); // At least 2 + 3 + 4 attempts
            expect(stats.totalRetries).toBeGreaterThanOrEqual(6); // At least 1 + 2 + 3 retries
            expect(stats.successfulRetries).toBe(2);
            expect(stats.failedRetries).toBe(1);
            expect(stats.errorsByType.ECONNRESET || 0).toBeGreaterThanOrEqual(4); // At least 1 + 3 occurrences
            expect(stats.errorsByType.ETIMEDOUT || 0).toBeGreaterThanOrEqual(2);
        });

        test('should calculate average retry delay', async () => {
            // Reset stats before test
            retryManager.resetStats();

            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValue('success');

            await retryManager.executeWithRetry(mockFn, {
                baseDelay: 100,
                backoffStrategy: 'fixed',
                jitter: false // Disable jitter for predictable tests
            });

            const stats = retryManager.getStats();
            expect(stats.averageRetryDelay).toBe(100);
        });
    });

    describe('Graceful Degradation', () => {
        test('should handle resource constraints gracefully', async () => {
            // Simulate resource constraint by limiting memory
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                rss: 1024 * 1024 * 1024, // 1GB
                heapTotal: 512 * 1024 * 1024, // 512MB
                heapUsed: 480 * 1024 * 1024, // 480MB (high usage)
                external: 0,
                arrayBuffers: 0
            });

            const mockFn = jest.fn().mockImplementation(() => {
                const memUsage = process.memoryUsage();
                if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
                    const error = new Error('Insufficient memory');
                    error.code = 'ENOMEM';
                    throw error;
                }
                return Promise.resolve('success');
            });

            // Should handle resource constraint error
            await expect(retryManager.executeWithRetry(mockFn, {
                retryCondition: (error, attempt) => {
                    // Don't retry on memory errors
                    return error.code !== 'ENOMEM';
                }
            })).rejects.toThrow('Insufficient memory');

            expect(mockFn).toHaveBeenCalledTimes(1);

            // Restore original function
            process.memoryUsage = originalMemoryUsage;
        });

        test('should provide partial results on partial failures', async () => {
            const functions = [
                () => Promise.resolve('success1'),
                () => Promise.reject(new Error('Non-retryable error')),
                () => Promise.resolve('success3'),
                () => {
                    const error = new Error('ECONNRESET');
                    return Promise.reject(error);
                }
            ];

            const results = await retryManager.executeParallelWithRetry(functions, {
                failFast: false,
                maxRetries: 1
            });

            expect(results).toHaveLength(4);
            expect(results[0].status).toBe('fulfilled');
            expect(results[0].value).toBe('success1');
            expect(results[1].status).toBe('rejected');
            expect(results[2].status).toBe('fulfilled');
            expect(results[2].value).toBe('success3');
            expect(results[3].status).toBe('rejected');
        });
    });

    describe('Error Recovery Mechanisms', () => {
        test('should call onRetry callback for custom recovery logic', async () => {
            const recoveryActions = [];
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockRejectedValueOnce(new Error('ETIMEDOUT'))
                .mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn, {
                onRetry: async (error, attempt, delay) => {
                    recoveryActions.push({
                        error: error.message,
                        attempt,
                        delay
                    });
                    // Simulate recovery action
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            });

            expect(result).toBe('success');
            expect(recoveryActions).toHaveLength(2);
            expect(recoveryActions[0].error).toBe('ECONNRESET');
            expect(recoveryActions[0].attempt).toBe(0);
            expect(recoveryActions[1].error).toBe('ETIMEDOUT');
            expect(recoveryActions[1].attempt).toBe(1);
        });

        test('should handle onRetry callback errors gracefully', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('ECONNRESET'))
                .mockResolvedValue('success');

            const result = await retryManager.executeWithRetry(mockFn, {
                onRetry: async (error, attempt, delay) => {
                    throw new Error('Recovery callback failed');
                }
            });

            // Should still succeed despite callback error
            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(2);
        });
    });
});