/**
 * Bingo Game Engine
 *
 * Implements multiplayer Bingo following the GameEngine architecture.
 * Features automatic ball calling, multiple card purchases, and provably fair RNG.
 */
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
interface BingoCard {
    id: string;
    userId: string;
    grid: number[][];
    marked: boolean[][];
}
export declare class BingoEngine extends GameEngine {
    private bingoState;
    private bingoPlayers;
    private availableBalls;
    private ballDrawTimer;
    private serverSeed;
    private ballCallCallback?;
    private gameEndCallback?;
    constructor(config: any, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    getGameType(): 'BINGO';
    /**
     * Initialize the 75 bingo balls
     */
    private initializeBalls;
    /**
     * Generate cryptographically secure server seed for provably fair RNG
     */
    private generateServerSeed;
    /**
     * Quantum-inspired RNG using server seed
     * Simulates the high-quality randomness used in other engines
     */
    private getNextRandomIndex;
    /**
     * Generate a random Bingo card with proper B-I-N-G-O distribution
     */
    private generateBingoCard;
    /**
     * Convert ball number to BINGO letter
     */
    private getBingoLetter;
    /**
     * Player purchases a Bingo card
     */
    placeBet(userId: string, amount: number): Promise<boolean>;
    /**
     * Start the game after buying phase
     */
    startNewHand(): Promise<void>;
    /**
     * Schedule the next ball draw
     */
    private scheduleNextBallDraw;
    /**
     * Draw a random ball
     */
    private drawBall;
    /**
     * Automatically mark the called number on all cards
     */
    private autoMarkCards;
    /**
     * Player claims BINGO
     */
    claimBingo(userId: string, cardId: string): Promise<{
        valid: boolean;
        pattern?: string;
    }>;
    /**
     * Check if a card has a winning pattern
     * Returns pattern name or null
     */
    private checkWin;
    /**
     * Reset game for next round
     */
    private resetForNextRound;
    /**
     * Resolve hand and persist to database
     */
    resolveHand(): Promise<void>;
    /**
     * Get current game state for clients
     */
    getGameState(): any;
    /**
     * Get a player's cards
     */
    getPlayerCards(userId: string): BingoCard[];
    /**
     * Set callback for ball announcements
     */
    setBallCallCallback(callback: (ball: number) => void): void;
    /**
     * Set callback for game end
     */
    setGameEndCallback(callback: (winner: any) => void): void;
    /**
     * Clean up timers
     */
    destroy(): void;
    /**
     * Override addPlayer for Bingo (no seats, just cards)
     */
    addPlayer(userId: string): Promise<boolean>;
    /**
     * Force start game (admin/debug)
     */
    forceStart(): Promise<void>;
}
export {};
//# sourceMappingURL=BingoEngine.d.ts.map