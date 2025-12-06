/**
 * Performance Instrumentation Utilities
 * 
 * Tools for measuring execution time and identifying performance bottlenecks.
 * Critical for auto-scaling decisions and SLA monitoring.
 */

import { logger } from './logger';

/**
 * Measure execution duration of a synchronous or asynchronous function
 * 
 * Usage:
 *   const result = await measureDuration('calculateWin', () => gameEngine.calculateWin(bet));
 *   // Logs: "calculateWin completed in 45ms"
 */
export async function measureDuration<T>(
  operationName: string,
  fn: () => T | Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startTime);
    
    // Log performance metric
    logger.info({
      type: 'performance_metric',
      operation: operationName,
      duration_ms: durationMs,
      ...context
    }, `${operationName} completed in ${durationMs}ms`);
    
    // Warn if operation exceeds threshold
    if (durationMs > 200) {
      logger.warn({
        type: 'performance_warning',
        operation: operationName,
        duration_ms: durationMs,
        threshold_ms: 200,
        ...context
      }, `⚠️ ${operationName} exceeded 200ms threshold (${durationMs}ms)`);
    }
    
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    
    logger.error({
      type: 'performance_error',
      operation: operationName,
      duration_ms: durationMs,
      error: error instanceof Error ? error.message : String(error),
      ...context
    }, `${operationName} failed after ${durationMs}ms`);
    
    throw error;
  }
}

/**
 * Class decorator for measuring all methods
 * 
 * Usage:
 *   @InstrumentClass
 *   class GameEngine {
 *     calculateWin(bet) { ... }
 *   }
 */
export function InstrumentClass(constructor: Function) {
  const className = constructor.name;
  
  Object.getOwnPropertyNames(constructor.prototype).forEach((methodName) => {
    if (methodName === 'constructor') return;
    
    const originalMethod = constructor.prototype[methodName];
    if (typeof originalMethod !== 'function') return;
    
    constructor.prototype[methodName] = async function (...args: any[]) {
      return measureDuration(
        `${className}.${methodName}`,
        () => originalMethod.apply(this, args)
      );
    };
  });
}

/**
 * Method decorator for measuring individual methods
 * 
 * Usage:
 *   class GameEngine {
 *     @Instrument
 *     calculateWin(bet) { ... }
 *   }
 */
export function Instrument(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const className = target.constructor.name;
  
  descriptor.value = async function (...args: any[]) {
    return measureDuration(
      `${className}.${propertyKey}`,
      () => originalMethod.apply(this, args)
    );
  };
  
  return descriptor;
}

/**
 * Simple timer for manual tracking
 * 
 * Usage:
 *   const timer = startTimer();
 *   // ... do work
 *   const duration = timer.stop();
 *   logger.info(`Operation took ${duration}ms`);
 */
export function startTimer() {
  const startTime = performance.now();
  
  return {
    stop: () => Math.round(performance.now() - startTime),
    elapsed: () => Math.round(performance.now() - startTime)
  };
}

/**
 * Track operation metrics (count, duration, errors)
 */
class MetricsTracker {
  private metrics: Map<string, {
    count: number;
    totalDuration: number;
    errors: number;
    minDuration: number;
    maxDuration: number;
  }> = new Map();

  track(operation: string, durationMs: number, isError: boolean = false) {
    const current = this.metrics.get(operation) || {
      count: 0,
      totalDuration: 0,
      errors: 0,
      minDuration: Infinity,
      maxDuration: 0
    };

    current.count++;
    current.totalDuration += durationMs;
    if (isError) current.errors++;
    current.minDuration = Math.min(current.minDuration, durationMs);
    current.maxDuration = Math.max(current.maxDuration, durationMs);

    this.metrics.set(operation, current);
  }

  getMetrics(operation: string) {
    const metric = this.metrics.get(operation);
    if (!metric) return null;

    return {
      operation,
      count: metric.count,
      avgDuration: Math.round(metric.totalDuration / metric.count),
      minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
      maxDuration: metric.maxDuration,
      errorRate: metric.count > 0 ? (metric.errors / metric.count) * 100 : 0,
      errors: metric.errors
    };
  }

  getAllMetrics() {
    const results: any[] = [];
    this.metrics.forEach((_, operation) => {
      const metric = this.getMetrics(operation);
      if (metric) results.push(metric);
    });
    return results.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  reset() {
    this.metrics.clear();
  }

  logSummary() {
    const metrics = this.getAllMetrics();
    logger.info({
      type: 'performance_summary',
      metrics
    }, `Performance summary: ${metrics.length} operations tracked`);
  }
}

export const metricsTracker = new MetricsTracker();

/**
 * Auto-log metrics summary every N minutes
 */
export function startMetricsReporting(intervalMinutes: number = 5) {
  setInterval(() => {
    metricsTracker.logSummary();
  }, intervalMinutes * 60 * 1000);
}

/**
 * Measure database operation duration
 */
export async function measureDbOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startTime);
    
    metricsTracker.track(`db:${operation}`, durationMs, false);
    
    if (durationMs > 100) {
      logger.warn({
        type: 'slow_query',
        operation,
        duration_ms: durationMs
      }, `Slow database query: ${operation} (${durationMs}ms)`);
    }
    
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    metricsTracker.track(`db:${operation}`, durationMs, true);
    throw error;
  }
}

/**
 * Measure game loop iteration
 */
export async function measureGameLoop<T>(
  gameType: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startTime);
    
    metricsTracker.track(`game:${gameType}`, durationMs, false);
    
    // Critical: Game loop must stay under 200ms for responsive gameplay
    if (durationMs > 200) {
      logger.error({
        type: 'game_loop_lag',
        gameType,
        duration_ms: durationMs,
        threshold_ms: 200
      }, `🚨 Game loop lag detected: ${gameType} (${durationMs}ms)`);
    }
    
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    metricsTracker.track(`game:${gameType}`, durationMs, true);
    throw error;
  }
}

export default {
  measureDuration,
  startTimer,
  measureDbOperation,
  measureGameLoop,
  metricsTracker,
  startMetricsReporting,
  InstrumentClass,
  Instrument
};
