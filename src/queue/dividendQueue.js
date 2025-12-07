"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDividendQueue = createDividendQueue;
exports.enqueueDividendDistribution = enqueueDividendDistribution;
exports.getDividendQueueMetrics = getDividendQueueMetrics;
exports.cleanDividendQueue = cleanDividendQueue;
const bullmq_1 = require("bullmq");
const logger_1 = require("../utils/logger");
/**
 * Create Dividend Distribution Queue
 */
function createDividendQueue(redisConnection) {
    const queue = new bullmq_1.Queue('dividend-distribution', {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3, // Retry up to 3 times
            backoff: {
                type: 'exponential',
                delay: 5000 // Start with 5s, then 10s, then 20s
            },
            removeOnComplete: {
                age: 86400 * 7, // Keep completed jobs for 7 days
                count: 1000 // Keep last 1000 completed jobs
            },
            removeOnFail: {
                age: 86400 * 30 // Keep failed jobs for 30 days for debugging
            }
        }
    });
    // Queue events for monitoring
    const queueEvents = new bullmq_1.QueueEvents('dividend-distribution', {
        connection: redisConnection
    });
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
        logger_1.logger.info({
            type: 'queue_job_completed',
            queue: 'dividend-distribution',
            jobId,
            result: returnvalue
        }, `Job ${jobId} completed successfully`);
    });
    queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger_1.logger.error({
            type: 'queue_job_failed',
            queue: 'dividend-distribution',
            jobId,
            error: failedReason
        }, `Job ${jobId} failed: ${failedReason}`);
    });
    queueEvents.on('progress', ({ jobId, data }) => {
        logger_1.logger.debug({
            type: 'queue_job_progress',
            queue: 'dividend-distribution',
            jobId,
            progress: data
        }, `Job ${jobId} progress update`);
    });
    return { queue, queueEvents };
}
/**
 * Enqueue all syndicates for dividend distribution
 *
 * Called by DividendDistributor on Sunday midnight or manual trigger
 */
async function enqueueDividendDistribution(queue, prisma, triggeredBy = 'scheduled') {
    logger_1.logger.info({
        type: 'dividend_distribution_started',
        triggeredBy
    }, `Starting dividend distribution (${triggeredBy})`);
    try {
        // Fetch all syndicates eligible for dividends
        const syndicates = await prisma.syndicate.findMany({
            where: {
                treasuryBalance: { gt: 0 },
                totalMembers: { gt: 1 } // Need at least 2 members
            },
            select: {
                id: true,
                name: true,
                treasuryBalance: true,
                totalMembers: true
            }
        });
        logger_1.logger.info({
            type: 'dividend_syndicates_found',
            count: syndicates.length
        }, `Found ${syndicates.length} syndicates eligible for dividends`);
        // Enqueue each syndicate as a separate job
        const jobs = await Promise.all(syndicates.map((syndicate) => queue.add(`dividend-${syndicate.id}`, {
            syndicateId: syndicate.id,
            syndicateName: syndicate.name,
            treasuryBalance: syndicate.treasuryBalance,
            totalMembers: syndicate.totalMembers,
            triggeredBy,
            timestamp: new Date()
        }, {
            jobId: `dividend-${syndicate.id}-${Date.now()}`, // Unique job ID
            priority: 1 // All dividends have same priority
        })));
        logger_1.logger.info({
            type: 'dividend_jobs_enqueued',
            count: jobs.length,
            jobIds: jobs.map(j => j.id)
        }, `Enqueued ${jobs.length} dividend distribution jobs`);
        return {
            success: true,
            enqueuedCount: jobs.length,
            syndicates: syndicates.map((s) => ({ id: s.id, name: s.name }))
        };
    }
    catch (error) {
        logger_1.logger.error({
            type: 'dividend_enqueue_failed',
            error: error instanceof Error ? error.message : String(error)
        }, 'Failed to enqueue dividend distribution jobs');
        throw error;
    }
}
/**
 * Get queue metrics for monitoring
 */
async function getDividendQueueMetrics(queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
    ]);
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
    };
}
/**
 * Clean up old jobs
 */
async function cleanDividendQueue(queue) {
    await queue.clean(86400 * 7 * 1000, 1000, 'completed'); // Remove completed jobs older than 7 days
    await queue.clean(86400 * 30 * 1000, 500, 'failed'); // Remove failed jobs older than 30 days
    logger_1.logger.info({
        type: 'queue_cleaned',
        queue: 'dividend-distribution'
    }, 'Dividend queue cleaned');
}
exports.default = {
    createDividendQueue,
    enqueueDividendDistribution,
    getDividendQueueMetrics,
    cleanDividendQueue
};
//# sourceMappingURL=dividendQueue.js.map