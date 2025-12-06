/**
 * Dividend Distribution Queue (BullMQ)
 *
 * Scalable, Redis-backed job queue for processing syndicate dividend payouts.
 * Prevents RAM exhaustion by processing one syndicate at a time with automatic retry.
 *
 * Architecture:
 * - Producer: Enqueues all syndicates into the queue
 * - Consumer: Worker processes jobs one by one with transactional safety
 * - Redis: Acts as the persistent queue backend
 */
import { Queue, QueueEvents } from 'bullmq';
export interface DividendJobData {
    syndicateId: string;
    syndicateName: string;
    treasuryBalance: bigint;
    totalMembers: number;
    triggeredBy: 'scheduled' | 'manual';
    timestamp: Date;
}
export interface DividendJobResult {
    success: boolean;
    syndicateId: string;
    syndicateName: string;
    totalAmount?: bigint;
    amountPerMember?: bigint;
    eligibleMembers?: number;
    error?: string;
}
/**
 * Create Dividend Distribution Queue
 */
export declare function createDividendQueue(redisConnection: any): {
    queue: Queue<DividendJobData, any, string, DividendJobData, any, string>;
    queueEvents: QueueEvents;
};
/**
 * Enqueue all syndicates for dividend distribution
 *
 * Called by DividendDistributor on Sunday midnight or manual trigger
 */
export declare function enqueueDividendDistribution(queue: Queue<DividendJobData>, prisma: any, triggeredBy?: 'scheduled' | 'manual'): Promise<{
    success: boolean;
    enqueuedCount: number;
    syndicates: any;
}>;
/**
 * Get queue metrics for monitoring
 */
export declare function getDividendQueueMetrics(queue: Queue<DividendJobData>): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
}>;
/**
 * Clean up old jobs
 */
export declare function cleanDividendQueue(queue: Queue<DividendJobData>): Promise<void>;
declare const _default: {
    createDividendQueue: typeof createDividendQueue;
    enqueueDividendDistribution: typeof enqueueDividendDistribution;
    getDividendQueueMetrics: typeof getDividendQueueMetrics;
    cleanDividendQueue: typeof cleanDividendQueue;
};
export default _default;
//# sourceMappingURL=dividendQueue.d.ts.map