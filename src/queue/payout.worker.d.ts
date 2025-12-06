/**
 * Dividend Payout Worker (BullMQ Consumer)
 *
 * Dedicated worker process that consumes dividend distribution jobs from the queue.
 * Each job processes ONE syndicate's dividend payout with full transactional safety.
 *
 * Key Features:
 * - Transactional: If payout fails, rollback and retry automatically
 * - Isolated: Failures don't affect other syndicates
 * - Scalable: Can run multiple workers in parallel
 * - Observable: Full logging and metrics
 *
 * Run as: node -r ts-node/register src/queue/payout.worker.ts
 */
import { Worker } from 'bullmq';
import type { DividendJobData, DividendJobResult } from './dividendQueue';
/**
 * Create and start the worker
 */
export declare function createPayoutWorker(redisConnection: any, io?: any): Worker<DividendJobData, DividendJobResult, string>;
export default createPayoutWorker;
//# sourceMappingURL=payout.worker.d.ts.map