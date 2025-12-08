/**
 * LetItRideEngine.ts - Let It Ride Poker Game Engine
 *
 * Rules:
 * - Players make three equal bets
 * - Receive 3 cards, 2 community cards dealt face down
 * - Can pull back first two bets, final bet ($) must stay
 * - Minimum winning hand: Pair of 10s or better
 * - Payouts based on poker hand rankings
 *
 * ARCHITECTURE: Redis-First (v5)
 * - All game state stored in Redis for persistence
 * - Survives server restarts and enables horizontal scaling
 * - Uses BaseGameEngine.v5 pattern with saveCustomState()
 */
import { BaseGameEngine, GameConfig } from './BaseGameEngine.v5';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
export declare class LetItRideEngine extends BaseGameEngine {
    private readonly PAYOUT_TABLE;
    events: EventEmitter;
    constructor(config: GameConfig, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    /**
     * Initialize game state (override BaseGameEngine)
     * Called after construction to load state from Redis
     */
    initialize(): Promise<void>;
    getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO' | 'LET_IT_RIDE';
    /**
     * Create a fresh deck (pure function - no state modification)
     */
    private createFreshDeck;
    /**
     * Shuffle deck (pure function - returns shuffled copy)
     */
    private shuffleDeck;
    /**
     * Deal card from deck (modifies deck in-place, returns card)
     */
    private dealCard;
    placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean>;
    startNewHand(): Promise<void>;
    playerDecision(userId: string, seatIndex: number, decision: 'PULL_BACK' | 'LET_IT_RIDE', betNumber: 1 | 2): Promise<boolean>;
    resolveHand(): Promise<void>;
    private evaluateHand;
    private calculatePayout;
    private completeHand;
    getGameState(): Promise<any>;
    /**
     * Implement required method from BaseGameEngine
     */
    startHand(): Promise<void>;
}
//# sourceMappingURL=LetItRideEngine.d.ts.map