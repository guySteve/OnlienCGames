"use strict";
/**
 * VegasCore Generosity Service
 *
 * Transforms "Tip the House" from money-sink to status symbol
 *
 * Psychology:
 * 1. Social Status - Visible badges create envy
 * 2. Leaderboard Competition - Weekly resets create urgency
 * 3. Tribal Recognition - Guild-wide celebration of patrons
 * 4. Streak Mechanics - Consistent tipping builds habit
 */

// Patron Tier Thresholds
const PATRON_TIERS = {
    SUPPORTER: {
        minTotalTips: 100,
        name: 'Supporter',
        frameColor: '#3B82F6', // Blue
        chatBadge: '💙',
        description: 'A friend of the house'
    },
    BENEFACTOR: {
        minTotalTips: 1000,
        name: 'Benefactor',
        frameColor: '#8B5CF6', // Purple
        chatBadge: '💜',
        description: 'A generous patron'
    },
    PHILANTHROPIST: {
        minTotalTips: 5000,
        name: 'Philanthropist',
        frameColor: '#F59E0B', // Amber
        chatBadge: '🧡',
        description: 'A pillar of the community'
    },
    LEGEND: {
        minTotalTips: 25000,
        name: 'Legend',
        frameColor: '#EF4444', // Red
        chatBadge: '❤️‍🔥',
        description: 'A living legend'
    }
};

// Weekly leaderboard rewards
const WEEKLY_REWARDS = {
    1: { chips: 5000, badge: 'WEEKLY_CHAMPION', title: 'Weekly Champion' },
    2: { chips: 2500, badge: 'WEEKLY_RUNNER_UP', title: 'Runner Up' },
    3: { chips: 1000, badge: 'WEEKLY_BRONZE', title: 'Third Place' }
};

class GenerosityService {
    constructor(prisma, redis, io) {
        this.prisma = prisma;
        this.redis = redis;
        this.io = io;
    }

    // =========================================================================
    // TIPPING
    // =========================================================================

    /**
     * Process tip to the house
     * Enhanced with badge progress and leaderboard tracking
     */
    async tipTheHouse(userId, amount, options = {}) {
        if (amount < 1) {
            return { success: false, error: 'Minimum tip is 1 chip' };
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return { success: false, error: 'User not found' };
        }

        if (user.chipBalance < amount) {
            return { success: false, error: 'Insufficient chips' };
        }

        // Calculate ISO week for leaderboard
        const now = new Date();
        const weekNumber = this.getISOWeek(now);
        const yearNumber = now.getFullYear();

        // Check tip streak
        const isConsecutiveDay = this.isConsecutiveDay(user.lastTipDate);
        const newTipStreak = isConsecutiveDay ? user.tipStreak + 1 : 1;

        const result = await this.prisma.$transaction(async (tx) => {
            // Deduct chips
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    chipBalance: { decrement: amount },
                    totalTipped: { increment: amount },
                    tipStreak: newTipStreak,
                    lastTipDate: now
                }
            });

            // Record transaction
            await tx.transaction.create({
                data: {
                    userId,
                    amount: -amount,
                    type: 'TIP',
                    balanceBefore: user.chipBalance,
                    balanceAfter: updatedUser.chipBalance,
                    description: options.message ? `Tip: "${options.message}"` : 'Tip to the House',
                    metadata: {
                        isAnonymous: options.isAnonymous || false,
                        message: options.message || null
                    }
                }
            });

            // Record tip for leaderboard
            const tipRecord = await tx.tipRecord.create({
                data: {
                    userId,
                    amount,
                    isAnonymous: options.isAnonymous || false,
                    message: options.message || null,
                    weekNumber,
                    yearNumber
                }
            });

            return { updatedUser, tipRecord };
        });

        // Check for badge unlocks
        const badgeResult = await this.checkAndAwardBadges(userId, result.updatedUser);

        // Update leaderboard cache
        await this.updateLeaderboardCache(userId, amount, weekNumber, yearNumber);

        // Broadcast tip (if not anonymous)
        if (!options.isAnonymous) {
            await this.broadcastTip(user, amount, options.message);
        }

        return {
            success: true,
            newBalance: result.updatedUser.chipBalance,
            totalTipped: result.updatedUser.totalTipped,
            tipStreak: newTipStreak,
            badgesEarned: badgeResult.newBadges
        };
    }

    // =========================================================================
    // PATRON BADGES
    // =========================================================================

    /**
     * Check and award patron badges based on total tips
     */
    async checkAndAwardBadges(userId, user) {
        const newBadges = [];
        const totalTipped = Number(user.totalTipped);

        // Check each tier
        for (const [tierKey, tierConfig] of Object.entries(PATRON_TIERS)) {
            if (totalTipped >= tierConfig.minTotalTips) {
                // Check if user already has this badge
                const existingBadge = await this.prisma.userPatronBadge.findFirst({
                    where: {
                        userId,
                        badge: { tier: tierKey }
                    }
                });

                if (!existingBadge) {
                    // Find or create the badge definition
                    let badge = await this.prisma.patronBadge.findUnique({
                        where: { key: tierKey }
                    });

                    if (!badge) {
                        badge = await this.prisma.patronBadge.create({
                            data: {
                                key: tierKey,
                                name: tierConfig.name,
                                description: tierConfig.description,
                                iconUrl: `/badges/patron-${tierKey.toLowerCase()}.png`,
                                tier: tierKey,
                                minTotalTips: tierConfig.minTotalTips,
                                frameColor: tierConfig.frameColor,
                                chatBadge: tierConfig.chatBadge
                            }
                        });
                    }

                    // Award badge
                    await this.prisma.userPatronBadge.create({
                        data: {
                            userId,
                            badgeId: badge.id
                        }
                    });

                    newBadges.push({
                        tier: tierKey,
                        name: tierConfig.name,
                        frameColor: tierConfig.frameColor,
                        chatBadge: tierConfig.chatBadge
                    });

                    // Broadcast badge unlock
                    await this.broadcastBadgeUnlock(userId, user, tierConfig);
                }
            }
        }

        return { newBadges };
    }

    /**
     * Get user's patron badges
     */
    async getUserPatronBadges(userId) {
        const badges = await this.prisma.userPatronBadge.findMany({
            where: { userId },
            include: { badge: true },
            orderBy: { badge: { minTotalTips: 'desc' } }
        });

        return badges.map(ub => ({
            id: ub.badge.id,
            key: ub.badge.key,
            name: ub.badge.name,
            tier: ub.badge.tier,
            frameColor: ub.badge.frameColor,
            chatBadge: ub.badge.chatBadge,
            earnedAt: ub.createdAt
        }));
    }

    /**
     * Get user's highest patron tier
     */
    async getHighestPatronTier(userId) {
        const badges = await this.getUserPatronBadges(userId);
        if (badges.length === 0) return null;

        // Badges are ordered by minTotalTips desc, so first is highest
        return badges[0];
    }

    // =========================================================================
    // LEADERBOARDS
    // =========================================================================

    /**
     * Get weekly generosity leaderboard
     */
    async getWeeklyLeaderboard(limit = 20) {
        const now = new Date();
        const weekNumber = this.getISOWeek(now);
        const yearNumber = now.getFullYear();

        // Check cache first
        const cacheKey = `leaderboard:generosity:${yearNumber}:${weekNumber}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.length >= limit) {
                return parsed.slice(0, limit);
            }
        }

        // Query database
        const leaderboard = await this.prisma.tipRecord.groupBy({
            by: ['userId'],
            where: {
                weekNumber,
                yearNumber,
                isAnonymous: false
            },
            _sum: { amount: true },
            _count: { id: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: limit
        });

        // Fetch user details
        const userIds = leaderboard.map(e => e.userId);
        const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                displayName: true,
                nickname: true,
                avatarUrl: true,
                customAvatar: true
            }
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        const result = leaderboard.map((entry, index) => ({
            rank: index + 1,
            userId: entry.userId,
            user: userMap.get(entry.userId),
            weeklyTotal: entry._sum.amount,
            tipCount: entry._count.id,
            reward: WEEKLY_REWARDS[index + 1] || null
        }));

        // Cache for 5 minutes
        await this.redis.setex(cacheKey, 300, JSON.stringify(result));

        return result;
    }

    /**
     * Get all-time generosity leaderboard
     */
    async getAllTimeLeaderboard(limit = 50) {
        const leaderboard = await this.prisma.user.findMany({
            where: {
                totalTipped: { gt: 0 }
            },
            orderBy: { totalTipped: 'desc' },
            take: limit,
            select: {
                id: true,
                displayName: true,
                nickname: true,
                avatarUrl: true,
                customAvatar: true,
                totalTipped: true,
                tipStreak: true
            }
        });

        return leaderboard.map((user, index) => ({
            rank: index + 1,
            userId: user.id,
            name: user.nickname || user.displayName,
            avatar: user.customAvatar || user.avatarUrl,
            totalTipped: Number(user.totalTipped),
            currentStreak: user.tipStreak
        }));
    }

    /**
     * Update leaderboard cache after tip
     */
    async updateLeaderboardCache(userId, amount, weekNumber, yearNumber) {
        const cacheKey = `leaderboard:generosity:${yearNumber}:${weekNumber}`;

        // Invalidate cache to force refresh
        await this.redis.del(cacheKey);

        // Update user's weekly total in fast-access cache
        const userWeeklyKey = `user:${userId}:weekly_tips:${yearNumber}:${weekNumber}`;
        await this.redis.incrby(userWeeklyKey, amount);
        await this.redis.expire(userWeeklyKey, 86400 * 8); // 8 days
    }

    // =========================================================================
    // WEEKLY RESET & REWARDS
    // =========================================================================

    /**
     * Process weekly leaderboard rewards
     * Called by cron job at end of each week
     */
    async processWeeklyRewards() {
        const now = new Date();
        // Get last week's data
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        const weekNumber = this.getISOWeek(lastWeek);
        const yearNumber = lastWeek.getFullYear();

        // Get top 3
        const topTippers = await this.prisma.tipRecord.groupBy({
            by: ['userId'],
            where: {
                weekNumber,
                yearNumber,
                isAnonymous: false
            },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
            take: 3
        });

        const rewards = [];

        for (let i = 0; i < topTippers.length; i++) {
            const rank = i + 1;
            const reward = WEEKLY_REWARDS[rank];
            if (!reward) continue;

            const entry = topTippers[i];

            await this.prisma.$transaction(async (tx) => {
                // Award chips
                const user = await tx.user.update({
                    where: { id: entry.userId },
                    data: {
                        chipBalance: { increment: reward.chips }
                    }
                });

                // Record transaction
                await tx.transaction.create({
                    data: {
                        userId: entry.userId,
                        amount: reward.chips,
                        type: 'ACHIEVEMENT_REWARD',
                        balanceBefore: BigInt(user.chipBalance) - BigInt(reward.chips),
                        balanceAfter: user.chipBalance,
                        description: `Weekly Generosity Leaderboard - ${reward.title}`,
                        metadata: {
                            weekNumber,
                            yearNumber,
                            rank,
                            weeklyTotal: entry._sum.amount
                        }
                    }
                });
            });

            rewards.push({
                rank,
                userId: entry.userId,
                chips: reward.chips,
                title: reward.title
            });
        }

        // Broadcast winners
        if (this.io) {
            this.io.emit('weekly_generosity_winners', {
                weekNumber,
                yearNumber,
                winners: rewards
            });
        }

        return { rewards };
    }

    // =========================================================================
    // TIP FEED (SOCIAL PROOF)
    // =========================================================================

    /**
     * Get recent tips feed
     */
    async getRecentTips(limit = 20) {
        const tips = await this.prisma.tipRecord.findMany({
            where: { isAnonymous: false },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        nickname: true,
                        avatarUrl: true,
                        customAvatar: true
                    }
                }
            }
        });

        return tips.map(tip => ({
            id: tip.id,
            user: {
                id: tip.user.id,
                name: tip.user.nickname || tip.user.displayName,
                avatar: tip.user.customAvatar || tip.user.avatarUrl
            },
            amount: tip.amount,
            message: tip.message,
            timestamp: tip.createdAt
        }));
    }

    /**
     * Broadcast tip to connected users
     */
    async broadcastTip(user, amount, message) {
        const tipData = {
            userId: user.id,
            userName: user.nickname || user.displayName,
            amount,
            message: message || null,
            timestamp: Date.now()
        };

        // Emit via Socket.io
        if (this.io) {
            this.io.emit('generosity_tip', tipData);
        }

        // Add to global ticker
        if (this.redis) {
            await this.redis.lpush('global:ticker', JSON.stringify({
                type: 'TIP_RECEIVED',
                data: tipData
            }));
            await this.redis.ltrim('global:ticker', 0, 99);
        }
    }

    /**
     * Broadcast badge unlock
     */
    async broadcastBadgeUnlock(userId, user, tierConfig) {
        const eventData = {
            userId,
            userName: user.nickname || user.displayName,
            badge: tierConfig.name,
            tier: tierConfig,
            timestamp: Date.now()
        };

        if (this.io) {
            this.io.emit('patron_badge_unlocked', eventData);
        }

        if (this.redis) {
            await this.redis.lpush('global:ticker', JSON.stringify({
                type: 'BADGE_UNLOCKED',
                data: eventData
            }));
            await this.redis.ltrim('global:ticker', 0, 99);
        }
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Get ISO week number
     */
    getISOWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    }

    /**
     * Check if last tip was yesterday (for streak)
     */
    isConsecutiveDay(lastTipDate) {
        if (!lastTipDate) return false;

        const now = new Date();
        const last = new Date(lastTipDate);

        // Reset to start of day
        now.setHours(0, 0, 0, 0);
        last.setHours(0, 0, 0, 0);

        const diffDays = (now - last) / (1000 * 60 * 60 * 24);
        return diffDays === 1;
    }

    /**
     * Get user's generosity stats
     */
    async getUserGenerosityStats(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                totalTipped: true,
                tipStreak: true,
                lastTipDate: true
            }
        });

        if (!user) return null;

        const badges = await this.getUserPatronBadges(userId);
        const highestBadge = badges[0] || null;

        // Get this week's tips
        const now = new Date();
        const weekNumber = this.getISOWeek(now);
        const yearNumber = now.getFullYear();

        const weeklyTotal = await this.prisma.tipRecord.aggregate({
            where: {
                userId,
                weekNumber,
                yearNumber
            },
            _sum: { amount: true }
        });

        // Get rank on weekly leaderboard
        const leaderboard = await this.getWeeklyLeaderboard(100);
        const rank = leaderboard.findIndex(e => e.userId === userId) + 1;

        return {
            totalTipped: Number(user.totalTipped),
            weeklyTipped: weeklyTotal._sum.amount || 0,
            currentStreak: user.tipStreak,
            lastTipDate: user.lastTipDate,
            badges,
            highestBadge,
            weeklyRank: rank > 0 ? rank : null,
            nextTierProgress: this.getNextTierProgress(Number(user.totalTipped))
        };
    }

    /**
     * Calculate progress to next patron tier
     */
    getNextTierProgress(totalTipped) {
        const tiers = Object.entries(PATRON_TIERS)
            .map(([key, config]) => ({ key, ...config }))
            .sort((a, b) => a.minTotalTips - b.minTotalTips);

        for (const tier of tiers) {
            if (totalTipped < tier.minTotalTips) {
                return {
                    nextTier: tier.name,
                    required: tier.minTotalTips,
                    current: totalTipped,
                    remaining: tier.minTotalTips - totalTipped,
                    percentage: Math.floor((totalTipped / tier.minTotalTips) * 100)
                };
            }
        }

        return {
            nextTier: null,
            maxTierReached: true
        };
    }
}

// Singleton instance
let generosityService = null;

function initGenerosityService(prisma, redis, io) {
    generosityService = new GenerosityService(prisma, redis, io);
    return generosityService;
}

function getGenerosityService() {
    if (!generosityService) {
        throw new Error('GenerosityService not initialized');
    }
    return generosityService;
}

module.exports = {
    GenerosityService,
    initGenerosityService,
    getGenerosityService,
    PATRON_TIERS,
    WEEKLY_REWARDS
};
