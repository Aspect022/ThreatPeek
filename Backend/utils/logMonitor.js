/**
 * Log Monitor Utility
 * Monitors log files in real-time and triggers alerts for anomalies
 */

const fs = require('fs');
const path = require('path');
const { forwardToN8n } = require('./n8nForwarder');
const { saveAnomalyNotification } = require('./webhookStorage');

class LogMonitor {
    constructor() {
        this.logFilePath = path.join(__dirname, '..', 'logs', 'notifications.log');
        this.lastPosition = 0;
        this.isMonitoring = false;
        this.watchInterval = null;
    }

    /**
     * Start monitoring the log file for new entries
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('[LOG_MONITOR] Already monitoring log file');
            return;
        }

        this.isMonitoring = true;
        console.log(`[LOG_MONITOR] Starting to monitor log file: ${this.logFilePath}`);

        // Check if log file exists, create if it doesn't
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, '', 'utf8');
            console.log('[LOG_MONITOR] Created log file');
        }

        // Get initial file size
        const stats = fs.statSync(this.logFilePath);
        this.lastPosition = stats.size;

        // Start watching the file
        this.watchInterval = setInterval(() => {
            this.checkForNewEntries();
        }, 1000); // Check every second

        console.log('[LOG_MONITOR] Log monitoring started');
    }

    /**
     * Stop monitoring the log file
     */
    stopMonitoring() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }
        this.isMonitoring = false;
        console.log('[LOG_MONITOR] Log monitoring stopped');
    }

    /**
     * Check for new entries in the log file
     */
    async checkForNewEntries() {
        try {
            // Check if file exists
            if (!fs.existsSync(this.logFilePath)) {
                return;
            }

            const stats = fs.statSync(this.logFilePath);
            
            // If file was truncated or rotated, reset position
            if (stats.size < this.lastPosition) {
                this.lastPosition = 0;
            }

            // If there are new entries
            if (stats.size > this.lastPosition) {
                const buffer = Buffer.alloc(stats.size - this.lastPosition);
                const fd = fs.openSync(this.logFilePath, 'r');
                fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
                fs.closeSync(fd);

                const newContent = buffer.toString('utf8');
                await this.processNewEntries(newContent);

                // Update last position
                this.lastPosition = stats.size;
            }
        } catch (error) {
            console.error('[LOG_MONITOR] Error checking for new log entries:', error.message);
        }
    }

    /**
     * Process new log entries
     * @param {string} content - New content from log file
     */
    async processNewEntries(content) {
        // Split content into lines
        const lines = content.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                
                // Check if this is an anomaly log entry
                if (logEntry.type === 'anomaly') {
                    await this.handleAnomalyLog(logEntry);
                }
            } catch (error) {
                // Skip lines that aren't valid JSON
                console.warn('[LOG_MONITOR] Skipping invalid log line:', line);
            }
        }
    }

    /**
     * Handle anomaly log entries
     * @param {Object} logEntry - The log entry object
     */
    async handleAnomalyLog(logEntry) {
        console.log('[LOG_MONITOR] Detected anomaly in logs:', logEntry);

        try {
            // Prepare anomaly notification for n8n
            const anomalyNotification = {
                timestamp: logEntry.timestamp,
                anomaly: 'log_anomaly_detected',
                severity: logEntry.severity,
                source: 'log_monitor',
                details: {
                    logType: logEntry.type,
                    message: logEntry.message,
                    logDetails: logEntry.details,
                    detectionSource: 'log_file_monitoring'
                }
            };

            // Save to webhook storage
            await saveAnomalyNotification(anomalyNotification);

            // Forward to n8n
            await forwardToN8n('anomaly-detected', anomalyNotification, {
                'x-event-type': 'log-anomaly',
                'x-source': 'log-monitor'
            });

            console.log('[LOG_MONITOR] Anomaly alert sent for log entry');
        } catch (error) {
            console.error('[LOG_MONITOR] Error handling anomaly log entry:', error.message);
        }
    }

    /**
     * Get current monitoring status
     * @returns {Object} Monitoring status
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            logFilePath: this.logFilePath,
            lastPosition: this.lastPosition,
            watchInterval: this.watchInterval ? 'active' : 'inactive'
        };
    }
}

// Export singleton instance
module.exports = new LogMonitor();
