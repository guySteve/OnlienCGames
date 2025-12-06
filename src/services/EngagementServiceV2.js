"use strict";
/**
 * VegasCore Engagement Service V2
 *
 * "The North End" - Advanced retention mechanics for Social 2.0
 *
 * Enhancements over V1:
 * 1. Variable Reward Schedule - Non-linear scaling + mystery tiers
 * 2. Grace Period Logic - 48h window with visual urgency
 * 3. Happy Hour Engine - Time-limited multiplier events
 * 4. Near-Miss Amplification - Enhanced loss aversion triggers
 * 5. Syndicate Integration - XP contributes to guild rankings
 */

const crypto = require('crypto');

// =============================================================================
// STREAK REWARD TABLES - Non-linear scaling creates "milestone anxiety"
// =============================================================================

const STREAK_REWARDS = {
    // Early days: Gentle ramp to build habit
    1: { chips: 100, xp: 50, tier: 'STARTER' },
    2: { chips: 120, xp: 60, tier: 'STARTER' },
    3: { chips: 150, xp: 75, tier: 'STARTER' },

    // Mid streak: Accelerating rewards create FOMO
    4: { chips: 200, xp: 100, tier: 'BUILDING' },
    5: { chips: 250, xp: 125, tier: 'BUILDING' },
    6: { chips: 350, xp: 175, tier: 'BUILDING' },

    // Week milestone: Major reward spike
    7: { chips: 750, xp: 350, tier: 'MILESTONE', bonus: 'MYSTERY_CHEST', bonusChance: 1.0 },

    // Post-week: Sustained high value
    8: { chips: 400, xp: 200, tier: 'VETERAN' },
    9: { chips: 420, xp: 210, tier: 'VETERAN' },
    10: { chips: 450, xp: 225, tier: 'VETERAN' },
    11: { chips: 480, xp: 240, tier: 'VETERAN' },
    12: { chips: 520, xp: 260, tier: 'VETERAN' },
    13: { chips: 570, xp: 285, tier: 'VETERAN' },

    // Two-week milestone: Massive reward
    14: { chips: 1500, xp: 750, tier: 'MILESTONE', bonus: 'PREMIUM_CHEST', bonusChance: 1.0 },

    // Three-week milestone
    21: { chips: 2000, xp: 1000, tier: 'MILESTONE', bonus: 'JACKPOT_SPIN', bonusChance: 1.0 },

    // Month milestone: Legendary
    30: { chips: 5000, xp: 2500, tier: 'LEGENDARY', bonus: 'VIP_WEEK_PASS', bonusChance: 1.0 }
};

// Fill in gaps with linear interpolation
function getStreakReward(day) {
    if (STREAK_REWARDS[day]) {
        return STREAK_REWARDS[day];
    }

    // Find surrounding milestones
    const milestones = Object.keys(STREAK_REWARDS).map(Number).sort((a, b) => a - b);
    let lower = milestones[0];
    let upper = milestones[milestones.length - 1];

    for (let i = 0; i < milestones.length - 1; i++) {
        if (day > milestones[i] && day < milestones[i + 1]) {
            lower = milestones[i];
            upper = milestones[i + 1];
            break;
        }
    }

    if (day > upper) {
        // Beyond 30 days: continue scaling
        const base = STREAK_REWARDS[30];
        const extraDays = day - 30;
        return {
            chips: base.chips + (extraDays * 500),
            xp: base.xp + (extraDays * 50),
            tier: 'LEGENDARY',
            bonusChance: 0.1 // 10% chance for bonus each day
        };
    }

    // Linear interpolation
    const lowerReward = STREAK_REWARDS[lower];
    const upperReward = STREAK_REWARDS[upper];
    const progress = (day - lower) / (upper - lower);

    return {
        chips: Math.floor(lowerReward.chips + (upperReward.chips - lowerReward.chips) * progress),
        xp: Math.floor(lowerReward.xp + (upperReward.xp - lowerReward.xp) * progress),
        tier: lowerReward.tier,
        bonusChance: 0.05 // 5% chance for mystery bonus on non-milestone days
    };
}

// =============================================================================
// MYSTERY DROP TIERS - Variable ratio schedule (most addictive pattern)
// =============================================================================

const MYSTERY_DROP_TIERS = [
    { name: 'COMMON', weight: 70, minChips: 50, maxChips: 200, xpBonus: 10 },
    { name: 'UNCOMMON', weight: 20, minChips: 200, maxChips: 500, xpBonus: 25 },
    { name: 'RARE', weight: 7, minChips: 500, maxChips: 1500, xpBonus: 75 },
    { name: 'EPIC', weight: 2.5, minChips: 1500, maxChips: 5000, xpBonus: 200 },
    { name: 'LEGENDARY', weight: 0.5, minChips: 5000, maxChips: 25000, xpBonus: 500 }
];

// Base drop chances by context
const DROP_CHANCES = {
    BASE: 0.005,           // 0.5% per hand
    STREAK_BONUS: 0.001,   // +0.1% per streak day (capped at 2%)
    HAPPY_HOUR: 0.015,     // 1.5% during happy hour
    BIG_WIN: 0.02,         // 2% after winning 500+
    LOSS_CONSOLATION: 0.008 // 0.8% after losing (psychology: softens blow)
};

// =============================================================================
// HAPPY HOUR BONUSES
// =============================================================================

const HAPPY_HOUR_CONFIGS = {
    XP_BOOST: { xpMultiplier: 2.0, chipMultiplier: 1.0, dropMultiplier: 1.0 },
    CHIP_BOOST: { xpMultiplier: 1.0, chipMultiplier: 1.5, dropMultiplier: 1.0 },
    MYSTERY_BOOST: { xpMultiplier: 1.0, chipMultiplier: 1.0, dropMultiplier: 3.0 },
    STREAK_PROTECT: { xpMultiplier: 1.0, chipMultiplier: 1.0, dropMultiplier: 1.0, streakProtected: true }
};

class EngagementServiceV2 {
    constructor(prisma, redis, syndicateService) {
        this.prisma = prisma;
        this.redis = redis;
        this.syndicateService = syndicateService;
    }

    // =========================================================================
    // DAILY STREAK SYSTEM V2 - With Grace Period
    // =========================================================================

    /**
     * Get comprehensive streak status
     */
    async getStreakStatus(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                currentStreak: true,
                bestStreak: true,
                lastLogin: true,
                nextStreakReward: true,
                streakFrozen: true
            }
        });

        if (!user) throw new Error('User not found');

        const now = new Date();
        const hoursSinceLastLogin = user.lastLogin
            ? (now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60)
            : 999;

        // Grace period: 48 hours
        const GRACE_PERIOD_HOURS = 48;
        const hoursUntilReset = Math.max(0, GRACE_PERIOD_HOURS - hoursSinceLastLogin);
        const isInDanger = hoursUntilReset > 0 && hoursUntilReset < 6; // Last 6 hours = danger zone

        // Can claim if 24h have passed
        const canClaim = !user.nextStreakReward || now >= user.nextStreakReward;

        // Calculate what they'd lose
        const currentReward = getStreakReward(user.currentStreak);
        const nextReward = getStreakReward(user.currentStreak + 1);

        // Check for active happy hour
        const happyHour = await this.getActiveHappyHour();

        return {
            currentStreak: user.currentStreak,
            bestStreak: user.bestStreak,
            canClaim,
            canClaimAt: user.nextStreakReward,
            hoursUntilReset: Math.round(hoursUntilReset * 10) / 10,
            isInDanger,
            streakAtRisk: hoursUntilReset < 24 && !canClaim,
            currentReward,
            nextReward,
            potentialLoss: user.currentStreak > 0 ? {
                streakDays: user.currentStreak,
                chipsValue: this.calculateStreakValue(user.currentStreak)
            } : null,
            happyHour: happyHour ? {
                active: true,
                type: happyHour.bonusType,
                multiplier: happyHour.multiplier,
                endsAt: happyHour.endTime
            } : null,
            streakProtected: user.streakFrozen || (happyHour?.bonusType === 'STREAK_PROTECT')
        };
    }

    /**
     * Calculate total value of streak (for loss aversion display)
     */
    calculateStreakValue(days) {
        let total = 0;
        for (let i = 1; i <= days; i++) {
            total += getStreakReward(i).chips;
        }
        return total;
    }

    /**
     * Claim daily streak reward
     */
    async claimDailyReward(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { syndicateMembership: true }
        });

        if (!user) return { success: false, error: 'User not found' };

        const now = new Date();

        // Check if can claim (24h cooldown)
        if (user.nextStreakReward && now < user.nextStreakReward) {
            const msRemaining = user.nextStreakReward.getTime() - now.getTime();
            return {
                success: false,
                error: 'Already claimed today',
                nextClaimAt: user.nextStreakReward,
                hoursRemaining: Math.ceil(msRemaining / (1000 * 60 * 60))
            };
        }

        // Calculate streak
        const hoursSinceLastLogin = user.lastLogin
            ? (now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60)
            : 999;

        let newStreak;
        let streakReset = false;

        // Check for streak protection
        const happyHour = await this.getActiveHappyHour();
        const isProtected = user.streakFrozen || (happyHour?.bonusType === 'STREAK_PROTECT');

        if (hoursSinceLastLogin < 48 || isProtected) {
            // Within grace period or protected - increment
            newStreak = user.currentStreak + 1;
        } else {
            // Grace period expired - RESET (trigger loss aversion)
            newStreak = 1;
            streakReset = true;
        }

        const reward = getStreakReward(newStreak);
        const nextClaim = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Apply happy hour multipliers
        let finalChips = reward.chips;
        let finalXp = reward.xp;

        if (happyHour) {
            const config = HAPPY_HOUR_CONFIGS[happyHour.bonusType];
            finalChips = Math.floor(finalChips * config.chipMultiplier);
            finalXp = Math.floor(finalXp * config.xpMultiplier);
        }

        // Roll for mystery bonus
        let mysteryBonus = null;
        if (reward.bonusChance && Math.random() < reward.bonusChance) {
            mysteryBonus = reward.bonus || await this.rollMysteryTier();
        }

        // Process in transaction
        const result = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: userId },
                data: {
                    chipBalance: { increment: finalChips },
                    xpPoints: { increment: finalXp },
                    currentStreak: newStreak,
                    bestStreak: Math.max(newStreak, user.bestStreak),
                    lastLogin: now,
                    nextStreakReward: nextClaim,
                    streakFrozen: false
                }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: finalChips,
                    type: 'DAILY_STREAK',
                    balanceBefore: user.chipBalance,
                    balanceAfter: updated.chipBalance,
                    description: `Daily Streak - Day ${newStreak}${streakReset ? ' (Reset)' : ''}`,
                    metadata: {
                        streakDay: newStreak,
                        xpEarned: finalXp,
                        bonus: mysteryBonus,
                        wasReset: streakReset,
                        happyHour: happyHour?.bonusType || null
                    }
                }
            });

            return updated;
        });

        // Update syndicate XP if member
        if (user.syndicateMembership) {
            await this.prisma.syndicate.update({
                where: { id: user.syndicateMembership.syndicateId },
                data: { weeklyXP: { increment: finalXp } }
            });
        }

        // Cache streak data
        await this.redis.setex(`user:${userId}:streak`, 86400, JSON.stringify({
            day: newStreak,
            nextClaim: nextClaim.toISOString()
        }));

        // Emit milestone events
        if (newStreak >= 7 && newStreak % 7 === 0) {
            await this.emitMilestoneEvent(userId, user.displayName, newStreak, finalChips);
        }

        return {
            success: true,
            streakDay: newStreak,
            wasReset: streakReset,
            reward: {
                chips: finalChips,
                xp: finalXp,
                tier: reward.tier,
                bonus: mysteryBonus
            },
            nextClaimAt: nextClaim,
            newBalance: result.chipBalance,
            happyHourApplied: !!happyHour
        };
    }

    // =========================================================================
    // MYSTERY DROPS V2 - Variable Reward Schedule
    // =========================================================================

    /**
     * Roll for mystery drop with context-aware probability
     */
    async rollMysteryDrop(userId, context = {}) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) return { triggered: false };

        // Calculate drop chance based on context
        let dropChance = DROP_CHANCES.BASE;

        // Streak bonus (capped)
        const streakBonus = Math.min(user.currentStreak * DROP_CHANCES.STREAK_BONUS, 0.02);
        dropChance += streakBonus;

        // Context modifiers
        if (context.isHappyHour) {
            dropChance = DROP_CHANCES.HAPPY_HOUR;
        }
        if (context.wonBig) {
            dropChance = Math.max(dropChance, DROP_CHANCES.BIG_WIN);
        }
        if (context.justLost) {
            dropChance = Math.max(dropChance, DROP_CHANCES.LOSS_CONSOLATION);
        }

        // Happy hour mystery boost
        const happyHour = await this.getActiveHappyHour();
        if (happyHour?.bonusType === 'MYSTERY_BOOST') {
            dropChance *= HAPPY_HOUR_CONFIGS.MYSTERY_BOOST.dropMultiplier;
        }

        // Roll
        if (Math.random() > dropChance) {
            return { triggered: false };
        }

        // Determine tier
        const tier = this.rollMysteryTier();

        // Calculate reward within tier
        const chipAmount = Math.floor(
            Math.random() * (tier.maxChips - tier.minChips) + tier.minChips
        );

        // Credit reward
        const result = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: userId },
                data: {
                    chipBalance: { increment: chipAmount },
                    xpPoints: { increment: tier.xpBonus },
                    lastMysteryDrop: new Date(),
                    mysteryDropCount: { increment: 1 },
                    totalMysteryChips: { increment: chipAmount }
                }
            });

            await tx.transaction.create({
                data: {
                    userId,
                    amount: chipAmount,
                    type: 'MYSTERY_DROP',
                    balanceBefore: user.chipBalance,
                    balanceAfter: updated.chipBalance,
                    description: `Mystery Drop - ${tier.name}`,
                    metadata: {
                        tier: tier.name,
                        xpBonus: tier.xpBonus,
                        dropNumber: user.mysteryDropCount + 1,
                        context
                    }
                }
            });

            return updated;
        });

        // Emit event for ticker
        await this.emitMysteryDropEvent(userId, user.displayName, tier.name, chipAmount);

        return {
            triggered: true,
            tier: tier.name,
            chips: chipAmount,
            xp: tier.xpBonus,
            newBalance: result.chipBalance
        };
    }

    /**
     * Roll mystery tier using weighted random
     */
    rollMysteryTier() {
        const totalWeight = MYSTERY_DROP_TIERS.reduce((sum, t) => sum + t.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const tier of MYSTERY_DROP_TIERS) {
            roll -= tier.weight;
            if (roll <= 0) return tier;
        }

        return MYSTERY_DROP_TIERS[0]; // Fallback to common
    }

    // =========================================================================
    // HAPPY HOUR ENGINE
    // =========================================================================

    /**
     * Get currently active happy hour
     */
    async getActiveHappyHour() {
        const now = new Date();

        // Check cache first
        const cached = await this.redis.get('happy_hour:active');
        if (cached) {
            const event = JSON.parse(cached);
            if (new Date(event.endTime) > now) {
                return event;
            }
        }

        // Query database
        const activeEvent = await this.prisma.happyHour.findFirst({
            where: {
                active: true,
                startTime: { lte: now },
                endTime: { gte: now }
            }
        });

        if (activeEvent) {
            // Cache for quick access
            await this.redis.setex('happy_hour:active', 300, JSON.stringify(activeEvent));
        }

        return activeEvent;
    }

    /**
     * Trigger a new happy hour event
     */
    async triggerHappyHour(bonusType = 'XP_BOOST', durationMinutes = 60, multiplier = 1.5) {
        const now = new Date();
        const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

        const event = await this.prisma.happyHour.create({
            data: {
                id: crypto.randomUUID(),
                startTime: now,
                endTime,
                multiplier,
                active: true
            }
        });

        // Also create schedule record for tracking
        await this.prisma.happyHourSchedule.create({
            data: {
                durationMinutes,
                multiplier,
                bonusType,
                isRandom: true
            }
        });

        // Cache and broadcast
        await this.redis.setex('happy_hour:active', durationMinutes * 60, JSON.stringify({
            ...event,
            bonusType
        }));

        await this.redis.publish('happy_hour:start', JSON.stringify({
            bonusType,
            multiplier,
            endTime,
            durationMinutes
        }));

        return event;
    }

    /**
     * Check and trigger random happy hours (called by scheduler)
     */
    async checkRandomHappyHour() {
        // Get active schedules
        const schedules = await this.prisma.happyHourSchedule.findMany({
            where: {
                isActive: true,
                isRandom: true
            }
        });

        if (schedules.length === 0) return;

        // Check if any happy hour is currently active
        const currentActive = await this.getActiveHappyHour();
        if (currentActive) return;

        // Check last happy hour end time
        const lastEvent = await this.prisma.happyHour.findFirst({
            orderBy: { endTime: 'desc' }
        });

        const minGapHours = schedules[0]?.minGapHours || 4;
        const minGapMs = minGapHours * 60 * 60 * 1000;

        if (lastEvent && (Date.now() - lastEvent.endTime.getTime()) < minGapMs) {
            return; // Too soon since last event
        }

        // Random chance to trigger (10% per check)
        if (Math.random() > 0.1) return;

        // Pick random bonus type
        const bonusTypes = ['XP_BOOST', 'CHIP_BOOST', 'MYSTERY_BOOST', 'STREAK_PROTECT'];
        const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];

        await this.triggerHappyHour(bonusType);
    }

    // =========================================================================
    // XP & LEVELING V2
    // =========================================================================

    /**
     * Award XP with multipliers and syndicate integration
     */
    async awardXP(userId, baseXP, source = 'GAME') {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { syndicateMembership: true }
        });

        if (!user) throw new Error('User not found');

        // Apply happy hour multiplier
        const happyHour = await this.getActiveHappyHour();
        let multiplier = 1.0;
        if (happyHour) {
            const config = HAPPY_HOUR_CONFIGS[happyHour.bonusType];
            multiplier = config.xpMultiplier;
        }

        const actualXP = Math.floor(baseXP * multiplier);

        const newXP = user.xpPoints + actualXP;
        const xpRequired = this.getXPForLevel(user.xpLevel + 1);

        let leveledUp = false;
        let newLevel = user.xpLevel;
        let levelBonus = 0;

        if (newXP >= xpRequired) {
            newLevel = user.xpLevel + 1;
            leveledUp = true;
            levelBonus = newLevel * 1000; // 1000 chips per level

            await this.prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        xpPoints: newXP,
                        xpLevel: newLevel,
                        chipBalance: { increment: levelBonus }
                    }
                });

                await tx.transaction.create({
                    data: {
                        userId,
                        amount: levelBonus,
                        type: 'LEVEL_UP_BONUS',
                        balanceBefore: user.chipBalance,
                        balanceAfter: BigInt(user.chipBalance) + BigInt(levelBonus),
                        description: `Level ${newLevel} Bonus`
                    }
                });
            });

            await this.emitLevelUpEvent(userId, user.displayName, newLevel);

            // Check referral milestone
            if (newLevel === 5) {
                // Trigger in ReferralService
            }
        } else {
            await this.prisma.user.update({
                where: { id: userId },
                data: { xpPoints: newXP }
            });
        }

        // Update syndicate weekly XP
        if (user.syndicateMembership) {
            await this.prisma.syndicate.update({
                where: { id: user.syndicateMembership.syndicateId },
                data: { weeklyXP: { increment: actualXP } }
            });
        }

        return {
            xpAwarded: actualXP,
            totalXP: newXP,
            leveledUp,
            newLevel: leveledUp ? newLevel : undefined,
            levelBonus: leveledUp ? levelBonus : undefined,
            happyHourApplied: multiplier > 1
        };
    }

    /**
     * Calculate XP needed for a level (exponential)
     */
    getXPForLevel(level) {
        return level * level * 100;
    }

    // =========================================================================
    // NEAR-MISS DETECTION - Enhanced loss aversion
    // =========================================================================

    /**
     * Detect near-miss scenarios for enhanced feedback
     */
    detectNearMiss(gameType, playerResult, dealerResult) {
        const result = { isNearMiss: false, type: null, intensity: 0 };

        if (gameType === 'WAR') {
            const diff = dealerResult - playerResult;
            if (diff === 1) {
                result.isNearMiss = true;
                result.type = 'ONE_AWAY';
                result.intensity = 0.9;
            } else if (diff === 2) {
                result.isNearMiss = true;
                result.type = 'CLOSE';
                result.intensity = 0.6;
            }
        }

        if (gameType === 'BLACKJACK') {
            if (playerResult === 22) {
                result.isNearMiss = true;
                result.type = 'BUST_BY_ONE';
                result.intensity = 0.95;
            } else if (playerResult === 20 && dealerResult === 21) {
                result.isNearMiss = true;
                result.type = 'DEALER_21';
                result.intensity = 0.85;
            }
        }

        if (gameType === 'BINGO') {
            // Near-miss: Had 4 of 5 in a row/column
            // This would be passed in as context
        }

        return result;
    }

    /**
     * Process near-miss for consolation drop chance
     */
    async processNearMiss(userId, nearMissResult) {
        if (!nearMissResult.isNearMiss) return null;

        // Higher intensity = higher consolation drop chance
        const dropChance = nearMissResult.intensity * DROP_CHANCES.LOSS_CONSOLATION * 2;

        if (Math.random() < dropChance) {
            return this.rollMysteryDrop(userId, {
                justLost: true,
                nearMiss: nearMissResult.type
            });
        }

        return null;
    }

    // =========================================================================
    // GLOBAL EVENT EMISSION
    // =========================================================================

    async emitMilestoneEvent(userId, userName, streakDay, chips) {
        const event = {
            type: 'STREAK_MILESTONE',
            userId,
            data: { userName, streakDay, chips }
        };

        await this.redis.lpush('global:ticker', JSON.stringify(event));
        await this.redis.ltrim('global:ticker', 0, 99);
    }

    async emitMysteryDropEvent(userId, userName, tier, amount) {
        // Only broadcast rare+ drops
        if (!['RARE', 'EPIC', 'LEGENDARY'].includes(tier)) return;

        const event = {
            type: 'MYSTERY_DROP',
            userId,
            data: { userName, tier, amount }
        };

        await this.redis.lpush('global:ticker', JSON.stringify(event));
        await this.redis.ltrim('global:ticker', 0, 99);
    }

    async emitLevelUpEvent(userId, userName, level) {
        const event = {
            type: 'LEVEL_UP',
            userId,
            data: { userName, level }
        };

        await this.redis.lpush('global:ticker', JSON.stringify(event));
        await this.redis.ltrim('global:ticker', 0, 99);
    }

    // =========================================================================
    // BIG WIN RECORDING
    // =========================================================================

    async recordBigWin(userId, amount, gameType, gameSessionId) {
        const TICKER_THRESHOLD = 1000;

        if (amount < TICKER_THRESHOLD) return;

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        // Update user stats
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                publicWins: { increment: 1 },
                biggestWin: amount > Number(user.biggestWin) ? amount : undefined,
                biggestWinGameId: amount > Number(user.biggestWin) ? gameSessionId : undefined
            }
        });

        // Emit to ticker
        const event = {
            type: 'BIG_WIN',
            userId,
            data: {
                userName: user.nickname || user.displayName,
                amount,
                gameType
            }
        };

        await this.redis.lpush('global:ticker', JSON.stringify(event));
        await this.redis.ltrim('global:ticker', 0, 99);

        // Roll for mystery drop on big win
        await this.rollMysteryDrop(userId, { wonBig: true });
    }
}

// Singleton
let engagementServiceV2 = null;

function initEngagementServiceV2(prisma, redis, syndicateService) {
    engagementServiceV2 = new EngagementServiceV2(prisma, redis, syndicateService);
    return engagementServiceV2;
}

function getEngagementServiceV2() {
    if (!engagementServiceV2) {
        throw new Error('EngagementServiceV2 not initialized');
    }
    return engagementServiceV2;
}

module.exports = {
    EngagementServiceV2,
    initEngagementServiceV2,
    getEngagementServiceV2,
    getStreakReward,
    STREAK_REWARDS,
    MYSTERY_DROP_TIERS,
    DROP_CHANCES,
    HAPPY_HOUR_CONFIGS
};
