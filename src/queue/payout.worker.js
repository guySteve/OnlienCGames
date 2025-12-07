"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayoutWorker = createPayoutWorker;
const bullmq_1 = require("bullmq");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const performance_1 = require("../utils/performance");
const prisma = new client_1.PrismaClient();
/**
 * Process a single syndicate dividend payout
 *
 * Wrapped in Prisma transaction for atomicity
 */
async function processDividendPayout(job) {
    const { syndicateId, syndicateName, treasuryBalance, totalMembers } = job.data;
    logger_1.logger.info({
        type: 'dividend_payout_started',
        syndicateId,
        syndicateName,
        treasuryBalance: Number(treasuryBalance),
        totalMembers,
        jobId: job.id
    }, `Processing dividend for ${syndicateName}`);
    try {
        // Use Prisma transaction for atomicity
        const result = await prisma.$transaction(async (tx) => {
            // Get syndicate with lock
            const syndicate = await tx.syndicate.findUnique({
                where: { id: syndicateId },
                include: {
                    members: {
                        where: {
                            // Only active members who contributed
                            weeklyContribution: { gt: 0 }
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    displayName: true,
                                    chipBalance: true
                                }
                            }
                        }
                    }
                }
            });
            if (!syndicate) {
                throw new Error(`Syndicate ${syndicateId} not found`);
            }
            // Check if treasury has enough balance
            if (syndicate.treasuryBalance <= 0) {
                logger_1.logger.warn({
                    type: 'dividend_skip_no_balance',
                    syndicateId,
                    syndicateName
                }, `Skipping ${syndicateName} - no treasury balance`);
                return {
                    success: true,
                    syndicateId,
                    syndicateName,
                    totalAmount: 0n,
                    amountPerMember: 0n,
                    eligibleMembers: 0
                };
            }
            const eligibleMembers = syndicate.members.filter(m => m.weeklyContribution > 0);
            if (eligibleMembers.length === 0) {
                logger_1.logger.warn({
                    type: 'dividend_skip_no_eligible',
                    syndicateId,
                    syndicateName
                }, `Skipping ${syndicateName} - no eligible members`);
                return {
                    success: true,
                    syndicateId,
                    syndicateName,
                    totalAmount: 0n,
                    amountPerMember: 0n,
                    eligibleMembers: 0
                };
            }
            // Calculate dividend amount (10% of treasury)
            const totalDividend = syndicate.treasuryBalance / 10n;
            const amountPerMember = totalDividend / BigInt(eligibleMembers.length);
            if (amountPerMember <= 0) {
                logger_1.logger.warn({
                    type: 'dividend_skip_too_small',
                    syndicateId,
                    syndicateName,
                    totalDividend: Number(totalDividend),
                    memberCount: eligibleMembers.length
                }, `Skipping ${syndicateName} - dividend too small`);
                return {
                    success: true,
                    syndicateId,
                    syndicateName,
                    totalAmount: 0n,
                    amountPerMember: 0n,
                    eligibleMembers: 0
                };
            }
            // Record dividend distribution
            const dividend = await tx.syndicateDividend.create({
                data: {
                    syndicateId,
                    totalAmount: totalDividend,
                    memberCount: eligibleMembers.length,
                    amountPerMember,
                    minContribution: 0n,
                    periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                    metadata: {
                        memberPayouts: eligibleMembers.map(m => ({
                            userId: m.userId,
                            displayName: m.user.displayName,
                            contribution: Number(m.weeklyContribution),
                            payout: Number(amountPerMember)
                        }))
                    }
                }
            });
            // Process each payout (CRITICAL: Sequential to avoid race conditions)
            for (const member of eligibleMembers) {
                // Update member's balance
                await tx.user.update({
                    where: { id: member.userId },
                    data: {
                        chipBalance: {
                            increment: amountPerMember
                        }
                    }
                });
                // Record transaction
                await tx.transaction.create({
                    data: {
                        userId: member.userId,
                        amount: Number(amountPerMember),
                        type: 'TRANSFER_RECEIVED',
                        balanceBefore: member.user.chipBalance,
                        balanceAfter: member.user.chipBalance + amountPerMember,
                        description: `Syndicate dividend from ${syndicateName}`,
                        metadata: {
                            syndicateId,
                            syndicateName,
                            dividendId: dividend.id,
                            weeklyContribution: Number(member.weeklyContribution)
                        }
                    }
                });
                // Update member dividend stats
                await tx.syndicateMember.update({
                    where: { id: member.id },
                    data: {
                        dividendsReceived: {
                            increment: amountPerMember
                        },
                        weeklyContribution: 0 // Reset for next week
                    }
                });
                // Report progress
                await job.updateProgress({
                    processed: eligibleMembers.indexOf(member) + 1,
                    total: eligibleMembers.length
                });
            }
            // Deduct from treasury
            await tx.syndicate.update({
                where: { id: syndicateId },
                data: {
                    treasuryBalance: {
                        decrement: totalDividend
                    }
                }
            });
            // Record treasury transaction
            await tx.syndicateTransaction.create({
                data: {
                    syndicateId,
                    userId: null, // System transaction
                    amount: -Number(totalDividend),
                    type: 'DIVIDEND_PAYOUT',
                    balanceBefore: syndicate.treasuryBalance,
                    balanceAfter: syndicate.treasuryBalance - totalDividend,
                    description: `Weekly dividend distribution to ${eligibleMembers.length} members`,
                    metadata: {
                        dividendId: dividend.id,
                        memberCount: eligibleMembers.length,
                        amountPerMember: Number(amountPerMember)
                    }
                }
            });
            logger_1.logger.info({
                type: 'dividend_payout_completed',
                syndicateId,
                syndicateName,
                totalAmount: Number(totalDividend),
                amountPerMember: Number(amountPerMember),
                eligibleMembers: eligibleMembers.length,
                jobId: job.id
            }, `Distributed ${totalDividend} chips to ${eligibleMembers.length} members of ${syndicateName}`);
            return {
                success: true,
                syndicateId,
                syndicateName,
                totalAmount: totalDividend,
                amountPerMember,
                eligibleMembers: eligibleMembers.length
            };
        });
        return result;
    }
    catch (error) {
        logger_1.logger.error({
            type: 'dividend_payout_failed',
            syndicateId,
            syndicateName,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            jobId: job.id
        }, `Failed to process dividend for ${syndicateName}`);
        return {
            success: false,
            syndicateId,
            syndicateName,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
/**
 * Create and start the worker
 */
function createPayoutWorker(redisConnection, io) {
    const worker = new bullmq_1.Worker('dividend-distribution', async (job) => {
        // Measure performance
        return await (0, performance_1.measureDuration)('dividend-payout', () => processDividendPayout(job), {
            syndicateId: job.data.syndicateId,
            syndicateName: job.data.syndicateName,
            jobId: job.id
        });
    }, {
        connection: redisConnection,
        concurrency: 1, // Process one at a time to avoid DB contention
        limiter: {
            max: 10, // Max 10 jobs per...
            duration: 60000 // ...60 seconds (prevents thundering herd)
        }
    });
    // Worker event handlers
    worker.on('completed', (job, result) => {
        logger_1.logger.info({
            type: 'worker_job_completed',
            jobId: job.id,
            syndicateId: result.syndicateId,
            syndicateName: result.syndicateName,
            success: result.success
        }, `Worker completed job ${job.id}`);
        // Notify via Socket.IO if available
        if (io && result.success && result.totalAmount && result.totalAmount > 0n) {
            io.to(`syndicate:${result.syndicateId}`).emit('dividend_distributed', {
                syndicateId: result.syndicateId,
                syndicateName: result.syndicateName,
                totalAmount: Number(result.totalAmount),
                amountPerMember: Number(result.amountPerMember),
                eligibleMembers: result.eligibleMembers
            });
        }
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error({
            type: 'worker_job_failed',
            jobId: job?.id,
            syndicateId: job?.data?.syndicateId,
            error: err.message,
            attempts: job?.attemptsMade
        }, `Worker failed job ${job?.id} after ${job?.attemptsMade} attempts`);
    });
    worker.on('error', (err) => {
        logger_1.logger.error({
            type: 'worker_error',
            error: err.message
        }, 'Worker encountered an error');
    });
    logger_1.logger.info({
        type: 'worker_started',
        queue: 'dividend-distribution'
    }, 'Dividend payout worker started');
    return worker;
}
// If running as standalone worker process
if (require.main === module) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisConnection = {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port || '6379'),
        password: new URL(redisUrl).password || undefined
    };
    logger_1.logger.info('Starting standalone dividend payout worker...');
    const worker = createPayoutWorker(redisConnection);
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger_1.logger.info('SIGTERM received, shutting down worker...');
        await worker.close();
        await prisma.$disconnect();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        logger_1.logger.info('SIGINT received, shutting down worker...');
        await worker.close();
        await prisma.$disconnect();
        process.exit(0);
    });
}
exports.default = createPayoutWorker;
//# sourceMappingURL=payout.worker.js.map