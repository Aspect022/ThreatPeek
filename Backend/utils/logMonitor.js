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

        // Process existing content first
        console.log('[LOG_MONITOR] Processing existing log content...');
        this.processExistingContent();

        // Get current file size for future monitoring
        const stats = fs.statSync(this.logFilePath);
        this.lastPosition = stats.size;
        console.log(`[LOG_MONITOR] Set lastPosition to current file size: ${this.lastPosition}`);

        // Start watching the file for new entries
        this.watchInterval = setInterval(() => {
            this.checkForNewEntries();
        }, 1000); // Check every second

        console.log('[LOG_MONITOR] Log monitoring started');
    }

    /**
     * Process existing content in the log file when monitoring starts
     */
    async processExistingContent() {
        try {
            const content = fs.readFileSync(this.logFilePath, 'utf8');
            if (content.trim() !== '') {
                console.log(`[LOG_MONITOR] Found existing content of ${content.length} characters`);
                await this.processNewEntries(content);
            } else {
                console.log('[LOG_MONITOR] No existing content to process');
            }
        } catch (error) {
            console.error('[LOG_MONITOR] Error processing existing content:', error.message);
        }
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
                console.log('[LOG_MONITOR] Log file does not exist');
                return;
            }

            const stats = fs.statSync(this.logFilePath);
            
            // If file was truncated or rotated, reset position
            if (stats.size < this.lastPosition) {
                console.log(`[LOG_MONITOR] Log file was truncated or rotated. Resetting position from ${this.lastPosition} to 0`);
                this.lastPosition = 0;
            }

            // If there are new entries
            if (stats.size > this.lastPosition) {
                console.log(`[LOG_MONITOR] Detected new content. Size: ${stats.size}, Last position: ${this.lastPosition}`);
                const buffer = Buffer.alloc(stats.size - this.lastPosition);
                const fd = fs.openSync(this.logFilePath, 'r');
                fs.readSync(fd, buffer, 0, buffer.length, this.lastPosition);
                fs.closeSync(fd);

                const newContent = buffer.toString('utf8');
                console.log(`[LOG_MONITOR] New content: ${newContent}`);
                await this.processNewEntries(newContent);

                // Update last position
                this.lastPosition = stats.size;
                console.log(`[LOG_MONITOR] Updated last position to: ${this.lastPosition}`);
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
        console.log(`[LOG_MONITOR] Processing new entries: ${content}`);
        // Split content into lines
        const lines = content.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            console.log(`[LOG_MONITOR] Processing line: ${line}`);
            try {
                const logEntry = JSON.parse(line);
                console.log(`[LOG_MONITOR] Parsed log entry:`, logEntry);
                
                // Check if this is an anomaly log entry
                if (logEntry.type === 'anomaly') {
                    console.log('[LOG_MONITOR] Found anomaly entry, handling it');
                    await this.handleAnomalyLog(logEntry);
                } else {
                    console.log(`[LOG_MONITOR] Entry is not an anomaly (type: ${logEntry.type})`);
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

            console.log('[LOG_MONITOR] Prepared anomaly notification:', anomalyNotification);

            // Save to webhook storage
            const savedPath = await saveAnomalyNotification(anomalyNotification);
            console.log('[LOG_MONITOR] Saved anomaly notification to:', savedPath);

            // Forward to n8n
            console.log('[LOG_MONITOR] Forwarding to n8n...');
            const result = await forwardToN8n('anomaly-detected', anomalyNotification, {
                'x-event-type': 'log-anomaly',
                'x-source': 'log-monitor'
            });
            
            console.log('[LOG_MONITOR] n8n forwarding result:', result);
            console.log('[LOG_MONITOR] Anomaly alert sent for log entry');
        } catch (error) {
            console.error('[LOG_MONITOR] Error handling anomaly log entry:', error.message);
            console.error('[LOG_MONITOR] Error stack:', error.stack);
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
