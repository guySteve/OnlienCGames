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
export declare class DividendDistributorV2 {
    private prisma;
    private redis;
    private syndicateService;
    private io?;
    private queue;
    private queueEvents;
    private isRunning;
    private lastRun;
    private intervalId;
    constructor(prisma: any, redis: any, syndicateService: any, io?: any | undefined);
    /**
     * Convert Redis client to BullMQ connection config
     */
    private getRedisConnection;
    /**
     * Main distribution job (Producer)
     *
     * Instead of processing directly, enqueue all syndicates into the queue
     */
    run(): Promise<{
        skipped: boolean;
        success?: undefined;
        enqueuedCount?: undefined;
        syndicates?: undefined;
    } | {
        success: boolean;
        enqueuedCount: number;
        syndicates: any;
        skipped?: undefined;
    }>;
    /**
     * Check if it's time to run (Sunday midnight UTC)
     */
    shouldRun(): boolean;
    /**
     * Start the scheduler
     */
    start(intervalMs?: number): void;
    /**
     * Check if we missed a run (e.g., server was down on Sunday)
     */
    checkStartupRun(): Promise<void>;
    /**
     * Stop the scheduler
     */
    stop(): void;
    /**
     * Manual trigger (for admin use)
     */
    triggerManual(): Promise<{
        success: boolean;
        enqueuedCount: number;
        syndicates: any;
    }>;
    /**
     * Get job status
     */
    getStatus(): Promise<{
        isRunning: boolean;
        lastRun: any;
        nextScheduledRun: Date;
        queueMetrics: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            total: number;
        };
    }>;
    /**
     * Calculate next scheduled run time
     */
    getNextScheduledRun(): Date;
}
export declare function createDividendDistributorV2(prisma: any, redis: any, syndicateService: any, io?: any): DividendDistributorV2;
export default DividendDistributorV2;
//# sourceMappingURL=DividendDistributor.v2.d.ts.map