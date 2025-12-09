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

import pino from 'pino';

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

const redactEmail = (email: string): string => {
  return email.replace(EMAIL_PATTERN, (_match, user, domain) => {
    const maskedUser = user.length > 2
      ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
      : '***';
    return `${maskedUser}@${domain}`;
  });
};

// Create logger instance
export const logger = pino({
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
export const createLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

/**
 * Log database query with duration
 */
export const logQuery = (query: string, durationMs: number, params?: any) => {
  logger.debug({
    type: 'database_query',
    query,
    duration_ms: durationMs,
    params: params || undefined
  }, 'Database query executed');
};

/**
 * Log API request
 */
export const logRequest = (req: any) => {
  logger.info({
    type: 'http_request',
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, `${req.method} ${req.path}`);
};

/**
 * Log API response with duration
 */
export const logResponse = (req: any, res: any, durationMs: number) => {
  const logData = {
    type: 'http_response',
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration_ms: durationMs,
    userId: req.user?.id
  };

  if (res.statusCode >= 500) {
    logger.error(logData, `${req.method} ${req.path} - ${res.statusCode}`);
  } else if (res.statusCode >= 400) {
    logger.warn(logData, `${req.method} ${req.path} - ${res.statusCode}`);
  } else {
    logger.info(logData, `${req.method} ${req.path} - ${res.statusCode}`);
  }
};

/**
 * Log game event
 */
export const logGameEvent = (event: string, data: Record<string, any>) => {
  logger.info({
    type: 'game_event',
    event,
    ...data
  }, `Game event: ${event}`);
};

/**
 * Log financial transaction
 */
export const logTransaction = (userId: string, type: string, amount: number, metadata?: any) => {
  logger.info({
    type: 'financial_transaction',
    userId,
    transactionType: type,
    amount,
    metadata
  }, `Transaction: ${type} - ${amount} chips`);
};

/**
 * Log job execution
 */
export const logJob = (jobName: string, status: 'started' | 'completed' | 'failed', data?: any) => {
  const logData = {
    type: 'job_execution',
    job: jobName,
    status,
    ...data
  };

  if (status === 'failed') {
    logger.error(logData, `Job failed: ${jobName}`);
  } else {
    logger.info(logData, `Job ${status}: ${jobName}`);
  }
};

/**
 * Express middleware for request logging
 */
export const requestLoggingMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  // Log request
  logRequest(req);
  
  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logResponse(req, res, duration);
  });
  
  next();
};

export default logger;
