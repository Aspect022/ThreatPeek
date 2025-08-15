/**
 * Error Recovery Service - Provides error recovery mechanisms and graceful degradation
 * Handles partial scan failures and resource constraint recovery
 */

const { RetryManager } = require('../utils/retryManager');
const EventEmitter =