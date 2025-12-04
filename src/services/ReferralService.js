"use strict";
/**
 * VegasCore Referral Service
 *
 * Double-Sided Referral Engine for Social 2.0
 *
 * Psychology: Dual incentives create viral loop
 * - Referrer gets chips + syndicate treasury bonus
 * - Referee gets starter chips + welcome boost
 * - Syndicate treasury grows from member activity
 */

const crypto = require('crypto');

// Reward Constants
const REFERRER_BASE_REWARD = 500;      // Chips for the person who refers
const REFEREE_STARTER_CHIPS = 1000;    // Extra chips for new player
const SYNDICATE_TREASURY_BONUS = 100;  // Bonus to syndicate treasury
const MILESTONE_LEVEL_5_BONUS = 1000;  // Bonus when referee hits level 5
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_EXPIRY_DAYS = 7;        // Days for pending referral to expire

class ReferralService {
    constructor(prisma, redis, syndicateService) {
        this.prisma = prisma;
        this.redis = redis;
        this.syndicateService = syndicateService;
    }

    // =========================================================================
    // REFERRAL CODE GENERATION
    // =========================================================================

    /**
     * Generate unique referral code for user
     */
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I/L)
        let code = '';
        const randomBytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
        for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
            code += chars[randomBytes[i] % chars.length];
        }
        return code;
    }

    /**
     * Get or create user's referral code
     */
    async getUserReferralCode(userId) {
        // Check for existing active code
        let codeRecord = await this.prisma.referralCode.findFirst({
            where: {
                userId,
                isActive: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            }
        });

        if (codeRecord) {
            return codeRecord;
        }

        // Generate new code
        let code;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            code = this.generateCode();
            const existing = await this.prisma.referralCode.findUnique({
                where: { code }
            });
            if (!existing) break;
            attempts++;
        }

        if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique referral code');
        }

        // Get user's syndicate for bonus calculation
        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId }
        });

        codeRecord = await this.prisma.referralCode.create({
            data: {
                userId,
                code,
                referrerBonus: REFERRER_BASE_REWARD,
                refereeBonus: REFEREE_STARTER_CHIPS,
                syndicateBonus: membership ? SYNDICATE_TREASURY_BONUS : 0
            }
        });

        // Cache for quick lookup
        await this.redis.setex(`referral:code:${code}`, 86400 * 30, JSON.stringify({
            userId,
            syndicateId: membership?.syndicateId || null
        }));

        return codeRecord;
    }

    /**
     * Validate referral code
     */
    async validateCode(code) {
        const cleanCode = code.trim().toUpperCase();

        // Check cache first
        const cached = await this.redis.get(`referral:code:${cleanCode}`);
        if (cached) {
            const data = JSON.parse(cached);
            return { valid: true, ...data };
        }

        const codeRecord = await this.prisma.referralCode.findUnique({
            where: { code: cleanCode },
            include: {
                user: {
                    select: { id: true, displayName: true, nickname: true }
                }
            }
        });

        if (!codeRecord) {
            return { valid: false, error: 'Invalid referral code' };
        }

        if (!codeRecord.isActive) {
            return { valid: false, error: 'Referral code is inactive' };
        }

        if (codeRecord.expiresAt && codeRecord.expiresAt < new Date()) {
            return { valid: false, error: 'Referral code has expired' };
        }

        if (codeRecord.maxUses && codeRecord.usageCount >= codeRecord.maxUses) {
            return { valid: false, error: 'Referral code usage limit reached' };
        }

        // Get referrer's syndicate
        const membership = await this.prisma.syndicateMember.findFirst({
            where: { userId: codeRecord.userId }
        });

        return {
            valid: true,
            referrerId: codeRecord.userId,
            referrerName: codeRecord.user.nickname || codeRecord.user.displayName,
            syndicateId: membership?.syndicateId || null,
            rewards: {
                referrerBonus: codeRecord.referrerBonus,
                refereeBonus: codeRecord.refereeBonus,
                syndicateBonus: membership ? codeRecord.syndicateBonus : 0
            }
        };
    }

    // =========================================================================
    // REFERRAL PROCESSING
    // =========================================================================

    /**
     * Process referral on new user signup
     * Called during user creation flow
     */
    async processSignupReferral(newUserId, referralCode) {
        if (!referralCode) {
            return { success: false, error: 'No referral code provided' };
        }

        const validation = await this.validateCode(referralCode);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Prevent self-referral
        if (validation.referrerId === newUserId) {
            return { success: false, error: 'Cannot use your own referral code' };
        }

        // Check if user was already referred
        const existingReferral = await this.prisma.referral.findUnique({
            where: { refereeId: newUserId }
        });

        if (existingReferral) {
            return { success: false, error: 'User already has a referral' };
        }

        const result = await this.prisma.$transaction(async (tx) => {
            // Create referral record
            const referral = await tx.referral.create({
                data: {
                    referrerId: validation.referrerId,
                    refereeId: newUserId,
                    code: referralCode.toUpperCase(),
                    syndicateId: validation.syndicateId,
                    status: 'PENDING'
                }
            });

            // Credit referee with starter bonus
            const referee = await tx.user.update({
                where: { id: newUserId },
                data: {
                    chipBalance: { increment: validation.rewards.refereeBonus },
                    referredBy: validation.referrerId,
                    referralCode: referralCode.toUpperCase()
                }
            });

            // Record referee transaction
            await tx.transaction.create({
                data: {
                    userId: newUserId,
                    amount: validation.rewards.refereeBonus,
                    type: 'PROMO_CODE',
                    balanceBefore: BigInt(referee.chipBalance) - BigInt(validation.rewards.refereeBonus),
                    balanceAfter: referee.chipBalance,
                    description: `Referral welcome bonus from ${validation.referrerName}`,
                    metadata: { referralId: referral.id }
                }
            });

            // Update referral record with referee reward
            await tx.referral.update({
                where: { id: referral.id },
                data: { refereeReward: validation.rewards.refereeBonus }
            });

            // Increment code usage
            await tx.referralCode.update({
                where: { code: referralCode.toUpperCase() },
                data: { usageCount: { increment: 1 } }
            });

            return { referral, referee };
        });

        // Notify referrer
        await this.notifyReferrer(validation.referrerId, result.referral.id);

        return {
            success: true,
            referral: result.referral,
            bonusReceived: validation.rewards.refereeBonus
        };
    }

    /**
     * Activate referral when referee plays first game
     * Triggers referrer reward
     */
    async activateReferral(refereeId, gameType) {
        const referral = await this.prisma.referral.findUnique({
            where: { refereeId },
            include: {
                referrer: true
            }
        });

        if (!referral || referral.status !== 'PENDING') {
            return { activated: false };
        }

        const codeRecord = await this.prisma.referralCode.findFirst({
            where: { code: referral.code }
        });

        const result = await this.prisma.$transaction(async (tx) => {
            // Update referral status
            const updatedReferral = await tx.referral.update({
                where: { id: referral.id },
                data: {
                    status: 'ACTIVATED',
                    refereeFirstGame: new Date(),
                    referrerReward: codeRecord?.referrerBonus || REFERRER_BASE_REWARD
                }
            });

            // Credit referrer
            const referrerReward = codeRecord?.referrerBonus || REFERRER_BASE_REWARD;
            const referrer = await tx.user.update({
                where: { id: referral.referrerId },
                data: {
                    chipBalance: { increment: referrerReward }
                }
            });

            // Record referrer transaction
            await tx.transaction.create({
                data: {
                    userId: referral.referrerId,
                    amount: referrerReward,
                    type: 'PROMO_CODE',
                    balanceBefore: BigInt(referrer.chipBalance) - BigInt(referrerReward),
                    balanceAfter: referrer.chipBalance,
                    description: 'Referral bonus - your friend played their first game!',
                    relatedUserId: refereeId,
                    metadata: { referralId: referral.id, gameType }
                }
            });

            // Credit syndicate treasury if applicable
            if (referral.syndicateId && codeRecord?.syndicateBonus > 0) {
                const syndicate = await tx.syndicate.update({
                    where: { id: referral.syndicateId },
                    data: {
                        treasuryBalance: { increment: codeRecord.syndicateBonus },
                        lifetimeEarnings: { increment: codeRecord.syndicateBonus }
                    }
                });

                await tx.syndicateTransaction.create({
                    data: {
                        syndicateId: referral.syndicateId,
                        userId: referral.referrerId,
                        amount: BigInt(codeRecord.syndicateBonus),
                        type: 'REFERRAL_BONUS',
                        balanceBefore: BigInt(syndicate.treasuryBalance) - BigInt(codeRecord.syndicateBonus),
                        balanceAfter: syndicate.treasuryBalance,
                        description: 'Referral bonus for new member recruit'
                    }
                });

                await tx.referral.update({
                    where: { id: referral.id },
                    data: { syndicateBonusPaid: codeRecord.syndicateBonus }
                });
            }

            return { updatedReferral, referrer };
        });

        // Emit global event for social proof
        await this.emitReferralEvent('referral_activated', {
            referrerId: referral.referrerId,
            referrerName: referral.referrer.nickname || referral.referrer.displayName,
            reward: codeRecord?.referrerBonus || REFERRER_BASE_REWARD
        });

        return {
            activated: true,
            referrerReward: codeRecord?.referrerBonus || REFERRER_BASE_REWARD,
            syndicateBonus: referral.syndicateId ? codeRecord?.syndicateBonus : 0
        };
    }

    /**
     * Complete referral when referee reaches level 5
     * Triggers milestone bonus
     */
    async completeReferralMilestone(refereeId, newLevel) {
        if (newLevel !== 5) {
            return { milestone: false };
        }

        const referral = await this.prisma.referral.findUnique({
            where: { refereeId }
        });

        if (!referral || referral.status !== 'ACTIVATED' || referral.refereeLevelFive) {
            return { milestone: false };
        }

        const result = await this.prisma.$transaction(async (tx) => {
            // Update referral
            await tx.referral.update({
                where: { id: referral.id },
                data: {
                    status: 'COMPLETED',
                    refereeLevelFive: new Date(),
                    referrerReward: { increment: MILESTONE_LEVEL_5_BONUS }
                }
            });

            // Bonus to referrer
            const referrer = await tx.user.update({
                where: { id: referral.referrerId },
                data: {
                    chipBalance: { increment: MILESTONE_LEVEL_5_BONUS }
                }
            });

            await tx.transaction.create({
                data: {
                    userId: referral.referrerId,
                    amount: MILESTONE_LEVEL_5_BONUS,
                    type: 'PROMO_CODE',
                    balanceBefore: BigInt(referrer.chipBalance) - BigInt(MILESTONE_LEVEL_5_BONUS),
                    balanceAfter: referrer.chipBalance,
                    description: 'Referral milestone bonus - your friend reached level 5!',
                    relatedUserId: refereeId,
                    metadata: { referralId: referral.id, milestone: 'LEVEL_5' }
                }
            });

            return { referrer };
        });

        await this.emitReferralEvent('referral_milestone', {
            referrerId: referral.referrerId,
            milestone: 'LEVEL_5',
            bonus: MILESTONE_LEVEL_5_BONUS
        });

        return {
            milestone: true,
            bonus: MILESTONE_LEVEL_5_BONUS
        };
    }

    // =========================================================================
    // REFERRAL STATS & HISTORY
    // =========================================================================

    /**
     * Get user's referral stats
     */
    async getReferralStats(userId) {
        const [code, referrals, referredBy] = await Promise.all([
            this.getUserReferralCode(userId),
            this.prisma.referral.findMany({
                where: { referrerId: userId },
                include: {
                    referee: {
                        select: {
                            id: true,
                            displayName: true,
                            nickname: true,
                            xpLevel: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.referral.findUnique({
                where: { refereeId: userId },
                include: {
                    referrer: {
                        select: {
                            id: true,
                            displayName: true,
                            nickname: true
                        }
                    }
                }
            })
        ]);

        const totalReferrals = referrals.length;
        const activatedReferrals = referrals.filter(r => r.status !== 'PENDING').length;
        const completedReferrals = referrals.filter(r => r.status === 'COMPLETED').length;
        const totalEarned = referrals.reduce((sum, r) => sum + Number(r.referrerReward), 0);

        return {
            code: code.code,
            codeUsageCount: code.usageCount,
            totalReferrals,
            activatedReferrals,
            completedReferrals,
            pendingReferrals: totalReferrals - activatedReferrals,
            totalChipsEarned: totalEarned,
            referrals: referrals.map(r => ({
                id: r.id,
                referee: r.referee.nickname || r.referee.displayName,
                refereeLevel: r.referee.xpLevel,
                status: r.status,
                reward: Number(r.referrerReward),
                joinedAt: r.createdAt,
                activatedAt: r.refereeFirstGame,
                completedAt: r.refereeLevelFive
            })),
            wasReferred: !!referredBy,
            referredBy: referredBy ? {
                name: referredBy.referrer.nickname || referredBy.referrer.displayName,
                bonusReceived: Number(referredBy.refereeReward)
            } : null
        };
    }

    /**
     * Get referral leaderboard
     */
    async getReferralLeaderboard(period = 'all', limit = 20) {
        let dateFilter = {};
        if (period === 'weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = { createdAt: { gte: weekAgo } };
        } else if (period === 'monthly') {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter = { createdAt: { gte: monthAgo } };
        }

        const referrals = await this.prisma.referral.groupBy({
            by: ['referrerId'],
            where: {
                status: { in: ['ACTIVATED', 'COMPLETED'] },
                ...dateFilter
            },
            _count: { id: true },
            _sum: { referrerReward: true },
            orderBy: { _count: { id: 'desc' } },
            take: limit
        });

        // Fetch user details
        const userIds = referrals.map(r => r.referrerId);
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

        return referrals.map((r, index) => ({
            rank: index + 1,
            userId: r.referrerId,
            user: userMap.get(r.referrerId),
            referralCount: r._count.id,
            totalEarned: Number(r._sum.referrerReward || 0)
        }));
    }

    // =========================================================================
    // CLEANUP & MAINTENANCE
    // =========================================================================

    /**
     * Expire old pending referrals (run via cron)
     */
    async expirePendingReferrals() {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() - REFERRAL_EXPIRY_DAYS);

        const result = await this.prisma.referral.updateMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: expiryDate }
            },
            data: { status: 'EXPIRED' }
        });

        return { expiredCount: result.count };
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Notify referrer of new signup
     */
    async notifyReferrer(referrerId, referralId) {
        // Cache notification for real-time delivery
        if (this.redis) {
            await this.redis.lpush(`user:${referrerId}:notifications`, JSON.stringify({
                type: 'referral_signup',
                referralId,
                timestamp: Date.now()
            }));
            await this.redis.ltrim(`user:${referrerId}:notifications`, 0, 49);
        }
    }

    /**
     * Emit referral events for global ticker
     */
    async emitReferralEvent(eventType, data) {
        if (this.redis) {
            await this.redis.lpush('global:ticker', JSON.stringify({
                type: eventType,
                data,
                timestamp: Date.now()
            }));
            await this.redis.ltrim('global:ticker', 0, 99);
        }
    }
}

// Singleton instance
let referralService = null;

function initReferralService(prisma, redis, syndicateService) {
    referralService = new ReferralService(prisma, redis, syndicateService);
    return referralService;
}

function getReferralService() {
    if (!referralService) {
        throw new Error('ReferralService not initialized');
    }
    return referralService;
}

module.exports = {
    ReferralService,
    initReferralService,
    getReferralService
};
