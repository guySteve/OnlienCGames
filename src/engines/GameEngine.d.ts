/**
 * Abstract Game Engine Base Class
 *
 * All game implementations (War, Blackjack) extend this to ensure
 * consistent state management and hook into engagement mechanics
 */
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
export declare enum GameState {
    WAITING = "WAITING",
    PLACING_BETS = "PLACING_BETS",
    DEALING = "DEALING",
    PLAYER_TURN = "PLAYER_TURN",
    DEALER_TURN = "DEALER_TURN",
    RESOLVING = "RESOLVING",
    COMPLETE = "COMPLETE"
}
export interface Player {
    userId: string;
    seatIndex: number;
    chips: number;
    currentBet: number;
    connected: boolean;
}
export interface GameConfig {
    roomId: string;
    minBet: number;
    maxBet: number;
    maxPlayers: number;
}
/**
 * Base class for all casino games
 */
export declare abstract class GameEngine {
    protected config: GameConfig;
    protected prisma: PrismaClient;
    protected redis: Redis;
    protected engagement: EngagementService;
    protected state: GameState;
    protected players: Map<string, Player>;
    protected pot: number;
    protected handNumber: number;
    constructor(config: GameConfig, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    abstract getGameType(): 'WAR' | 'BLACKJACK';
    abstract startNewHand(): Promise<void>;
    abstract placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean>;
    abstract resolveHand(): Promise<void>;
    abstract getGameState(): any;
    /**
     * Add player to game
     */
    addPlayer(userId: string, seatIndex: number): Promise<boolean>;
    /**
     * Remove player from game
     */
    removePlayer(userId: string, seatIndex: number): void;
    /**
     * Validate bet amount
     */
    protected validateBet(amount: number): boolean;
    /**
     * Deduct chips from player (in-game state)
     * Persists to database at end of hand
     */
    protected deductChips(userId: string, seatIndex: number, amount: number): Promise<boolean>;
    /**
     * Award chips to player
     */
    protected awardChips(userId: string, seatIndex: number, amount: number): void;
    /**
     * Persist chip changes to database
     * Called at end of each hand
     */
    protected persistChipChanges(sessionId: string): Promise<void>;
    /**
     * Save game state to Redis (hot storage)
     */
    protected saveStateToRedis(): Promise<void>;
    /**
     * Restore game state from Redis (for crash recovery)
     */
    protected restoreStateFromRedis(): Promise<boolean>;
    /**
     * Get current pot size
     */
    getPot(): number;
    /**
     * Get all players
     */
    getPlayers(): Player[];
    /**
     * Mark player as disconnected
     */
    setPlayerDisconnected(userId: string, seatIndex: number): void;
}
//# sourceMappingURL=GameEngine.d.ts.map