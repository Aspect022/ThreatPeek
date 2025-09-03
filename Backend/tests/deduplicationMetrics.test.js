/**
 * Unit tests for deduplication metrics and dashboard functionality
 */

const { DeduplicationMetrics } = require('../utils/deduplicationMetrics');
const { DeduplicationDashboard } = require('../utils/deduplicationDashboard');
const { DeduplicationLogger } = require('../utils/deduplicationLogger');
const { DeduplicationMonitor } = require('../utils/deduplicationMonitor');

describe('Deduplication Metrics and Dashboard', () => {
    let metrics;
    let logger;
    let monitor;
    let dashboard;

    beforeEach(() => {
        metrics = new DeduplicationMetrics({
            maxMetricsHistory: 100,
            maxTrendHistory: 50
        });

        logger = new DeduplicationLogger({
            enableConsoleLogging: false,
            enableFileLogging: false
        });

        monitor = new DeduplicationMonitor({
            enableAlerting: false,
            monitoringInterval: 0
        });

        dashboard = new DeduplicationDashboard(metrics, logger, monitor, {
            enableRealTimeUpdates: false
        });
    });

    describe('DeduplicationMetrics', () => {
        test('should record operations and calculate metrics', () => {
            const operationData = {
                type: 'file-level',
                totalFindings: 10,
                uniqueFindings: 8,
                duplicatesRemoved: 2,
                duration: 150,
                memoryUsage: 1024 * 1024,
                success: true
            };

            const operation = metrics.recordOperation(operationData);

            expect(operation).toBeDefined();
            expect(operation.duplicateRate).toBe(0.2); // 2/10
            expect(operation.throughput).toBeCloseTo(66.67, 1); // 10/(150/1000)

            const summary = metrics.getMetricsSummary();
            expect(summary.aggregated.totalOperations).toBe(1);
            expect(summary.aggregated.totalFindings).toBe(10);
            expect(summary.aggregated.totalDuplicatesRemoved).toBe(2);
            expect(summary.aggregated.averageDuplicateRate).toBe(0.2);
        });

        test('should track duplicate rate trends', () => {
            // Record operations with varying duplicate rates
            const operations = [
                { totalFindings: 10, duplicatesRemoved: 1, duration: 100 }, // 10% rate
                { totalFindings: 10, duplicatesRemoved: 3, duration: 120 }, // 30% rate
                { totalFindings: 10, duplicatesRemoved: 5, duration: 110 }, // 50% rate
            ];

            operations.forEach(op => metrics.recordOperation(op));

            const analysis = metrics.getDuplicateRateAnalysis();
            expect(analysis.averageRate).toBeCloseTo(0.3, 1); // (0.1 + 0.3 + 0.5) / 3
            expect(analysis.minRate).toBe(0.1);
            expect(analysis.maxRate).toBe(0.5);
            expect(analysis.dataPoints).toBe(3);
        });

        test('should analyze performance metrics', () => {
            const operations = [
                { totalFindings: 5, duplicatesRemoved: 1, duration: 100, memoryUsage: 1024 },
                { totalFindings: 10, duplicatesRemoved: 2, duration: 200, memoryUsage: 2048 },
                { totalFindings: 15, duplicatesRemoved: 3, duration: 150, memoryUsage: 1536 },
            ];

            operations.forEach(op => metrics.recordOperation(op));

            const analysis = metrics.getPerformanceAnalysis();
            expect(analysis.averageDuration).toBeCloseTo(150, 0);
            expect(analysis.minDuration).toBe(100);
            expect(analysis.maxDuration).toBe(200);
            expect(analysis.averageThroughput).toBeGreaterThan(0);
        });

        test('should record and analyze errors', () => {
            // Record some operations first
            metrics.recordOperation({ totalFindings: 10, duplicatesRemoved: 2, duration: 100 });
            metrics.recordOperation({ totalFindings: 5, duplicatesRemoved: 1, duration: 80 });

            // Record errors
            metrics.recordError({
                type: 'DeduplicationError',
                message: 'Test error 1',
                operationType: 'file-level',
                severity: 'warning'
            });

            metrics.recordError({
                type: 'TimeoutError',
                message: 'Test error 2',
                operationType: 'scan-level',
                severity: 'critical'
            });

            const analysis = metrics.getErrorAnalysis();
            expect(analysis.totalErrors).toBe(2);
            expect(analysis.totalOperations).toBe(2);
            expect(analysis.errorRate).toBe(1); // 2 errors / 2 operations
            expect(analysis.errorsByType).toEqual({
                'DeduplicationError': 1,
                'TimeoutError': 1
            });
        });

        test('should calculate trends correctly', () => {
            // Create increasing trend
            const increasingData = [
                { timestamp: 1000, value: 10 },
                { timestamp: 2000, value: 20 },
                { timestamp: 3000, value: 30 },
                { timestamp: 4000, value: 40 }
            ];

            const increasingTrend = metrics.calculateTrend(increasingData);
            expect(increasingTrend).toBe('increasing');

            // Create decreasing trend
            const decreasingData = [
                { timestamp: 1000, value: 40 },
                { timestamp: 2000, value: 30 },
                { timestamp: 3000, value: 20 },
                { timestamp: 4000, value: 10 }
            ];

            const decreasingTrend = metrics.calculateTrend(decreasingData);
            expect(decreasingTrend).toBe('decreasing');

            // Create stable trend
            const stableData = [
                { timestamp: 1000, value: 25 },
                { timestamp: 2000, value: 25 },
                { timestamp: 3000, value: 25 },
                { timestamp: 4000, value: 25 }
            ];

            const stableTrend = metrics.calculateTrend(stableData);
            expect(stableTrend).toBe('stable');
        });

        test('should generate insights based on metrics', () => {
            // Create high duplicate rate scenario
            const highDuplicateOps = Array(5).fill().map(() => ({
                totalFindings: 10,
                duplicatesRemoved: 6, // 60% duplicate rate
                duration: 100
            }));

            highDuplicateOps.forEach(op => metrics.recordOperation(op));

            const summary = metrics.getMetricsSummary();
            const insights = summary.insights;

            expect(insights.length).toBeGreaterThan(0);
            const duplicateRateInsight = insights.find(i => i.type === 'duplicate_rate');
            expect(duplicateRateInsight).toBeDefined();
            expect(duplicateRateInsight.severity).toBe('warning');
        });

        test('should export metrics in different formats', () => {
            metrics.recordOperation({
                totalFindings: 10,
                duplicatesRemoved: 2,
                duration: 100
            });

            // Test JSON export
            const jsonExport = metrics.exportMetrics('json');
            expect(() => JSON.parse(jsonExport)).not.toThrow();

            // Test CSV export
            const csvExport = metrics.exportMetrics('csv');
            expect(csvExport).toContain('timestamp,type,totalFindings');
            expect(csvExport.split('\n').length).toBeGreaterThan(1);
        });

        test('should calculate percentiles correctly', () => {
            const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

            expect(metrics.getPercentile(values, 50)).toBe(5.5); // Median
            expect(metrics.getPercentile(values, 25)).toBe(3.25); // Q1
            expect(metrics.getPercentile(values, 75)).toBe(7.75); // Q3
        });

        test('should limit array sizes correctly', () => {
            const testArray = [1, 2, 3, 4, 5];
            metrics.limitArraySize(testArray, 3);
            expect(testArray).toEqual([3, 4, 5]);
        });

        test('should reset metrics correctly', () => {
            metrics.recordOperation({
                totalFindings: 10,
                duplicatesRemoved: 2,
                duration: 100
            });

            expect(metrics.aggregatedStats.totalOperations).toBe(1);

            metrics.reset();

            expect(metrics.aggregatedStats.totalOperations).toBe(0);
            expect(metrics.metrics.operations.length).toBe(0);
        });
    });

    describe('DeduplicationDashboard', () => {
        test('should generate dashboard header', () => {
            const header = dashboard.generateDashboardHeader();
            expect(header).toContain('DEDUPLICATION DASHBOARD');
            expect(header).toContain('Last Update:');
        });

        test('should generate overview section', () => {
            // Add some test data
            metrics.recordOperation({
                totalFindings: 100,
                duplicatesRemoved: 20,
                duration: 500
            });

            const overview = dashboard.generateOverviewSection();
            expect(overview).toContain('OVERVIEW');
            expect(overview).toContain('Total Operations:');
            expect(overview).toContain('100'); // Total findings
        });

        test('should generate performance section', () => {
            metrics.recordOperation({
                totalFindings: 50,
                duplicatesRemoved: 10,
                duration: 300,
                memoryUsage: 1024 * 1024
            });

            const performance = dashboard.generatePerformanceSection();
            expect(performance).toContain('PERFORMANCE');
            expect(performance).toContain('Average Duration:');
            expect(performance).toContain('300ms');
        });

        test('should get correct trend icons', () => {
            expect(dashboard.getTrendIcon('increasing')).toContain('📈');
            expect(dashboard.getTrendIcon('decreasing')).toContain('📉');
            expect(dashboard.getTrendIcon('stable')).toContain('➡️');
        });

        test('should get correct severity icons', () => {
            expect(dashboard.getSeverityIcon('critical')).toBe('🔴');
            expect(dashboard.getSeverityIcon('warning')).toBe('🟡');
            expect(dashboard.getSeverityIcon('info')).toBe('🔵');
        });

        test('should determine duplicate rate status correctly', () => {
            expect(dashboard.getDuplicateRateStatus(0.6)).toContain('Critical');
            expect(dashboard.getDuplicateRateStatus(0.4)).toContain('Warning');
            expect(dashboard.getDuplicateRateStatus(0.1)).toContain('Good');
        });

        test('should determine error rate status correctly', () => {
            expect(dashboard.getErrorRateStatus(0.3)).toContain('Critical');
            expect(dashboard.getErrorRateStatus(0.15)).toContain('Warning');
            expect(dashboard.getErrorRateStatus(0.05)).toContain('Good');
        });

        test('should format duration correctly', () => {
            expect(dashboard.formatDuration(1000)).toBe('1s');
            expect(dashboard.formatDuration(65000)).toBe('1m 5s');
            expect(dashboard.formatDuration(3665000)).toBe('1h 1m');
        });

        test('should generate summary report', () => {
            metrics.recordOperation({
                totalFindings: 100,
                duplicatesRemoved: 25,
                duration: 400
            });

            const report = dashboard.generateSummaryReport();
            expect(report).toContain('DEDUPLICATION SUMMARY REPORT');
            expect(report).toContain('OVERVIEW:');
            expect(report).toContain('PERFORMANCE');
            expect(report).toContain('100'); // Total findings
        });

        test('should export data in different formats', () => {
            metrics.recordOperation({
                totalFindings: 50,
                duplicatesRemoved: 10,
                duration: 200
            });

            const jsonExport = dashboard.exportData('json');
            expect(() => JSON.parse(jsonExport)).not.toThrow();

            const csvExport = dashboard.exportData('csv');
            expect(csvExport).toContain('timestamp,type,totalFindings');

            const reportExport = dashboard.exportData('report');
            expect(reportExport).toContain('DEDUPLICATION SUMMARY REPORT');
        });

        test('should start and stop dashboard correctly', () => {
            expect(dashboard.isRunning).toBe(false);

            dashboard.start();
            expect(dashboard.isRunning).toBe(true);

            dashboard.stop();
            expect(dashboard.isRunning).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        test('should integrate metrics with logger and monitor', () => {
            // Record operation in metrics
            metrics.recordOperation({
                type: 'integration-test',
                totalFindings: 20,
                duplicatesRemoved: 5,
                duration: 250,
                success: true
            });

            // Record operation in monitor
            monitor.recordOperation({
                type: 'integration-test',
                duration: 250,
                findingsProcessed: 20,
                duplicatesRemoved: 5,
                success: true
            });

            // Log operation
            logger.logOperationComplete('integration-test', {
                totalFindings: 20,
                uniqueFindings: 15,
                duplicatesRemoved: 5,
                deduplicationRate: '25%'
            }, 250);

            // Verify data consistency
            const metricsSummary = metrics.getMetricsSummary();
            const monitorMetrics = monitor.getMetrics();
            const loggerMetrics = logger.getMetrics();

            expect(metricsSummary.aggregated.totalOperations).toBe(1);
            expect(monitorMetrics.operations.total).toBe(1);
            expect(loggerMetrics.performance.totalOperations).toBeGreaterThan(0);
        });

        test('should handle high-volume metrics collection', () => {
            const startTime = Date.now();

            // Generate 1000 operations
            for (let i = 0; i < 1000; i++) {
                metrics.recordOperation({
                    type: 'volume-test',
                    totalFindings: Math.floor(Math.random() * 100) + 1,
                    duplicatesRemoved: Math.floor(Math.random() * 20),
                    duration: Math.floor(Math.random() * 1000) + 50
                });
            }

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Should process 1000 operations quickly
            expect(processingTime).toBeLessThan(1000); // Less than 1 second

            const summary = metrics.getMetricsSummary();
            expect(summary.aggregated.totalOperations).toBe(1000);
            expect(summary.duplicateRates.mediumTerm.dataPoints).toBeGreaterThan(0);
        });

        test('should provide real-time insights', () => {
            // Simulate problematic scenario
            const problematicOps = [
                { totalFindings: 100, duplicatesRemoved: 60, duration: 3000 }, // High duplicates, slow
                { totalFindings: 80, duplicatesRemoved: 50, duration: 2500 },  // High duplicates, slow
                { totalFindings: 120, duplicatesRemoved: 70, duration: 3500 }  // High duplicates, slow
            ];

            problematicOps.forEach(op => {
                metrics.recordOperation(op);
                monitor.recordOperation({
                    ...op,
                    findingsProcessed: op.totalFindings,
                    success: true
                });
            });

            const summary = metrics.getMetricsSummary();
            const insights = summary.insights;

            // Should detect high duplicate rate
            const duplicateInsight = insights.find(i => i.type === 'duplicate_rate');
            expect(duplicateInsight).toBeDefined();

            // Should detect performance issues
            const performanceInsight = insights.find(i => i.type === 'performance');
            expect(performanceInsight).toBeDefined();
        });
    });
});