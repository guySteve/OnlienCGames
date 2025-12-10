/**
 * VegasCore Engagement Service
 * 
 * "The North End" - Aggressive retention mechanics designed to maximize DAU
 * 
 * Key Psychological Principles:
 * 1. Loss Aversion (Streak reset fear)
 * 2. Variable Reward Schedule (Mystery Drops)
 * 3. Social Proof (Global ticker)
 * 4. Time Pressure (Happy Hour)
 */

import { PrismaClient, TransactionType } from '@prisma/client';
import * as crypto from 'crypto';
// import { Redis } from 'ioredis';

// Use any for Redis to support both node-redis and upstash/redis without strict type dependency
type Redis = any;

export class EngagementService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  // ==========================================================================
  // DAILY STREAK SYSTEM - Progressive Rewards with Loss Aversion
  // ==========================================================================

  /**
   * Calculate daily streak reward based on consecutive login days
   * Uses exponential scaling to create "must login" compulsion
   */
  private calculateStreakReward(day: number): {
    chips: number;
    xp: number;
    bonus?: string;
  } {
    const rewards = [
      { day: 1, chips: 1000, xp: 50 },
      { day: 2, chips: 1200, xp: 60 },
      { day: 3, chips: 1500, xp: 75 },
      { day: 4, chips: 2000, xp: 100 },
      { day: 5, chips: 2500, xp: 125 },
      { day: 6, chips: 3500, xp: 175 },
      { day: 7, chips: 5000, xp: 250, bonus: 'XP_BOOSTER_10' },
      { day: 14, chips: 10000, xp: 500, bonus: 'MYSTERY_CHEST' },
      { day: 30, chips: 25000, xp: 1000, bonus: 'VIP_DAY_PASS' }
    ];

    const match = rewards.reverse().find(r => day >= r.day) || rewards[0];
    
    // Linear scaling after day 7
    if (day > 7 && day < 14) {
      return {
        chips: 5000 + (day - 7) * 500,
        xp: 250 + (day - 7) * 25
      };
    }

    return match;
  }

  /**
   * Claim daily login reward
   * 
   * Business Logic:
   * - Must wait 24h between claims
   * - 24h grace period before streak resets (create urgency)
   * - Show countdown timer on frontend
   */
  async claimDailyReward(userId: string): Promise<{
    success: boolean;
    reward?: { chips: number; xp: number; day: number; bonus?: string };
    nextClaimAt?: Date;
    error?: string;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: 'User not found' };

    const now = new Date();

    // Check if user can claim
    if (user.nextStreakReward && now < user.nextStreakReward) {
      return {
        success: false,
        error: 'Already claimed today',
        nextClaimAt: user.nextStreakReward
      };
    }

    // Calculate streak
    let newStreak = 1;
    const hoursSinceLastLogin = user.lastLogin
      ? (now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60)
      : 999;

    if (hoursSinceLastLogin < 48) {
      // Within grace period - increment streak
      newStreak = user.currentStreak + 1;
    } else {
      // Grace period expired - RESET TO DAY 1 (loss aversion trigger)
      newStreak = 1;
    }

    const reward = this.calculateStreakReward(newStreak);
    const nextClaim = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Update user in transaction
    await this.prisma.$transaction(async (tx) => {
      // Credit chips
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          chipBalance: { increment: reward.chips },
          xpPoints: { increment: reward.xp },
          currentStreak: newStreak,
          bestStreak: Math.max(newStreak, user.bestStreak),
          lastLogin: now,
          nextStreakReward: nextClaim,
          streakFrozen: false
        }
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          amount: reward.chips,
          type: TransactionType.DAILY_STREAK,
          balanceBefore: user.chipBalance,
          balanceAfter: updated.chipBalance,
          description: `Daily Streak Reward - Day ${newStreak}`,
          metadata: {
            streakDay: newStreak,
            xpEarned: reward.xp,
            bonus: reward.bonus
          }
        }
      });

      return updated;
    });

    // Cache in Redis for fast access
    await this.redis.setex(
      `user:${userId}:streak`,
      86400,
      JSON.stringify({ day: newStreak, nextClaim: nextClaim.toISOString() })
    );

    // Emit global event if streak is notable
    if (newStreak >= 7) {
      await this.emitGlobalEvent({
        type: 'STREAK_MILESTONE',
        userId,
        data: { streak: newStreak, userName: user.displayName }
      });
    }

    return {
      success: true,
      reward: { ...reward, day: newStreak },
      nextClaimAt: nextClaim
    };
  }

  /**
   * Get streak status without claiming
   */
  async getStreakStatus(userId: string): Promise<{
    currentStreak: number;
    nextReward: { chips: number; xp: number; bonus?: string };
    canClaimAt: Date | null;
    hoursUntilReset: number;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const nextReward = this.calculateStreakReward(user.currentStreak + 1);
    const now = new Date();
    
    let hoursUntilReset = 0;
    if (user.lastLogin) {
      const hoursSinceLogin = (now.getTime() - user.lastLogin.getTime()) / (1000 * 60 * 60);
      hoursUntilReset = Math.max(0, 48 - hoursSinceLogin);
    }

    return {
      currentStreak: user.currentStreak,
      nextReward,
      canClaimAt: user.nextStreakReward,
      hoursUntilReset
    };
  }

  // ==========================================================================
  // MYSTERY DROPS - Variable Reward Schedule
  // ==========================================================================

  /**
   * Roll for mystery drop after each hand
   * 0.5% base chance (1 in 200 hands)
   * 
   * Psychological principle: Unpredictable rewards create strongest addiction
   */
  async rollMysteryDrop(userId: string): Promise<{
    triggered: boolean;
    amount?: number;
  }> {
    const roll = Math.random();
    const DROP_CHANCE = 0.005; // 0.5%

    if (roll > DROP_CHANCE) {
      return { triggered: false };
    }

    // Variable reward: 50-500 chips (10x range creates excitement)
    const amount = Math.floor(Math.random() * 450) + 50;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { triggered: false };

    // Credit in transaction
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          chipBalance: { increment: amount },
          lastMysteryDrop: new Date(),
          mysteryDropCount: { increment: 1 },
          totalMysteryChips: { increment: amount }
        }
      });

      await tx.transaction.create({
        data: {
          userId,
          amount,
          type: TransactionType.MYSTERY_DROP,
          balanceBefore: user.chipBalance,
          balanceAfter: updated.chipBalance,
          description: '🎁 Mystery Drop!',
          metadata: { dropNumber: user.mysteryDropCount + 1 }
        }
      });
    });

    // Emit to global ticker
    await this.emitGlobalEvent({
      type: 'MYSTERY_DROP',
      userId,
      data: { amount, userName: user.displayName }
    });

    return { triggered: true, amount };
  }

  // ==========================================================================
  // SOCIAL PROOF - Global Event Ticker
  // ==========================================================================

  /**
   * Broadcast big events to all connected users
   * Creates FOMO and social envy
   */
  async emitGlobalEvent(event: {
    type: 'BIG_WIN' | 'MYSTERY_DROP' | 'STREAK_MILESTONE' | 'LEVEL_UP';
    userId: string;
    data: any;
  }): Promise<void> {
    await this.redis.lpush('global:ticker', JSON.stringify(event));
    await this.redis.ltrim('global:ticker', 0, 99); // Keep last 100 events
    await this.redis.expire('global:ticker', 3600);

    // Frontend listens to socket.io channel 'global:ticker'
  }

  /**
   * Record big win for global ticker
   */
  async recordBigWin(userId: string, amount: number, gameType: string): Promise<void> {
    const TICKER_THRESHOLD = 1000;
    if (amount < TICKER_THRESHOLD) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        publicWins: { increment: 1 },
        biggestWin: amount > user.biggestWin ? amount : user.biggestWin
      }
    });

    await this.emitGlobalEvent({
      type: 'BIG_WIN',
      userId,
      data: {
        amount,
        gameType,
        userName: user.displayName
      }
    });
  }

  // ==========================================================================
  // HAPPY HOUR - Time-Limited Multiplier Events
  // ==========================================================================

  /**
   * Check if Happy Hour is currently active
   * Returns multiplier (e.g., 1.5x XP/chips)
   */
  async getActiveMultiplier(): Promise<number> {
    const now = new Date();
    
    const activeEvent = await this.prisma.happyHour.findFirst({
      where: {
        active: true,
        startTime: { lte: now },
        endTime: { gte: now }
      }
    });

    return activeEvent?.multiplier || 1.0;
  }

  /**
   * Trigger random Happy Hour (admin/cron triggered)
   * Duration: 60 minutes
   */
  async triggerHappyHour(multiplier: number = 1.5): Promise<void> {
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);

    await this.prisma.happyHour.create({
      data: {
        id: crypto.randomUUID(),
        startTime: now,
        endTime,
        multiplier,
        active: true
      }
    });

    // Broadcast to all users
    await this.redis.publish('happy-hour:start', JSON.stringify({ multiplier, endTime }));
  }

  // ==========================================================================
  // XP & LEVELING SYSTEM
  // ==========================================================================

  /**
   * Award XP and check for level up
   * Level formula: XP required = level^2 * 100
   */
  async awardXP(userId: string, baseXP: number): Promise<{
    xpAwarded: number;
    leveledUp: boolean;
    newLevel?: number;
  }> {
    const multiplier = await this.getActiveMultiplier();
    const actualXP = Math.floor(baseXP * multiplier);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const newXP = user.xpPoints + actualXP;
    const xpRequired = user.xpLevel ** 2 * 100;

    let leveledUp = false;
    let newLevel = user.xpLevel;

    if (newXP >= xpRequired) {
      newLevel = user.xpLevel + 1;
      leveledUp = true;

      // Level up bonus: 1000 chips per level
      const levelBonus = newLevel * 1000;

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
            type: TransactionType.LEVEL_UP_BONUS,
            balanceBefore: user.chipBalance,
            balanceAfter: user.chipBalance + BigInt(levelBonus),
            description: `Level ${newLevel} Bonus`
          }
        });
      });

      await this.emitGlobalEvent({
        type: 'LEVEL_UP',
        userId,
        data: { level: newLevel, userName: user.displayName }
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { xpPoints: newXP }
      });
    }

    return { xpAwarded: actualXP, leveledUp, newLevel: leveledUp ? newLevel : undefined };
  }

  // ==========================================================================
  // NEAR-MISS DETECTION (for "juicy" frontend feedback)
  // ==========================================================================

  /**
   * Detect if loss was a "near miss" (amplifies loss aversion)
   * Example: Lost by 1 point in War, busted on 22 in Blackjack
   */
  detectNearMiss(gameType: string, playerValue: number, dealerValue: number): boolean {
    if (gameType === 'WAR') {
      return Math.abs(playerValue - dealerValue) === 1 && playerValue < dealerValue;
    }
    
    if (gameType === 'BLACKJACK') {
      return playerValue === 22; // Just busted
    }

    return false;
  }
}

/**
 * Singleton instance
 */
export let engagementService: EngagementService;

export function initEngagementService(prisma: PrismaClient, redis: Redis): void {
  engagementService = new EngagementService(prisma, redis);
}
