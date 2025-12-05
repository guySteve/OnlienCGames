/**
 * 🎮 Engagement Enhancement Service
 *
 * PURPOSE: Create engaging, fun experiences that keep players coming back
 * while maintaining ethical design principles
 *
 * PHILOSOPHY:
 * - Reward consistent play, not addictive behavior
 * - Celebrate wins with exciting visuals/audio
 * - Provide positive reinforcement without manipulation
 * - Maintain transparency about odds and outcomes
 * - Focus on social features and skill progression
 *
 * ETHICAL GUIDELINES:
 * ❌ NO: Deliberate "near misses" designed to exploit psychology
 * ❌ NO: Stress-level tracking to manipulate vulnerable players
 * ❌ NO: Overcompensating rewards to create false hope
 * ✅ YES: Fair, transparent game mechanics
 * ✅ YES: Exciting celebrations for genuine wins
 * ✅ YES: Social features that build community
 * ✅ YES: Skill-based progression systems
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class EngagementEnhancementService {
  constructor() {
    // Visual/audio intensity levels (not tied to player stress)
    this.celebrationLevels = {
      SMALL: { chips: 0, multiplier: 1.0, particles: 'sparkles' },
      MEDIUM: { chips: 500, multiplier: 1.5, particles: 'goldExplosion' },
      LARGE: { chips: 1000, multiplier: 2.0, particles: 'goldExplosion', sound: 'big_win' },
      JACKPOT: { chips: 5000, multiplier: 3.0, particles: 'goldExplosion', sound: 'jackpot', confetti: true }
    };

    // Achievement milestones (skill-based progression)
    this.achievements = {
      FIRST_WIN: { chips: 100, xp: 50, badge: 'Beginner\'s Luck' },
      WIN_STREAK_5: { chips: 250, xp: 100, badge: 'Hot Streak' },
      WIN_STREAK_10: { chips: 500, xp: 250, badge: 'On Fire!' },
      DAILY_PLAYER_7: { chips: 1000, xp: 500, badge: 'Dedicated' },
      DAILY_PLAYER_30: { chips: 5000, xp: 2000, badge: 'Legend' },
      BLACKJACK_MASTER: { chips: 1000, xp: 500, badge: 'Card Shark' },
      WAR_VETERAN: { chips: 1000, xp: 500, badge: 'War Hero' }
    };

    // Fair daily bonus slot (no illusion of control)
    this.dailyBonusSlots = [
      { chips: 100, weight: 40 },  // 40% chance
      { chips: 250, weight: 30 },  // 30% chance
      { chips: 500, weight: 20 },  // 20% chance
      { chips: 1000, weight: 9 },  // 9% chance
      { chips: 5000, weight: 1 }   // 1% chance (jackpot)
    ];
  }

  // ============================================================
  // WIN CELEBRATION SYSTEM
  // Provides exciting feedback for legitimate wins
  // ============================================================

  /**
   * Calculate celebration level based on win amount
   * Returns visual/audio effects to display
   */
  getCelebrationLevel(winAmount) {
    if (winAmount >= this.celebrationLevels.JACKPOT.chips) {
      return {
        level: 'JACKPOT',
        ...this.celebrationLevels.JACKPOT,
        message: '🎰 JACKPOT! INCREDIBLE WIN!',
        animation: 'jackpot',
        duration: 5000
      };
    } else if (winAmount >= this.celebrationLevels.LARGE.chips) {
      return {
        level: 'LARGE',
        ...this.celebrationLevels.LARGE,
        message: '🎉 BIG WIN!',
        animation: 'big_win',
        duration: 3000
      };
    } else if (winAmount >= this.celebrationLevels.MEDIUM.chips) {
      return {
        level: 'MEDIUM',
        ...this.celebrationLevels.MEDIUM,
        message: '✨ Nice Win!',
        animation: 'medium_win',
        duration: 2000
      };
    } else {
      return {
        level: 'SMALL',
        ...this.celebrationLevels.SMALL,
        message: '✓ Win',
        animation: 'small_win',
        duration: 1000
      };
    }
  }

  /**
   * Process win celebration
   * Returns effects config for frontend to display
   */
  async processWinCelebration(userId, gameType, winAmount) {
    const celebration = this.getCelebrationLevel(winAmount);

    // Track win in user history for streak detection
    await this.trackWin(userId, gameType, winAmount);

    // Check for achievement unlocks
    const achievements = await this.checkAchievements(userId, gameType);

    return {
      celebration,
      achievements,
      effects: {
        particles: celebration.particles,
        sound: celebration.sound,
        confetti: celebration.confetti,
        animation: celebration.animation,
        message: celebration.message,
        duration: celebration.duration
      }
    };
  }

  // ============================================================
  // ACHIEVEMENT SYSTEM
  // Skill-based progression, not addiction mechanics
  // ============================================================

  async checkAchievements(userId, gameType) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        achievements: true
      }
    });

    const newAchievements = [];

    // Check daily login streaks (rewards consistency)
    if (user.dailyStreak === 7) {
      newAchievements.push(await this.unlockAchievement(userId, 'DAILY_PLAYER_7'));
    }
    if (user.dailyStreak === 30) {
      newAchievements.push(await this.unlockAchievement(userId, 'DAILY_PLAYER_30'));
    }

    // Check game-specific achievements
    const gameStats = await this.getGameStats(userId, gameType);

    if (gameType === 'BLACKJACK' && gameStats.blackjackCount === 10) {
      newAchievements.push(await this.unlockAchievement(userId, 'BLACKJACK_MASTER'));
    }

    if (gameType === 'WAR' && gameStats.gamesPlayed === 100) {
      newAchievements.push(await this.unlockAchievement(userId, 'WAR_VETERAN'));
    }

    return newAchievements;
  }

  async unlockAchievement(userId, achievementKey) {
    const achievement = this.achievements[achievementKey];
    if (!achievement) return null;

    // Check if already unlocked
    const existing = await prisma.achievement.findFirst({
      where: { userId, name: achievement.badge }
    });

    if (existing) return null;

    // Award chips and XP
    await prisma.user.update({
      where: { id: userId },
      data: {
        chipBalance: { increment: achievement.chips },
        xpPoints: { increment: achievement.xp }
      }
    });

    // Create achievement record
    const newAchievement = await prisma.achievement.create({
      data: {
        userId,
        name: achievement.badge,
        description: `Unlocked: ${achievement.badge}`,
        rewardChips: achievement.chips,
        rewardXp: achievement.xp,
        unlockedAt: new Date()
      }
    });

    return {
      ...newAchievement,
      celebration: {
        message: `🏆 Achievement Unlocked: ${achievement.badge}!`,
        chips: achievement.chips,
        xp: achievement.xp,
        animation: 'achievement_unlock',
        sound: 'achievement'
      }
    };
  }

  // ============================================================
  // DAILY BONUS SLOT SYSTEM
  // Transparent odds, no "illusion of control"
  // ============================================================

  /**
   * Claim daily bonus using weighted random selection
   * Shows actual odds to user (transparency)
   */
  async claimDailyBonus(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Check if already claimed today
    const lastClaimed = user.lastDailyReward;
    const today = new Date().toDateString();

    if (lastClaimed && new Date(lastClaimed).toDateString() === today) {
      return {
        error: 'Daily bonus already claimed today',
        nextClaimAt: new Date(new Date(lastClaimed).getTime() + 24 * 60 * 60 * 1000)
      };
    }

    // Weighted random selection (fair odds)
    const totalWeight = this.dailyBonusSlots.reduce((sum, slot) => sum + slot.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedSlot = this.dailyBonusSlots[0];
    for (const slot of this.dailyBonusSlots) {
      random -= slot.weight;
      if (random <= 0) {
        selectedSlot = slot;
        break;
      }
    }

    // Award chips
    await prisma.user.update({
      where: { id: userId },
      data: {
        chipBalance: { increment: selectedSlot.chips },
        lastDailyReward: new Date()
      }
    });

    // Log transaction
    await prisma.transaction.create({
      data: {
        userId,
        type: 'DAILY_REWARD',
        amount: selectedSlot.chips,
        description: `Daily bonus: ${selectedSlot.chips} chips`,
        balanceBefore: user.chipBalance,
        balanceAfter: user.chipBalance + selectedSlot.chips
      }
    });

    return {
      chips: selectedSlot.chips,
      celebration: this.getCelebrationLevel(selectedSlot.chips),
      // TRANSPARENCY: Show actual odds to user
      odds: this.dailyBonusSlots.map(slot => ({
        chips: slot.chips,
        probability: `${(slot.weight / totalWeight * 100).toFixed(1)}%`
      }))
    };
  }

  // ============================================================
  // SOCIAL ENGAGEMENT FEATURES
  // Build community, not addiction
  // ============================================================

  /**
   * Friend activity feed
   * Shows recent wins to create positive social dynamics
   */
  async getFriendActivity(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        friends: {
          include: {
            friend: {
              include: {
                transactions: {
                  where: { type: 'WIN' },
                  orderBy: { timestamp: 'desc' },
                  take: 5
                }
              }
            }
          }
        }
      }
    });

    const activity = user.friends.flatMap(friendship =>
      friendship.friend.transactions.map(tx => ({
        username: friendship.friend.username,
        amount: tx.amount,
        timestamp: tx.timestamp,
        game: tx.description
      }))
    );

    return activity.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }

  /**
   * Leaderboard system
   * Encourages friendly competition
   */
  async getLeaderboard(period = 'weekly', limit = 10) {
    const startDate = this.getStartDate(period);

    const topPlayers = await prisma.user.findMany({
      where: {
        transactions: {
          some: {
            type: 'WIN',
            timestamp: { gte: startDate }
          }
        }
      },
      select: {
        id: true,
        username: true,
        xpLevel: true,
        vipTier: true,
        transactions: {
          where: {
            type: 'WIN',
            timestamp: { gte: startDate }
          },
          select: { amount: true }
        }
      },
      take: limit
    });

    return topPlayers.map(player => ({
      username: player.username,
      level: player.xpLevel,
      vipTier: player.vipTier,
      totalWinnings: player.transactions.reduce((sum, tx) => sum + tx.amount, 0)
    })).sort((a, b) => b.totalWinnings - a.totalWinnings);
  }

  // ============================================================
  // RESPONSIBLE GAMING FEATURES
  // ============================================================

  /**
   * Session time tracking
   * Gentle reminders for healthy play habits
   */
  async trackSessionTime(userId, sessionDuration) {
    // Gentle reminders (not restrictions)
    const reminders = [
      { threshold: 60, message: 'You\'ve been playing for 1 hour. Remember to take breaks!' },
      { threshold: 120, message: 'You\'ve been playing for 2 hours. Time for a stretch?' },
      { threshold: 180, message: 'You\'ve been playing for 3 hours. Consider taking a longer break.' }
    ];

    const applicableReminder = reminders
      .filter(r => sessionDuration >= r.threshold)
      .pop();

    return applicableReminder || null;
  }

  /**
   * Loss limit awareness (optional user setting)
   * Helps players manage their bankroll
   */
  async checkLossLimit(userId, currentSession) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lossLimitEnabled: true, lossLimitAmount: true }
    });

    if (!user.lossLimitEnabled) return null;

    const sessionLosses = currentSession.bets - currentSession.wins;

    if (sessionLosses >= user.lossLimitAmount) {
      return {
        limitReached: true,
        message: 'You\'ve reached your session loss limit. Consider taking a break.',
        losses: sessionLosses,
        limit: user.lossLimitAmount
      };
    }

    return null;
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  async trackWin(userId, gameType, amount) {
    await prisma.transaction.create({
      data: {
        userId,
        type: 'WIN',
        amount,
        description: `${gameType} win: ${amount} chips`
      }
    });
  }

  async getGameStats(userId, gameType) {
    const sessions = await prisma.gameSession.findMany({
      where: { hostUserId: userId, gameType }
    });

    return {
      gamesPlayed: sessions.length,
      blackjackCount: sessions.filter(s => s.result === 'BLACKJACK').length,
      wins: sessions.filter(s => s.result === 'PLAYER_WIN' || s.result === 'BLACKJACK').length,
      losses: sessions.filter(s => s.result === 'DEALER_WIN').length
    };
  }

  getStartDate(period) {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        return new Date(now.getFullYear(), now.getMonth(), diff);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        return new Date(0);
    }
  }
}

module.exports = new EngagementEnhancementService();
