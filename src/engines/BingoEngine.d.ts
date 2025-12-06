/**
 * Bingo Game Engine - Casino Standards
 *
 * Features:
 * - Provably fair Fisher-Yates ball shuffle
 * - Automatic ball calling with socket events
 * - Multiple card purchases
 * - Real-time event emissions
 * - Cryptographically secure RNG
 */
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import { EventEmitter } from 'events';
type Redis = any;
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
    events: EventEmitter;
    constructor(config: any, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    getGameType(): 'BINGO';
    /**
     * Initialize and shuffle the 75 bingo balls using Fisher-Yates
     */
    private initializeBalls;
    /**
     * Cryptographically secure Fisher-Yates shuffle for ball draw order
     */
    private shuffleBalls;
    /**
     * Generate cryptographically secure server seed for provably fair RNG
     */
    private generateServerSeed;
    /**
     * Quantum-inspired RNG using server seed for card generation
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
     * Draw the next ball from the pre-shuffled array
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
    getPlayerCards(userId: string): BingoCard[];
    setBallCallCallback(callback: (ball: number) => void): void;
    setGameEndCallback(callback: (winner: any) => void): void;
    destroy(): void;
    addPlayer(userId: string): Promise<boolean>;
    forceStart(): Promise<void>;
}
export {};
//# sourceMappingURL=BingoEngine.d.ts.map