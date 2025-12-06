/**
 * Performance Instrumentation Utilities
 *
 * Tools for measuring execution time and identifying performance bottlenecks.
 * Critical for auto-scaling decisions and SLA monitoring.
 */
/**
 * Measure execution duration of a synchronous or asynchronous function
 *
 * Usage:
 *   const result = await measureDuration('calculateWin', () => gameEngine.calculateWin(bet));
 *   // Logs: "calculateWin completed in 45ms"
 */
export declare function measureDuration<T>(operationName: string, fn: () => T | Promise<T>, context?: Record<string, any>): Promise<T>;
/**
 * Class decorator for measuring all methods
 *
 * Usage:
 *   @InstrumentClass
 *   class GameEngine {
 *     calculateWin(bet) { ... }
 *   }
 */
export declare function InstrumentClass(constructor: Function): void;
/**
 * Method decorator for measuring individual methods
 *
 * Usage:
 *   class GameEngine {
 *     @Instrument
 *     calculateWin(bet) { ... }
 *   }
 */
export declare function Instrument(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor;
/**
 * Simple timer for manual tracking
 *
 * Usage:
 *   const timer = startTimer();
 *   // ... do work
 *   const duration = timer.stop();
 *   logger.info(`Operation took ${duration}ms`);
 */
export declare function startTimer(): {
    stop: () => number;
    elapsed: () => number;
};
/**
 * Track operation metrics (count, duration, errors)
 */
declare class MetricsTracker {
    private metrics;
    track(operation: string, durationMs: number, isError?: boolean): void;
    getMetrics(operation: string): {
        operation: string;
        count: number;
        avgDuration: number;
        minDuration: number;
        maxDuration: number;
        errorRate: number;
        errors: number;
    } | null;
    getAllMetrics(): any[];
    reset(): void;
    logSummary(): void;
}
export declare const metricsTracker: MetricsTracker;
/**
 * Auto-log metrics summary every N minutes
 */
export declare function startMetricsReporting(intervalMinutes?: number): void;
/**
 * Measure database operation duration
 */
export declare function measureDbOperation<T>(operation: string, fn: () => Promise<T>): Promise<T>;
/**
 * Measure game loop iteration
 */
export declare function measureGameLoop<T>(gameType: string, fn: () => Promise<T>): Promise<T>;
declare const _default: {
    measureDuration: typeof measureDuration;
    startTimer: typeof startTimer;
    measureDbOperation: typeof measureDbOperation;
    measureGameLoop: typeof measureGameLoop;
    metricsTracker: MetricsTracker;
    startMetricsReporting: typeof startMetricsReporting;
    InstrumentClass: typeof InstrumentClass;
    Instrument: typeof Instrument;
};
export default _default;
//# sourceMappingURL=performance.d.ts.map