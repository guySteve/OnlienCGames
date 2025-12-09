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

import Redlock, { Lock, Settings } from 'redlock';
import { Redis } from 'ioredis';

/**
 * Lock acquisition result with strongly-typed metadata
 */
interface LockResult<T = void> {
  success: boolean;
  data?: T;
  error?: LockError;
  lockDuration?: number; // milliseconds held
}

/**
 * Strongly-typed lock errors for client handling
 */
enum LockError {
  ACQUISITION_TIMEOUT = 'LOCK_ACQUISITION_TIMEOUT', // Lock held by another process
  EXECUTION_ERROR = 'LOCK_EXECUTION_ERROR',         // Function threw error
  EXTENSION_FAILED = 'LOCK_EXTENSION_FAILED',       // TTL extension failed
  RELEASE_FAILED = 'LOCK_RELEASE_FAILED'            // Lock release failed (orphaned)
}

/**
 * Configuration for lock behavior
 */
interface LockConfig {
  ttl: number;           // Lock time-to-live (ms). Should exceed function execution time
  retryCount?: number;   // Acquisition retry attempts (default: 3)
  retryDelay?: number;   // Delay between retries (ms, default: 200)
  retryJitter?: number;  // Random jitter to prevent thundering herd (ms, default: 100)
}

/**
 * Default configurations for common scenarios
 */
const LOCK_PRESETS = {
  // Quick operations (balance checks, state reads)
  FAST: { ttl: 1000, retryCount: 2, retryDelay: 50, retryJitter: 50 },

  // Standard game actions (hit, stand, bet placement)
  STANDARD: { ttl: 5000, retryCount: 3, retryDelay: 200, retryJitter: 100 },

  // Long-running operations (hand resolution, multi-step transactions)
  LONG: { ttl: 15000, retryCount: 5, retryDelay: 300, retryJitter: 150 },

  // Critical money operations (require extended timeout)
  CRITICAL: { ttl: 30000, retryCount: 10, retryDelay: 500, retryJitter: 200 }
} as const;

/**
 * LockManager - Production-grade distributed locking
 */
export class LockManager {
  private redlock: Redlock;
  private metrics: {
    acquired: number;
    failed: number;
    avgDuration: number;
    maxDuration: number;
  };

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
  constructor(redisClients: Redis[]) {
    // Validate input
    if (!redisClients || redisClients.length === 0) {
      throw new Error('LockManager requires at least one Redis client');
    }

    // Redlock settings optimized for low-latency casino operations
    const settings: Partial<Settings> = {
      // Clock drift compensation (milliseconds)
      // Accounts for clock skew between distributed servers
      driftFactor: 0.01,

      // Retry configuration (overridden per-lock)
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,

      // Automatic extension disabled (explicit extension required)
      automaticExtensionThreshold: 0
    };

    this.redlock = new Redlock(redisClients, settings);

    // Metrics tracking for monitoring/alerting
    this.metrics = {
      acquired: 0,
      failed: 0,
      avgDuration: 0,
      maxDuration: 0
    };

    // Error handling for Redlock library
    this.redlock.on('error', (error) => {
      console.error('🔒 Redlock error:', error);
    });

    console.log(`🔒 LockManager initialized with ${redisClients.length} Redis instance(s)`);
  }

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
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    config: LockConfig = LOCK_PRESETS.STANDARD
  ): Promise<LockResult<T>> {
    let lock: Lock | null = null;
    const startTime = Date.now();

    try {
      // STEP 1: Acquire distributed lock
      // This blocks if another process holds the lock
      lock = await this.redlock.acquire([`lock:${lockKey}`], config.ttl, {
        retryCount: config.retryCount ?? 3,
        retryDelay: config.retryDelay ?? 200,
        retryJitter: config.retryJitter ?? 100
      });

      console.log(`🔒 Lock acquired: ${lockKey} (TTL: ${config.ttl}ms)`);
      this.metrics.acquired++;

      // STEP 2: Execute protected function
      // This is where your business logic runs (fetch → compute → save)
      const result = await fn();

      // STEP 3: Calculate execution time
      const duration = Date.now() - startTime;
      this.updateMetrics(duration);

      // STEP 4: Release lock
      await lock.release();
      console.log(`🔓 Lock released: ${lockKey} (held ${duration}ms)`);

      return {
        success: true,
        data: result,
        lockDuration: duration
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.metrics.failed++;

      // Determine error type
      let lockError: LockError;
      if (error.name === 'ExecutionError') {
        lockError = LockError.EXECUTION_ERROR;
        console.error(`❌ Lock execution error for ${lockKey}:`, error.message);
      } else if (error.message?.includes('exceeded')) {
        lockError = LockError.ACQUISITION_TIMEOUT;
        console.warn(`⏱️ Lock acquisition timeout for ${lockKey} (held by another process)`);
      } else {
        lockError = LockError.EXECUTION_ERROR;
        console.error(`❌ Unknown lock error for ${lockKey}:`, error);
      }

      // CRITICAL: Always attempt to release lock, even on error
      // Prevents orphaned locks that block future requests
      if (lock) {
        try {
          await lock.release();
          console.log(`🔓 Lock released after error: ${lockKey}`);
        } catch (releaseError) {
          console.error(`🚨 CRITICAL: Failed to release lock ${lockKey}:`, releaseError);
          // Lock will expire after TTL, but this is suboptimal
        }
      }

      return {
        success: false,
        error: lockError,
        lockDuration: duration
      };
    }
  }

  /**
   * Extend lock TTL during long-running operations
   *
   * USE CASE: Hand resolution that exceeds initial TTL estimate
   *
   * @param lock - Active lock instance
   * @param additionalTtl - Additional milliseconds to extend
   */
  async extendLock(lock: Lock, additionalTtl: number): Promise<boolean> {
    try {
      await lock.extend(additionalTtl);
      console.log(`🔒 Lock extended by ${additionalTtl}ms`);
      return true;
    } catch (error) {
      console.error('❌ Lock extension failed:', error);
      return false;
    }
  }

  /**
   * Check if lock is currently held (non-blocking)
   *
   * USE CASE: UI feedback ("Table busy, please wait")
   *
   * @param lockKey - Lock identifier
   * @returns true if lock exists
   */
  async isLocked(lockKey: string): Promise<boolean> {
    try {
      // Attempt to acquire with 0 retries (fail fast)
      const lock = await this.redlock.acquire([`lock:${lockKey}`], 100, {
        retryCount: 0
      });

      // Lock acquired = was not held
      await lock.release();
      return false;
    } catch {
      // Lock acquisition failed = currently held
      return true;
    }
  }

  /**
   * Force release lock (DANGER: use only for emergency recovery)
   *
   * WARNING: Can cause race conditions if used improperly
   * Only use for manual intervention (admin tools, crash recovery)
   *
   * @param lockKey - Lock identifier
   */
  async forceRelease(lockKey: string): Promise<void> {
    try {
      await this.redlock.release({
        resources: [`lock:${lockKey}`],
        value: ''
      } as Lock);
      console.warn(`🚨 Force released lock: ${lockKey}`);
    } catch (error) {
      console.error(`❌ Force release failed for ${lockKey}:`, error);
    }
  }

  /**
   * Get lock metrics for monitoring
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.acquired / (this.metrics.acquired + this.metrics.failed)
    };
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(duration: number): void {
    this.metrics.avgDuration =
      (this.metrics.avgDuration * (this.metrics.acquired - 1) + duration) /
      this.metrics.acquired;

    if (duration > this.metrics.maxDuration) {
      this.metrics.maxDuration = duration;
    }
  }

  /**
   * Graceful shutdown - release all locks
   */
  async shutdown(): Promise<void> {
    console.log('🔒 LockManager shutting down...');
    await this.redlock.quit();
  }
}

/**
 * Singleton instance (initialized in server.js)
 */
let lockManagerInstance: LockManager | null = null;

/**
 * Initialize global LockManager instance
 *
 * CALL THIS ONCE in server.js startup
 *
 * @param redisClients - Array of Redis clients
 */
export function initLockManager(redisClients: Redis[]): void {
  if (lockManagerInstance) {
    console.warn('⚠️ LockManager already initialized');
    return;
  }
  lockManagerInstance = new LockManager(redisClients);
}

/**
 * Get global LockManager instance
 *
 * @throws Error if not initialized
 */
export function getLockManager(): LockManager {
  if (!lockManagerInstance) {
    throw new Error('LockManager not initialized. Call initLockManager() first.');
  }
  return lockManagerInstance;
}

// Export presets for convenience
export { LOCK_PRESETS, LockError, LockResult, LockConfig };
