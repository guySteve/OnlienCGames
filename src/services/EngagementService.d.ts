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
import { PrismaClient } from '@prisma/client';
type Redis = any;
export declare class EngagementService {
    private prisma;
    private redis;
    constructor(prisma: PrismaClient, redis: Redis);
    /**
     * Calculate daily streak reward based on consecutive login days
     * Uses exponential scaling to create "must login" compulsion
     */
    private calculateStreakReward;
    /**
     * Claim daily login reward
     *
     * Business Logic:
     * - Must wait 24h between claims
     * - 24h grace period before streak resets (create urgency)
     * - Show countdown timer on frontend
     */
    claimDailyReward(userId: string): Promise<{
        success: boolean;
        reward?: {
            chips: number;
            xp: number;
            day: number;
            bonus?: string;
        };
        nextClaimAt?: Date;
        error?: string;
    }>;
    /**
     * Get streak status without claiming
     */
    getStreakStatus(userId: string): Promise<{
        currentStreak: number;
        nextReward: {
            chips: number;
            xp: number;
            bonus?: string;
        };
        canClaimAt: Date | null;
        hoursUntilReset: number;
    }>;
    /**
     * Roll for mystery drop after each hand
     * 0.5% base chance (1 in 200 hands)
     *
     * Psychological principle: Unpredictable rewards create strongest addiction
     */
    rollMysteryDrop(userId: string): Promise<{
        triggered: boolean;
        amount?: number;
    }>;
    /**
     * Broadcast big events to all connected users
     * Creates FOMO and social envy
     */
    emitGlobalEvent(event: {
        type: 'BIG_WIN' | 'MYSTERY_DROP' | 'STREAK_MILESTONE' | 'LEVEL_UP' | 'ADMIN_BROADCAST';
        userId: string;
        data: any;
    }): Promise<void>;
    /**
     * Record big win for global ticker
     */
    recordBigWin(userId: string, amount: number, gameType: string): Promise<void>;
    /**
     * Award XP and check for level up
     * Level formula: XP required = level^2 * 100
     */
    awardXP(userId: string, baseXP: number): Promise<{
        xpAwarded: number;
        leveledUp: boolean;
        newLevel?: number;
    }>;
    /**
     * Detect if loss was a "near miss" (amplifies loss aversion)
     * Example: Lost by 1 point in War, busted on 22 in Blackjack
     */
    detectNearMiss(gameType: string, playerValue: number, dealerValue: number): boolean;
}
/**
 * Singleton instance
 */
export declare let engagementService: EngagementService;
export declare function initEngagementService(prisma: PrismaClient, redis: Redis): void;
export {};
//# sourceMappingURL=EngagementService.d.ts.map