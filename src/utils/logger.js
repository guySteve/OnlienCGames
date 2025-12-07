"use strict";
/**
 * Structured Logging with Pino
 *
 * Enterprise-grade JSON logging with automatic redaction of sensitive data.
 * Replaces console.log for production environments.
 *
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 *   logger.error({ err }, 'Database connection failed');
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggingMiddleware = exports.logJob = exports.logTransaction = exports.logGameEvent = exports.logResponse = exports.logRequest = exports.logQuery = exports.createLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
// Sensitive keys that should be redacted from logs
const SENSITIVE_KEYS = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'privateKey',
    'private_key',
    'sessionId',
    'session_id',
    'creditCard',
    'credit_card',
    'ssn',
    'authorization',
    'cookie',
    'csrf',
    'xsrf'
];
// Email redaction pattern (partially mask emails)
const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const redactEmail = (email) => {
    return email.replace(EMAIL_PATTERN, (match, user, domain) => {
        const maskedUser = user.length > 2
            ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
            : '***';
        return `${maskedUser}@${domain}`;
    });
};
// Create logger instance
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    // Production: JSON output for Cloud Logging
    // Development: Pretty print for human readability
    ...(process.env.NODE_ENV === 'production'
        ? {
            formatters: {
                level: (label) => {
                    return { severity: label.toUpperCase() };
                },
                log: (object) => {
                    // Redact email fields
                    if (object.email && typeof object.email === 'string') {
                        object.email = redactEmail(object.email);
                    }
                    if (object.userEmail && typeof object.userEmail === 'string') {
                        object.userEmail = redactEmail(object.userEmail);
                    }
                    return object;
                }
            },
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            messageKey: 'message',
            errorKey: 'error'
        }
        : {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname',
                    singleLine: false
                }
            }
        }),
    // Redact sensitive fields
    redact: {
        paths: SENSITIVE_KEYS,
        censor: '[REDACTED]'
    },
    // Base context
    base: {
        service: 'moes-casino',
        version: process.env.APP_VERSION || '4.0.0',
        env: process.env.NODE_ENV || 'development'
    }
});
/**
 * Create child logger with additional context
 *
 * Usage:
 *   const userLogger = logger.child({ userId: '123' });
 *   userLogger.info('Action performed');
 */
const createLogger = (context) => {
    return exports.logger.child(context);
};
exports.createLogger = createLogger;
/**
 * Log database query with duration
 */
const logQuery = (query, durationMs, params) => {
    exports.logger.debug({
        type: 'database_query',
        query,
        duration_ms: durationMs,
        params: params || undefined
    }, 'Database query executed');
};
exports.logQuery = logQuery;
/**
 * Log API request
 */
const logRequest = (req) => {
    exports.logger.info({
        type: 'http_request',
        method: req.method,
        path: req.path,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
    }, `${req.method} ${req.path}`);
};
exports.logRequest = logRequest;
/**
 * Log API response with duration
 */
const logResponse = (req, res, durationMs) => {
    const logData = {
        type: 'http_response',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: durationMs,
        userId: req.user?.id
    };
    if (res.statusCode >= 500) {
        exports.logger.error(logData, `${req.method} ${req.path} - ${res.statusCode}`);
    }
    else if (res.statusCode >= 400) {
        exports.logger.warn(logData, `${req.method} ${req.path} - ${res.statusCode}`);
    }
    else {
        exports.logger.info(logData, `${req.method} ${req.path} - ${res.statusCode}`);
    }
};
exports.logResponse = logResponse;
/**
 * Log game event
 */
const logGameEvent = (event, data) => {
    exports.logger.info({
        type: 'game_event',
        event,
        ...data
    }, `Game event: ${event}`);
};
exports.logGameEvent = logGameEvent;
/**
 * Log financial transaction
 */
const logTransaction = (userId, type, amount, metadata) => {
    exports.logger.info({
        type: 'financial_transaction',
        userId,
        transactionType: type,
        amount,
        metadata
    }, `Transaction: ${type} - ${amount} chips`);
};
exports.logTransaction = logTransaction;
/**
 * Log job execution
 */
const logJob = (jobName, status, data) => {
    const logData = {
        type: 'job_execution',
        job: jobName,
        status,
        ...data
    };
    if (status === 'failed') {
        exports.logger.error(logData, `Job failed: ${jobName}`);
    }
    else {
        exports.logger.info(logData, `Job ${status}: ${jobName}`);
    }
};
exports.logJob = logJob;
/**
 * Express middleware for request logging
 */
const requestLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    // Log request
    (0, exports.logRequest)(req);
    // Capture response
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        (0, exports.logResponse)(req, res, duration);
    });
    next();
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map