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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggingMiddleware = exports.logJob = exports.logTransaction = exports.logGameEvent = exports.logResponse = exports.logRequest = exports.logQuery = exports.createLogger = exports.logger = void 0;
var pino_1 = __importDefault(require("pino"));
// Sensitive keys that should be redacted from logs
var SENSITIVE_KEYS = [
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
var EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
var redactEmail = function (email) {
    return email.replace(EMAIL_PATTERN, function (match, user, domain) {
        var maskedUser = user.length > 2
            ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
            : '***';
        return "".concat(maskedUser, "@").concat(domain);
    });
};
// Create logger instance
exports.logger = (0, pino_1.default)(__assign(__assign({ level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug') }, (process.env.NODE_ENV === 'production'
    ? {
        formatters: {
            level: function (label) {
                return { severity: label.toUpperCase() };
            },
            log: function (object) {
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
        timestamp: function () { return ",\"timestamp\":\"".concat(new Date().toISOString(), "\""); },
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
    })), { 
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
    } }));
/**
 * Create child logger with additional context
 *
 * Usage:
 *   const userLogger = logger.child({ userId: '123' });
 *   userLogger.info('Action performed');
 */
var createLogger = function (context) {
    return exports.logger.child(context);
};
exports.createLogger = createLogger;
/**
 * Log database query with duration
 */
var logQuery = function (query, durationMs, params) {
    exports.logger.debug({
        type: 'database_query',
        query: query,
        duration_ms: durationMs,
        params: params || undefined
    }, 'Database query executed');
};
exports.logQuery = logQuery;
/**
 * Log API request
 */
var logRequest = function (req) {
    var _a;
    exports.logger.info({
        type: 'http_request',
        method: req.method,
        path: req.path,
        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
    }, "".concat(req.method, " ").concat(req.path));
};
exports.logRequest = logRequest;
/**
 * Log API response with duration
 */
var logResponse = function (req, res, durationMs) {
    var _a;
    var logData = {
        type: 'http_response',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: durationMs,
        userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id
    };
    if (res.statusCode >= 500) {
        exports.logger.error(logData, "".concat(req.method, " ").concat(req.path, " - ").concat(res.statusCode));
    }
    else if (res.statusCode >= 400) {
        exports.logger.warn(logData, "".concat(req.method, " ").concat(req.path, " - ").concat(res.statusCode));
    }
    else {
        exports.logger.info(logData, "".concat(req.method, " ").concat(req.path, " - ").concat(res.statusCode));
    }
};
exports.logResponse = logResponse;
/**
 * Log game event
 */
var logGameEvent = function (event, data) {
    exports.logger.info(__assign({ type: 'game_event', event: event }, data), "Game event: ".concat(event));
};
exports.logGameEvent = logGameEvent;
/**
 * Log financial transaction
 */
var logTransaction = function (userId, type, amount, metadata) {
    exports.logger.info({
        type: 'financial_transaction',
        userId: userId,
        transactionType: type,
        amount: amount,
        metadata: metadata
    }, "Transaction: ".concat(type, " - ").concat(amount, " chips"));
};
exports.logTransaction = logTransaction;
/**
 * Log job execution
 */
var logJob = function (jobName, status, data) {
    var logData = __assign({ type: 'job_execution', job: jobName, status: status }, data);
    if (status === 'failed') {
        exports.logger.error(logData, "Job failed: ".concat(jobName));
    }
    else {
        exports.logger.info(logData, "Job ".concat(status, ": ").concat(jobName));
    }
};
exports.logJob = logJob;
/**
 * Express middleware for request logging
 */
var requestLoggingMiddleware = function (req, res, next) {
    var startTime = Date.now();
    // Log request
    (0, exports.logRequest)(req);
    // Capture response
    res.on('finish', function () {
        var duration = Date.now() - startTime;
        (0, exports.logResponse)(req, res, duration);
    });
    next();
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
exports.default = exports.logger;
