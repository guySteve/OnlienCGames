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
export declare const logger: pino.Logger<never, boolean>;
/**
 * Create child logger with additional context
 *
 * Usage:
 *   const userLogger = logger.child({ userId: '123' });
 *   userLogger.info('Action performed');
 */
export declare const createLogger: (context: Record<string, any>) => pino.Logger<never, boolean>;
/**
 * Log database query with duration
 */
export declare const logQuery: (query: string, durationMs: number, params?: any) => void;
/**
 * Log API request
 */
export declare const logRequest: (req: any) => void;
/**
 * Log API response with duration
 */
export declare const logResponse: (req: any, res: any, durationMs: number) => void;
/**
 * Log game event
 */
export declare const logGameEvent: (event: string, data: Record<string, any>) => void;
/**
 * Log financial transaction
 */
export declare const logTransaction: (userId: string, type: string, amount: number, metadata?: any) => void;
/**
 * Log job execution
 */
export declare const logJob: (jobName: string, status: "started" | "completed" | "failed", data?: any) => void;
/**
 * Express middleware for request logging
 */
export declare const requestLoggingMiddleware: (req: any, res: any, next: any) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map