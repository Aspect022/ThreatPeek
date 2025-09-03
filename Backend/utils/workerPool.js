/**
 * Worker Pool Manager - Manages worker threads for parallel processing
 * Provides concurrent file scanning and pattern matching capabilities
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const os = require('os');

class WorkerPool {
    constructor(options = {}) {
        this.maxWorkers = options.maxWorkers || Math.min(os.cpus().length, 4);
        this.workerScript = options.workerScript || path.join(__dirname, 'scanWorker.js');
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.activeTasks = new Map();
        this.taskIdCounter = 0;
        this.isShuttingDown = false;

        // Performance monitoring
        this.stats = {
            tasksCompleted: 0,
            tasksQueued: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            workersCreated: 0,
            workersTerminated: 0
        };

        this.initializeWorkers();
    }

    /**
     * Initialize worker threads
     */
    async initializeWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            await this.createWorker();
        }
    }

    /**
     * Create a new worker thread
     */
    async createWorker() {
        return new Promise((resolve, reject) => {
            const worker = new Worker(this.workerScript);

            worker.on('message', (message) => {
                this.handleWorkerMessage(worker, message);
            });

            worker.on('error', (error) => {
                console.error(`Worker error:`, error);
                this.handleWorkerError(worker, error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                }
                this.handleWorkerExit(worker);
            });

            worker.on('online', () => {
                this.workers.push(worker);
                this.availableWorkers.push(worker);
                this.stats.workersCreated++;
                resolve(worker);
            });

            // Set timeout for worker initialization
            setTimeout(() => {
                if (!this.workers.includes(worker)) {
                    worker.terminate();
                    reject(new Error('Worker initialization timeout'));
                }
            }, 5000);
        });
    }

    /**
     * Handle message from worker
     */
    handleWorkerMessage(worker, message) {
        const { taskId, type, result, error } = message;

        if (type === 'taskComplete') {
            const task = this.activeTasks.get(taskId);
            if (task) {
                const processingTime = Date.now() - task.startTime;
                this.stats.totalProcessingTime += processingTime;
                this.stats.tasksCompleted++;
                this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.tasksCompleted;

                if (error) {
                    task.reject(new Error(error));
                } else {
                    task.resolve(result);
                }

                this.activeTasks.delete(taskId);
                this.makeWorkerAvailable(worker);
                this.processNextTask();
            }
        }
    }

    /**
     * Handle worker error
     */
    handleWorkerError(worker, error) {
        // Find and reject any active tasks for this worker
        for (const [taskId, task] of this.activeTasks.entries()) {
            if (task.worker === worker) {
                task.reject(error);
                this.activeTasks.delete(taskId);
            }
        }

        // Remove worker from available workers
        this.removeWorker(worker);

        // Create replacement worker if not shutting down
        if (!this.isShuttingDown) {
            this.createWorker().catch(err => {
                console.error('Failed to create replacement worker:', err);
            });
        }
    }

    /**
     * Handle worker exit
     */
    handleWorkerExit(worker) {
        this.removeWorker(worker);
        this.stats.workersTerminated++;

        // Create replacement worker if not shutting down
        if (!this.isShuttingDown && this.workers.length < this.maxWorkers) {
            this.createWorker().catch(err => {
                console.error('Failed to create replacement worker:', err);
            });
        }
    }

    /**
     * Remove worker from all tracking arrays
     */
    removeWorker(worker) {
        const workerIndex = this.workers.indexOf(worker);
        if (workerIndex !== -1) {
            this.workers.splice(workerIndex, 1);
        }

        const availableIndex = this.availableWorkers.indexOf(worker);
        if (availableIndex !== -1) {
            this.availableWorkers.splice(availableIndex, 1);
        }
    }

    /**
     * Make worker available for new tasks
     */
    makeWorkerAvailable(worker) {
        if (!this.availableWorkers.includes(worker)) {
            this.availableWorkers.push(worker);
        }
    }

    /**
     * Execute a task using worker threads
     * @param {string} taskType - Type of task to execute
     * @param {Object} taskData - Data for the task
     * @param {Object} options - Task options
     * @returns {Promise} Promise that resolves with task result
     */
    executeTask(taskType, taskData, options = {}) {
        return new Promise((resolve, reject) => {
            const taskId = ++this.taskIdCounter;
            const task = {
                taskId,
                taskType,
                taskData,
                options,
                resolve,
                reject,
                startTime: Date.now(),
                priority: options.priority || 0
            };

            this.taskQueue.push(task);
            this.stats.tasksQueued++;

            // Sort queue by priority (higher priority first)
            this.taskQueue.sort((a, b) => b.priority - a.priority);

            this.processNextTask();
        });
    }

    /**
     * Process the next task in the queue
     */
    processNextTask() {
        if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
            return;
        }

        const task = this.taskQueue.shift();
        const worker = this.availableWorkers.shift();

        task.worker = worker;
        this.activeTasks.set(task.taskId, task);

        // Send task to worker
        worker.postMessage({
            taskId: task.taskId,
            taskType: task.taskType,
            taskData: task.taskData,
            options: task.options
        });
    }

    /**
     * Execute multiple tasks in parallel
     * @param {Array} tasks - Array of task objects
     * @param {Object} options - Execution options
     * @returns {Promise<Array>} Promise that resolves with all results
     */
    async executeParallel(tasks, options = {}) {
        const { maxConcurrency = this.maxWorkers, timeout = 30000 } = options;

        // Limit concurrency
        const batches = [];
        for (let i = 0; i < tasks.length; i += maxConcurrency) {
            batches.push(tasks.slice(i, i + maxConcurrency));
        }

        const allResults = [];

        for (const batch of batches) {
            const batchPromises = batch.map(task =>
                this.executeTask(task.taskType, task.taskData, task.options)
            );

            // Add timeout to batch execution
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Batch execution timeout')), timeout);
            });

            try {
                const batchResults = await Promise.race([
                    Promise.allSettled(batchPromises),
                    timeoutPromise
                ]);

                allResults.push(...batchResults);
            } catch (error) {
                console.error('Batch execution error:', error);
                // Add failed results for this batch
                batch.forEach(() => {
                    allResults.push({ status: 'rejected', reason: error });
                });
            }
        }

        return allResults;
    }

    /**
     * Scan multiple files in parallel
     * @param {Array} filePaths - Array of file paths to scan
     * @param {Object} scanOptions - Scanning options
     * @returns {Promise<Array>} Array of scan results
     */
    async scanFilesParallel(filePaths, scanOptions = {}) {
        const tasks = filePaths.map(filePath => ({
            taskType: 'scanFile',
            taskData: { filePath, scanOptions },
            options: { priority: 1 }
        }));

        const results = await this.executeParallel(tasks, {
            maxConcurrency: this.maxWorkers,
            timeout: scanOptions.timeout || 30000
        });

        // Process results and filter out failures
        return results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(Boolean);
    }

    /**
     * Scan content in parallel chunks
     * @param {string} content - Content to scan
     * @param {Object} scanOptions - Scanning options
     * @returns {Promise<Array>} Array of pattern matches
     */
    async scanContentParallel(content, scanOptions = {}) {
        const chunkSize = scanOptions.chunkSize || 50000; // 50KB chunks
        const overlap = scanOptions.overlap || 1000; // 1KB overlap to catch patterns at boundaries

        if (content.length <= chunkSize) {
            // Content is small enough to scan in single thread
            return this.executeTask('scanContent', { content, scanOptions });
        }

        // Split content into overlapping chunks
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize - overlap) {
            const chunk = content.slice(i, i + chunkSize);
            chunks.push({
                taskType: 'scanContent',
                taskData: {
                    content: chunk,
                    scanOptions,
                    chunkOffset: i
                },
                options: { priority: 2 }
            });
        }

        const results = await this.executeParallel(chunks, {
            maxConcurrency: this.maxWorkers,
            timeout: scanOptions.timeout || 30000
        });

        // Merge results and remove duplicates from overlapping regions
        const allMatches = [];
        const seenMatches = new Set();

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                result.value.forEach(match => {
                    const matchKey = `${match.value}:${match.pattern.id}`;
                    if (!seenMatches.has(matchKey)) {
                        seenMatches.add(matchKey);
                        allMatches.push(match);
                    }
                });
            }
        });

        return allMatches;
    }

    /**
     * Get worker pool statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            activeWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            queuedTasks: this.taskQueue.length,
            activeTasks: this.activeTasks.size,
            maxWorkers: this.maxWorkers
        };
    }

    /**
     * Shutdown the worker pool
     * @param {number} timeout - Timeout for graceful shutdown
     * @returns {Promise} Promise that resolves when shutdown is complete
     */
    async shutdown(timeout = 5000) {
        this.isShuttingDown = true;

        // Clear task queue
        this.taskQueue.forEach(task => {
            task.reject(new Error('Worker pool shutting down'));
        });
        this.taskQueue = [];

        // Reject active tasks
        for (const task of this.activeTasks.values()) {
            task.reject(new Error('Worker pool shutting down'));
        }
        this.activeTasks.clear();

        // Terminate all workers
        const terminationPromises = this.workers.map(worker => {
            return new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    worker.terminate();
                    resolve();
                }, timeout);

                worker.on('exit', () => {
                    clearTimeout(timeoutId);
                    resolve();
                });

                worker.postMessage({ type: 'shutdown' });
            });
        });

        await Promise.all(terminationPromises);
        this.workers = [];
        this.availableWorkers = [];
    }
}

module.exports = { WorkerPool };