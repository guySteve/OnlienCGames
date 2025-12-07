"use strict";
/**
 * VegasCore Dividend Distributor
 *
 * Weekly cron job to distribute syndicate dividends
 * Runs every Sunday at midnight UTC
 *
 * Schedule: 0 0 * * 0 (cron expression)
 */

class DividendDistributor {
    constructor(prisma, redis, syndicateService, io) {
        this.prisma = prisma;
        this.redis = redis;
        this.syndicateService = syndicateService;
        this.io = io;
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Main distribution job
     */
    async run() {
        if (this.isRunning) {
            console.log('[DividendDistributor] Already running, skipping...');
            return { skipped: true };
        }

        this.isRunning = true;
        const startTime = Date.now();
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            totalDistributed: 0n,
            errors: []
        };

        try {
            console.log('[DividendDistributor] Starting weekly dividend distribution...');

            // Get all syndicates with treasury balance
            const syndicates = await this.prisma.syndicate.findMany({
                where: {
                    treasuryBalance: { gt: 0 },
                    totalMembers: { gt: 1 } // Need at least 2 members for distribution
                },
                select: {
                    id: true,
                    name: true,
                    treasuryBalance: true,
                    totalMembers: true
                }
            });

            console.log(`[DividendDistributor] Found ${syndicates.length} syndicates to process`);

            for (const syndicate of syndicates) {
                results.processed++;

                try {
                    const result = await this.syndicateService.distributeDividends(syndicate.id);

                    if (result.success) {
                        results.successful++;
                        results.totalDistributed += result.dividend.totalAmount;

                        console.log(`[DividendDistributor] ${syndicate.name}: Distributed ${result.dividend.totalAmount} to ${result.eligibleMembers} members`);

                        // Notify syndicate channel
                        if (this.io) {
                            this.io.to(`syndicate:${syndicate.id}`).emit('dividend_distributed', {
                                syndicateId: syndicate.id,
                                syndicateName: syndicate.name,
                                totalAmount: Number(result.dividend.totalAmount),
                                amountPerMember: Number(result.dividend.amountPerMember),
                                eligibleMembers: result.eligibleMembers
                            });
                        }
                    } else {
                        results.failed++;
                        results.errors.push({
                            syndicateId: syndicate.id,
                            name: syndicate.name,
                            error: result.error
                        });
                    }
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        syndicateId: syndicate.id,
                        name: syndicate.name,
                        error: error.message
                    });
                    console.error(`[DividendDistributor] Error processing ${syndicate.name}:`, error.message);
                }
            }

            // Record job completion
            this.lastRun = {
                timestamp: new Date(),
                duration: Date.now() - startTime,
                results: {
                    ...results,
                    totalDistributed: Number(results.totalDistributed) // Convert BigInt to Number
                }
            };

            // Store in Redis for monitoring
            await this.redis.set('job:dividend:last_run', JSON.stringify(this.lastRun), { ex: 86400 * 7 });

            console.log(`[DividendDistributor] Completed in ${this.lastRun.duration}ms`);
            console.log(`[DividendDistributor] Results: ${results.successful}/${results.processed} successful, ${results.failed} failed`);
            console.log(`[DividendDistributor] Total distributed: ${results.totalDistributed} chips`);

            // Broadcast global event
            if (this.io && results.successful > 0) {
                this.io.emit('weekly_dividends_distributed', {
                    syndicatesProcessed: results.processed,
                    successful: results.successful,
                    totalDistributed: Number(results.totalDistributed)
                });
            }

            return results;

        } catch (error) {
            console.error('[DividendDistributor] Fatal error:', error);
            results.errors.push({ fatal: true, error: error.message });
            throw error;

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Check if it's time to run (Sunday midnight UTC)
     */
    shouldRun() {
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
    start(intervalMs = 60000) {
        console.log('[DividendDistributor] Scheduler started');

        // Check every minute
        this.intervalId = setInterval(async () => {
            if (this.shouldRun()) {
                try {
                    await this.run();
                } catch (error) {
                    console.error('[DividendDistributor] Scheduled run failed:', error);
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
            // Never ran before, check if we should
            const now = new Date();
            const dayOfWeek = now.getUTCDay();

            // If it's Sunday or later in the week, run now
            if (dayOfWeek >= 0 && dayOfWeek <= 2) {
                console.log('[DividendDistributor] No previous run found, executing now...');
                setTimeout(() => this.run(), 5000); // Small delay for services to initialize
            }
            return;
        }

        const lastRun = typeof lastRunData === 'string' ? JSON.parse(lastRunData) : lastRunData;
        const lastRunDate = new Date(lastRun.timestamp);
        const now = new Date();

        // Check if more than 7 days since last run
        const daysSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastRun >= 7) {
            console.log('[DividendDistributor] Missed scheduled run, executing now...');
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
            console.log('[DividendDistributor] Scheduler stopped');
        }
    }

    /**
     * Manual trigger (for admin use)
     */
    async triggerManual() {
        console.log('[DividendDistributor] Manual trigger initiated');
        return this.run();
    }

    /**
     * Get job status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextScheduledRun: this.getNextScheduledRun()
        };
    }

    /**
     * Calculate next scheduled run time
     */
    getNextScheduledRun() {
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
function createDividendDistributor(prisma, redis, syndicateService, io) {
    return new DividendDistributor(prisma, redis, syndicateService, io);
}

module.exports = {
    DividendDistributor,
    createDividendDistributor
};
