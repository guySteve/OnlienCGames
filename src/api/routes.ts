/**
 * VegasCore API Routes
 * 
 * RESTful endpoints for engagement mechanics and user management
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import { FriendService } from '../services/FriendService';
import { ChatService } from '../services/ChatService';

export function createApiRouter(prisma: PrismaClient, engagement: EngagementService, friendService: FriendService, chatService: ChatService): Router {
  const router = Router();

  // ==========================================================================
  // AUTHENTICATION MIDDLEWARE
  // ==========================================================================

  const requireAuth = (req: Request, res: Response, next: any): void => {
    if (!req.user || !req.user.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    next();
  };

  // ==========================================================================
  // USER PROFILE
  // ==========================================================================

  /**
   * GET /api/profile
   * Get complete user profile with retention metrics
   */
  router.get('/profile', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          UserAchievement: {
            where: { completed: true },
            include: { Achievement: true }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get streak status
      const streakStatus = await engagement.getStreakStatus(userId);

      // Get active multiplier
      // const multiplier = await engagement.getActiveMultiplier();
      const multiplier = 1;

      // Calculate next level progress
      const xpRequired = user.xpLevel ** 2 * 100;
      const xpProgress = (user.xpPoints / xpRequired) * 100;

      return res.json({
        user: {
          id: user.id,
          displayName: user.displayName,
          nickname: user.nickname,
          avatar: user.customAvatar || user.avatarUrl,
          chipBalance: Number(user.chipBalance),
          xpLevel: user.xpLevel,
          xpPoints: user.xpPoints,
          xpProgress: Math.floor(xpProgress),
          xpRequired,
          vipStatus: user.vipStatus,
          totalHandsPlayed: user.totalHandsPlayed,
          biggestWin: Number(user.biggestWin)
        },
        streak: {
          current: streakStatus.currentStreak,
          best: user.bestStreak,
          nextReward: streakStatus.nextReward,
          canClaimAt: streakStatus.canClaimAt,
          hoursUntilReset: Math.floor(streakStatus.hoursUntilReset)
        },
        mysteryDrops: {
          count: user.mysteryDropCount,
          totalChips: Number(user.totalMysteryChips),
          lastDrop: user.lastMysteryDrop
        },
        activeMultiplier: multiplier,
        achievements: user.UserAchievement.map(a => ({
          key: a.Achievement.key,
          name: a.Achievement.name,
          description: a.Achievement.description,
          completedAt: a.createdAt
        }))
      });
    } catch (error) {
      console.error('Profile error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/profile/update
   * Update nickname and avatar
   */
  router.post('/profile/update', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { nickname, customAvatar } = req.body;

      if (nickname && (typeof nickname !== 'string' || nickname.length > 30)) {
        return res.status(400).json({ error: 'Invalid nickname' });
      }

      if (customAvatar && (typeof customAvatar !== 'string' || customAvatar.length > 500)) {
        return res.status(400).json({ error: 'Invalid avatar URL' });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          nickname: nickname || undefined,
          customAvatar: customAvatar || undefined
        }
      });

      return res.json({
        success: true,
        nickname: updated.nickname,
        customAvatar: updated.customAvatar
      });
    } catch (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================================================
  // DAILY STREAK SYSTEM
  // ==========================================================================

  /**
   * POST /api/claim-daily-reward
   * Claim daily login streak reward
   */
  router.post('/claim-daily-reward', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const result = await engagement.claimDailyReward(userId);

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          nextClaimAt: result.nextClaimAt
        });
      }

      return res.json({
        success: true,
        reward: result.reward,
        nextClaimAt: result.nextClaimAt,
        message: `Day ${result.reward!.day} claimed! +${result.reward!.chips} chips, +${result.reward!.xp} XP`
      });
    } catch (error) {
      console.error('Daily reward error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/streak-status
   * Get streak information without claiming
   */
  router.get('/streak-status', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const status = await engagement.getStreakStatus(userId);

      return res.json({
        currentStreak: status.currentStreak,
        nextReward: status.nextReward,
        canClaimAt: status.canClaimAt,
        hoursUntilReset: Math.floor(status.hoursUntilReset),
        urgency: status.hoursUntilReset < 6 ? 'HIGH' : status.hoursUntilReset < 24 ? 'MEDIUM' : 'LOW'
      });
    } catch (error) {
      console.error('Streak status error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================================================
  // FRIEND SYSTEM
  // ==========================================================================

  router.post('/friends/request', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { friendId } = req.body;
      await friendService.sendFriendRequest(userId, friendId);
      res.json({ success: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  router.post('/friends/accept', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { friendId } = req.body;
      await friendService.acceptFriendRequest(userId, friendId);
      res.json({ success: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  router.post('/friends/reject', requireAuth, async (req: Request, res:Response) => {
    try {
      const userId = req.user!.id;
      const { friendId } = req.body;
      await friendService.rejectFriendRequest(userId, friendId);
      res.json({ success: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  router.delete('/friends/:friendId', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { friendId } = req.params;
      await friendService.removeFriend(userId, friendId);
      res.json({ success: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  router.get('/friends', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const friends = await friendService.getFriends(userId);
      res.json(friends);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  router.get('/friends/pending', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const pendingRequests = await friendService.getPendingFriendRequests(userId);
      res.json(pendingRequests);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  // ==========================================================================
  // CHAT SYSTEM
  // ==========================================================================

  router.post('/chat/send', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { toUserId, message } = req.body;
      await chatService.sendMessage(userId, toUserId, message);
      res.json({ success: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  router.get('/chat/:friendId', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { friendId } = req.params;
      const messages = await chatService.getMessages(userId, friendId);
      res.json(messages);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: String(error) });
      }
    }
  });

  // ==========================================================================
  // LEADERBOARDS
  // ==========================================================================

  /**
   * GET /api/leaderboard/:type
   * Get leaderboard (chips, level, streak, wins)
   */
  router.get('/leaderboard/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);

      let orderBy: any = { chipBalance: 'desc' };

      switch (type) {
        case 'chips':
          orderBy = { chipBalance: 'desc' };
          break;
        case 'level':
          orderBy = { xpLevel: 'desc' };
          break;
        case 'streak':
          orderBy = { currentStreak: 'desc' };
          break;
        case 'wins':
          orderBy = { biggestWin: 'desc' };
          break;
        default:
          return res.status(400).json({ error: 'Invalid leaderboard type' });
      }

      const users = await prisma.user.findMany({
        take: limit,
        orderBy,
        select: {
          id: true,
          displayName: true,
          nickname: true,
          avatarUrl: true,
          customAvatar: true,
          chipBalance: true,
          xpLevel: true,
          currentStreak: true,
          biggestWin: true,
          vipStatus: true
        }
      });

      return res.json({
        leaderboard: users.map((u, index) => ({
          rank: index + 1,
          userId: u.id,
          name: u.nickname || u.displayName,
          avatar: u.customAvatar || u.avatarUrl,
          value: type === 'chips' ? Number(u.chipBalance) :
                 type === 'level' ? u.xpLevel :
                 type === 'streak' ? u.currentStreak :
                 Number(u.biggestWin),
          vipStatus: u.vipStatus
        }))
      });
    } catch (error) {
      console.error('Leaderboard error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================================================
  // TRANSACTION HISTORY
  // ==========================================================================

  /**
   * GET /api/transactions
   * Get user's transaction history
   */
  router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          createdAt: true,
          amount: true,
          type: true,
          description: true,
          balanceBefore: true,
          balanceAfter: true,
          metadata: true
        }
      });

      const total = await prisma.transaction.count({ where: { userId } });

      return res.json({
        transactions: transactions.map(t => ({
          id: t.id,
          date: t.createdAt,
          amount: t.amount,
          type: t.type,
          description: t.description,
          balanceBefore: Number(t.balanceBefore),
          balanceAfter: Number(t.balanceAfter),
          metadata: t.metadata
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      });
    } catch (error) {
      console.error('Transactions error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================================================
  // GLOBAL TICKER (Recent Big Events)
  // ==========================================================================

  /**
   * GET /api/global-ticker
   * Get recent global events (big wins, mystery drops, etc.)
   */
  router.get('/global-ticker', async (_req: Request, res: Response) => {
    try {
      const redis = engagement['redis']; // Access private redis instance
      const events = await redis.lrange('global:ticker', 0, 49);

      return res.json({
        events: events.map((e: string) => JSON.parse(e))
      });
    } catch (error) {
      console.error('Global ticker error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================================================
  // ADMIN ROUTES (Protected)
  // ==========================================================================

  const requireAdmin = (req: Request, res: Response, next: any): void => {
    // TODO: Implement proper admin role check
    if (!req.user || !req.user.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };



  /**
   * POST /api/admin/adjust-chips
   * Admin chip adjustment (with audit trail)
   */
  router.post('/admin/adjust-chips', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, amount, reason } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: {
            chipBalance: { increment: amount }
          }
        });

        await tx.transaction.create({
          data: {
            userId,
            amount,
            type: amount > 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
            balanceBefore: user.chipBalance,
            balanceAfter: u.chipBalance,
            description: reason || 'Admin adjustment',
            metadata: { adminId: req.user!.id }
          }
        });

        return u;
      });

      return res.json({
        success: true,
        newBalance: Number(updated.chipBalance)
      });
    } catch (error) {
      console.error('Admin chip adjustment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
