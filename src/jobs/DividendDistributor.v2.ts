/**
 * VegasCore Dividend Distributor V2 (Queue-Based)
 *
 * Refactored to use BullMQ job queue instead of Promise.all()
 * for scalable, fault-tolerant dividend distribution.
 * 
 * Key Changes:
 * - Producer enqueues syndicates into queue
 * - Worker processes jobs one at a time
 * - Transactions ensure atomicity per syndicate
 * - No RAM exhaustion even with 50k users
 */

import { logger } from '../utils/logger';
import { createDividendQueue, enqueueDividendDistribution, getDividendQueueMetrics } from '../queue/dividendQueue';
import type { Queue } from 'bullmq';
import type { DividendJobData } from '../queue/dividendQueue';

export class DividendDistributorV2 {
  private queue: Queue<DividendJobData>;
  private isRunning: boolean = false;
  private lastRun: any = null;
  private intervalId: any = null;

  constructor(
    private prisma: any,
    private redis: any,
    private io?: any
  ) {
    // Create queue instance
    const redisConnection = this.getRedisConnection();
    const { queue } = createDividendQueue(redisConnection);
    this.queue = queue;
  }

  /**
   * Convert Redis client to BullMQ connection config
   */
  private getRedisConnection() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const url = new URL(redisUrl);
    
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    };
  }

  /**
   * Main distribution job (Producer)
   * 
   * Instead of processing directly, enqueue all syndicates into the queue
   */
  async run() {
    if (this.isRunning) {
      logger.warn({
        type: 'dividend_distributor_already_running'
      }, 'Dividend distributor already running, skipping...');
      return { skipped: true };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info({
        type: 'dividend_distribution_initiated',
        triggeredBy: 'scheduled'
      }, 'Starting weekly dividend distribution via queue...');

      // Enqueue all syndicates for processing
      const result = await enqueueDividendDistribution(this.queue, this.prisma, 'scheduled');

      // Record job initiation
      this.lastRun = {
        timestamp: new Date(),
        duration: Date.now() - startTime,
        enqueuedCount: result.enqueuedCount,
        syndicates: result.syndicates
      };

      // Store in Redis for monitoring
      await this.redis.setex('job:dividend:last_run', 86400 * 7, JSON.stringify(this.lastRun));

      logger.info({
        type: 'dividend_distribution_enqueued',
        enqueuedCount: result.enqueuedCount,
        duration: Date.now() - startTime
      }, `Enqueued ${result.enqueuedCount} syndicates for dividend distribution`);

      // Broadcast global event
      if (this.io && result.enqueuedCount > 0) {
        this.io.emit('dividend_distribution_started', {
          enqueuedCount: result.enqueuedCount,
          estimatedCompletionMinutes: Math.ceil(result.enqueuedCount / 10) // ~10 syndicates per minute
        });
      }

      return {
        success: true,
        enqueuedCount: result.enqueuedCount,
        syndicates: result.syndicates
      };

    } catch (error) {
      logger.error({
        type: 'dividend_distribution_failed',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Failed to initiate dividend distribution');

      throw error;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if it's time to run (Sunday midnight UTC)
   */
  shouldRun(): boolean {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const hour = now.getUTCHours();

    // Run on Sunday between 00:00 and 00:59 UTC
    if (dayOfWeek !== 0 || hour !== 0) {
      return false;
    }

    // Check if already ran this week
    if (this.lastRun) {
      const msSinceLastRun = now.getTime() - this.lastRun.timestamp.getTime();
      const daysSinceLastRun = msSinceLastRun / (1000 * 60 * 60 * 24);
      if (daysSinceLastRun < 6) {
        return false; // Already ran within the week
      }
    }

    return true;
  }

  /**
   * Start the scheduler
   */
  start(intervalMs: number = 60000) {
    logger.info({
      type: 'dividend_distributor_started',
      version: 'v2-queue'
    }, 'Dividend distributor scheduler started (queue-based)');

    // Check every minute
    this.intervalId = setInterval(async () => {
      if (this.shouldRun()) {
        try {
          await this.run();
        } catch (error) {
          logger.error({
            type: 'dividend_scheduler_error',
            error: error instanceof Error ? error.message : String(error)
          }, 'Scheduled dividend run failed');
        }
      }
    }, intervalMs);

    // Also check on startup
    this.checkStartupRun();
  }

  /**
   * Check if we missed a run (e.g., server was down on Sunday)
   */
  async checkStartupRun() {
    const lastRunData = await this.redis.get('job:dividend:last_run');

    if (!lastRunData) {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();

      // If it's Sunday or early in the week, run now
      if (dayOfWeek >= 0 && dayOfWeek <= 2) {
        logger.info({
          type: 'dividend_missed_run_detected'
        }, 'No previous run found, executing now...');
        setTimeout(() => this.run(), 5000);
      }
      return;
    }

    const lastRun = JSON.parse(lastRunData);
    const lastRunDate = new Date(lastRun.timestamp);
    const now = new Date();

    // Check if more than 7 days since last run
    const daysSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastRun >= 7) {
      logger.info({
        type: 'dividend_missed_run_detected',
        daysSinceLastRun: Math.round(daysSinceLastRun)
      }, 'Missed scheduled run, executing now...');
      setTimeout(() => this.run(), 5000);
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info({
        type: 'dividend_distributor_stopped'
      }, 'Dividend distributor scheduler stopped');
    }
  }

  /**
   * Manual trigger (for admin use)
   */
  async triggerManual() {
    logger.info({
      type: 'dividend_manual_trigger'
    }, 'Manual dividend distribution triggered');
    
    return enqueueDividendDistribution(this.queue, this.prisma, 'manual');
  }

  /**
   * Get job status
   */
  async getStatus() {
    const queueMetrics = await getDividendQueueMetrics(this.queue);

    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextScheduledRun: this.getNextScheduledRun(),
      queueMetrics
    };
  }

  /**
   * Calculate next scheduled run time
   */
  getNextScheduledRun(): Date {
    const now = new Date();
    const nextSunday = new Date(now);

    // Find next Sunday
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(0, 0, 0, 0);

    return nextSunday;
  }
}

// Factory function
export function createDividendDistributorV2(prisma: any, redis: any, io?: any) {
  return new DividendDistributorV2(prisma, redis, io);
}

export default DividendDistributorV2;
