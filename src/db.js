// Database utilities for VegasCore
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Daily chip reset check
async function checkDailyReset(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { googleId: userId },
    });

    if (!user) return null;

    const now = new Date();
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
    
    // Check if it's a new day (EST timezone)
    const isNewDay = !lastLogin || (
      now.toLocaleDateString('en-US', { timeZone: 'America/New_York' }) !==
      lastLogin.toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    );

    if (isNewDay) {
      // Reset to daily chip amount (1000)
      const DAILY_CHIPS = 1000n;
      
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          chipBalance: DAILY_CHIPS,
          lastLogin: now,
          // Update streak logic
          currentStreak: lastLogin && isWithin24Hours(lastLogin, now) 
            ? user.currentStreak + 1 
            : 1,
          bestStreak: Math.max(
            user.bestStreak, 
            lastLogin && isWithin24Hours(lastLogin, now) 
              ? user.currentStreak + 1 
              : 1
          ),
        },
      });

      // Create transaction record for daily bonus
      await prisma.transaction.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          amount: Number(DAILY_CHIPS),
          type: 'DAILY_STREAK',
          balanceBefore: user.chipBalance,
          balanceAfter: DAILY_CHIPS,
          description: `Daily chip reset - Day ${updated.currentStreak}`,
        },
      });

      return updated;
    }

    // Just update last login
    return await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now },
    });
  } catch (error) {
    console.error('Daily reset check failed:', error);
    return null;
  }
}

function isWithin24Hours(date1, date2) {
  const diff = Math.abs(date2 - date1);
  return diff <= 24 * 60 * 60 * 1000 + (2 * 60 * 60 * 1000); // 24h + 2h grace
}

// Get or create user
async function getOrCreateUser(googleProfile) {
  try {
    let user = await prisma.user.findUnique({
      where: { googleId: googleProfile.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          googleId: googleProfile.id,
          email: googleProfile.emails?.[0]?.value || null,
          displayName: googleProfile.displayName,
          avatarUrl: googleProfile.photos?.[0]?.value || null,
          chipBalance: 1000n,
          lastLogin: new Date(),
          currentStreak: 1,
        },
      });

      // Welcome transaction
      await prisma.transaction.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          amount: 1000,
          type: 'ADMIN_CREDIT',
          balanceBefore: 0n,
          balanceAfter: 1000n,
          description: 'Welcome to Moe\'s Card Room!',
        },
      });
    } else {
      // Check daily reset
      user = await checkDailyReset(googleProfile.id);
    }

    return user;
  } catch (error) {
    console.error('User creation/retrieval failed:', error);
    throw error;
  }
}

// Update user chips (with transaction record)
async function updateUserChips(userId, amount, type, description, gameSessionId = null) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const newBalance = BigInt(user.chipBalance) + BigInt(amount);
    
    if (newBalance < 0n) {
      throw new Error('Insufficient chips');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { chipBalance: newBalance },
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        amount: Number(amount),
        type,
        balanceBefore: user.chipBalance,
        balanceAfter: newBalance,
        gameSessionId,
        description,
      },
    });

    return updated;
  } catch (error) {
    console.error('Chip update failed:', error);
    throw error;
  }
}

// Check if user can play (has chips)
async function canUserPlay(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user && user.chipBalance > 0n;
  } catch (error) {
    return false;
  }
}

module.exports = {
  prisma,
  checkDailyReset,
  getOrCreateUser,
  updateUserChips,
  canUserPlay,
};
