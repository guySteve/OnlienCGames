/**
 * LockManager - Distributed Locking Service (VegasCore v5.0.0)
 *
 * PURPOSE: Prevents race conditions and split-brain scenarios in distributed systems.
 * Uses Redlock algorithm (Redis-based distributed lock) to ensure mutual exclusion
 * across multiple Node.js containers.
 *
 * WHY REDLOCK?
 * - Standard mutex/semaphore only works in single-process systems
 * - Redlock provides distributed consensus across N Redis instances
 * - Tolerates Redis failures (quorum-based)
 * - Prevents double-spend, duplicate actions, and state corruption
 *
 * CRITICAL USE CASES:
 * 1. Money operations (bet placement, chip deduction, payouts)
 * 2. Game state transitions (multiple containers serving same table)
 * 3. User balance updates (concurrent deposits/withdrawals)
 *
 * @see https://redis.io/docs/manual/patterns/distributed-locks/
 */
import { Lock } from 'redlock';
import { Redis } from 'ioredis';
/**
 * Lock acquisition result with strongly-typed metadata
 */
interface LockResult<T = void> {
    success: boolean;
    data?: T;
    error?: LockError;
    lockDuration?: number;
}
/**
 * Strongly-typed lock errors for client handling
 */
declare enum LockError {
    ACQUISITION_TIMEOUT = "LOCK_ACQUISITION_TIMEOUT",// Lock held by another process
    EXECUTION_ERROR = "LOCK_EXECUTION_ERROR",// Function threw error
    EXTENSION_FAILED = "LOCK_EXTENSION_FAILED",// TTL extension failed
    RELEASE_FAILED = "LOCK_RELEASE_FAILED"
}
/**
 * Configuration for lock behavior
 */
interface LockConfig {
    ttl: number;
    retryCount?: number;
    retryDelay?: number;
    retryJitter?: number;
}
/**
 * Default configurations for common scenarios
 */
declare const LOCK_PRESETS: {
    readonly FAST: {
        readonly ttl: 1000;
        readonly retryCount: 2;
        readonly retryDelay: 50;
        readonly retryJitter: 50;
    };
    readonly STANDARD: {
        readonly ttl: 5000;
        readonly retryCount: 3;
        readonly retryDelay: 200;
        readonly retryJitter: 100;
    };
    readonly LONG: {
        readonly ttl: 15000;
        readonly retryCount: 5;
        readonly retryDelay: 300;
        readonly retryJitter: 150;
    };
    readonly CRITICAL: {
        readonly ttl: 30000;
        readonly retryCount: 10;
        readonly retryDelay: 500;
        readonly retryJitter: 200;
    };
};
/**
 * LockManager - Production-grade distributed locking
 */
export declare class LockManager {
    private redlock;
    private metrics;
    /**
     * Initialize LockManager with Redis client(s)
     *
     * WHY MULTIPLE REDIS INSTANCES?
     * - Redlock requires odd number (3, 5, 7) for quorum
     * - Tolerates (N-1)/2 failures
     * - For production: 3+ Redis instances across availability zones
     * - For development: Single instance acceptable
     *
     * @param redisClients - Array of Redis clients (minimum 1, recommended 3+)
     */
    constructor(redisClients: Redis[]);
    /**
     * Execute function with distributed lock protection
     *
     * PATTERN: "Lock → Fetch → Execute → Save → Release"
     * This is the ONLY safe pattern for money operations in distributed systems.
     *
     * @param lockKey - Unique lock identifier (e.g., "user:123", "table:456")
     * @param fn - Async function to execute while holding lock
     * @param config - Lock configuration (use LOCK_PRESETS)
     * @returns Lock result with success status and data
     *
     * @example
     * ```typescript
     * const result = await lockManager.withLock(
     *   `user:${userId}:balance`,
     *   async () => {
     *     // 1. Fetch LATEST state from Redis
     *     const balance = await redis.get(`balance:${userId}`);
     *
     *     // 2. Execute business logic
     *     const newBalance = balance - betAmount;
     *     if (newBalance < 0) throw new Error('Insufficient funds');
     *
     *     // 3. Save state back to Redis
     *     await redis.set(`balance:${userId}`, newBalance);
     *
     *     return newBalance;
     *   },
     *   LOCK_PRESETS.CRITICAL
     * );
     *
     * if (!result.success) {
     *   // Handle lock failure (429 Too Many Requests)
     *   return { error: 'System busy, please retry' };
     * }
     * ```
     */
    withLock<T>(lockKey: string, fn: () => Promise<T>, config?: LockConfig): Promise<LockResult<T>>;
    /**
     * Extend lock TTL during long-running operations
     *
     * USE CASE: Hand resolution that exceeds initial TTL estimate
     *
     * @param lock - Active lock instance
     * @param additionalTtl - Additional milliseconds to extend
     */
    extendLock(lock: Lock, additionalTtl: number): Promise<boolean>;
    /**
     * Check if lock is currently held (non-blocking)
     *
     * USE CASE: UI feedback ("Table busy, please wait")
     *
     * @param lockKey - Lock identifier
     * @returns true if lock exists
     */
    isLocked(lockKey: string): Promise<boolean>;
    /**
     * Force release lock (DANGER: use only for emergency recovery)
     *
     * WARNING: Can cause race conditions if used improperly
     * Only use for manual intervention (admin tools, crash recovery)
     *
     * @param lockKey - Lock identifier
     */
    forceRelease(lockKey: string): Promise<void>;
    /**
     * Get lock metrics for monitoring
     */
    getMetrics(): {
        successRate: number;
        acquired: number;
        failed: number;
        avgDuration: number;
        maxDuration: number;
    };
    /**
     * Update internal metrics
     */
    private updateMetrics;
    /**
     * Graceful shutdown - release all locks
     */
    shutdown(): Promise<void>;
}
/**
 * Initialize global LockManager instance
 *
 * CALL THIS ONCE in server.js startup
 *
 * @param redisClients - Array of Redis clients
 */
export declare function initLockManager(redisClients: Redis[]): void;
/**
 * Get global LockManager instance
 *
 * @throws Error if not initialized
 */
export declare function getLockManager(): LockManager;
export { LOCK_PRESETS, LockError, LockResult, LockConfig };
//# sourceMappingURL=LockManager.d.ts.map