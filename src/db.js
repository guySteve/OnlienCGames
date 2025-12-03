// Database utilities for VegasCore
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Daily chip reset check
async function checkDailyReset(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { googleId: userId },
    });

    if (!user) {
      console.log('⚠️ User not found for daily reset check');
      return null;
    }

    const now = new Date();
    const nextReward = user.nextStreakReward ? new Date(user.nextStreakReward) : null;
    
    // Check if reward is claimable based on nextStreakReward field
    const canClaim = !nextReward || now >= nextReward;

    if (canClaim) {
      console.log('🎁 Daily reward claimable for:', user.displayName);
      
      // Reset to daily chip amount (1000)
      const DAILY_CHIPS = 1000n;
      
      // Calculate new streak (increment if within grace period, reset otherwise)
      const newStreak = nextReward && now <= new Date(nextReward.getTime() + (48 * 60 * 60 * 1000))
        ? user.currentStreak + 1
        : 1;
      
      // Set next reward time (24 hours from now)
      const nextStreakReward = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          chipBalance: DAILY_CHIPS,
          lastLogin: now,
          updatedAt: now,
          currentStreak: newStreak,
          bestStreak: Math.max(user.bestStreak, newStreak),
          nextStreakReward,
        },
      });

      // Create transaction record for daily bonus
      try {
        await prisma.transaction.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            amount: Number(DAILY_CHIPS),
            type: 'DAILY_STREAK',
            balanceBefore: user.chipBalance,
            balanceAfter: DAILY_CHIPS,
            description: `Daily chip reset - Day ${newStreak}`,
          },
        });
      } catch (txError) {
        console.error('⚠️ Transaction record failed (non-critical):', txError.message);
      }

      return updated;
    }

    // Just update last login
    return await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: now, updatedAt: now },
    });
  } catch (error) {
    console.error('❌ Daily reset check failed:', error);
    console.error('Error details:', error.message);
    return null;
  }
}

// Get or create user
async function getOrCreateUser(googleProfile) {
  try {
    console.log('📊 Looking up user:', googleProfile.displayName, 'ID:', googleProfile.id);
    
    let user = await prisma.user.findUnique({
      where: { googleId: googleProfile.id },
    });

    if (!user) {
      console.log('👤 Creating new user:', googleProfile.displayName);
      
      const newUserId = crypto.randomUUID();
      
      user = await prisma.user.create({
        data: {
          id: newUserId,
          googleId: googleProfile.id,
          email: googleProfile.emails?.[0]?.value || null,
          displayName: googleProfile.displayName,
          avatarUrl: googleProfile.photos?.[0]?.value || null,
          chipBalance: 1000n,
          lastLogin: new Date(),
          updatedAt: new Date(),
          currentStreak: 1,
        },
      });

      console.log('✅ User created with ID:', user.id);

      // Welcome transaction
      try {
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
        console.log('✅ Welcome transaction created');
      } catch (txError) {
        console.error('⚠️ Warning: Failed to create welcome transaction:', txError.message);
        // Don't fail user creation if transaction fails
      }
    } else {
      console.log('✅ Existing user found:', user.displayName, 'Balance:', Number(user.chipBalance));
      
      // Check daily reset
      try {
        const resetUser = await checkDailyReset(googleProfile.id);
        if (resetUser) {
          user = resetUser;
          console.log('✅ Daily reset checked, new balance:', Number(user.chipBalance));
        }
      } catch (resetError) {
        console.error('⚠️ Warning: Daily reset check failed:', resetError.message);
        // Continue with existing user data if reset fails
      }
    }

    return user;
  } catch (error) {
    console.error('❌ User creation/retrieval failed:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Update user chips (with transaction record)
async function updateUserChips(userId, amount, type, description, gameSessionId = null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      const newBalance = BigInt(user.chipBalance) + BigInt(amount);
      
      if (newBalance < 0n) {
        throw new Error('Insufficient chips');
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { chipBalance: newBalance },
      });

      await tx.transaction.create({
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
    });
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
