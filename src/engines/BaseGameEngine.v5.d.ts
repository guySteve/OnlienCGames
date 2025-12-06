/**
 * BaseGameEngine v5.0.0 - Redis-First Architecture
 *
 * CRITICAL CHANGE: State is NO LONGER stored in `this.state` (memory)
 * ALL state operations now go through Redis (source of truth)
 *
 * WHY REDIS-FIRST?
 * 1. Container crashes don't lose game state
 * 2. Horizontal scaling (N containers can serve same table)
 * 3. State persists across deployments
 * 4. Enables graceful failover and blue-green deployments
 *
 * MIGRATION FROM v4.0.0:
 * - OLD: `this.state = GameState.PLAYING` (WRONG - memory only)
 * - NEW: `await this.setState(GameState.PLAYING)` (CORRECT - Redis + memory)
 *
 * LOCKING STRATEGY:
 * - Use LockManager for ALL money operations
 * - Use table-level locks for state transitions
 * - Use user-level locks for balance changes
 *
 * @author VegasCore Architecture Team
 * @version 5.0.0
 */
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
/**
 * Game state machine (immutable across all games)
 */
export declare enum GameState {
    WAITING = "WAITING",
    PLACING_BETS = "PLACING_BETS",
    DEALING = "DEALING",
    PLAYING = "PLAYING",
    PLAYER_TURN = "PLAYER_TURN",
    DEALER_TURN = "DEALER_TURN",
    RESOLVING = "RESOLVING",
    COMPLETE = "COMPLETE"
}
/**
 * Player data structure (strongly typed)
 */
export interface Player {
    userId: string;
    seatIndex: number;
    chips: number;
    currentBet: number;
    connected: boolean;
    lastAction?: Date;
}
/**
 * Game configuration (immutable per table)
 */
export interface GameConfig {
    tableId: string;
    minBet: number;
    maxBet: number;
    maxPlayers: number;
    autoStartDelay?: number;
}
/**
 * Abstract Base Class for all casino games
 *
 * ALL games (War, Blackjack, Bingo) MUST extend this class
 */
export declare abstract class BaseGameEngine {
    protected readonly config: GameConfig;
    protected readonly prisma: PrismaClient;
    protected readonly redis: Redis;
    protected readonly engagement: EngagementService;
    private readonly stateKeys;
    protected cachedState: GameState;
    protected cachedPlayers: Map<string, Player>;
    protected cachedPot: number;
    /**
     * Constructor
     *
     * NOTE: After construction, call `await this.initialize()` to load Redis state
     */
    constructor(config: GameConfig, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    /**
     * Game type identifier (for polymorphism)
     */
    abstract getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO';
    /**
     * Start new hand/round
     */
    abstract startHand(): Promise<void>;
    /**
     * Resolve hand and calculate payouts
     */
    abstract resolveHand(): Promise<void>;
    /**
     * Initialize game state from Redis (call after construction)
     *
     * WHY SEPARATE FROM CONSTRUCTOR?
     * - Constructors can't be async
     * - Allows graceful handling of Redis connection failures
     */
    initialize(): Promise<void>;
    /**
     * Get current game state (from cache, synced from Redis)
     *
     * SAFE: Read-only access to cached state
     */
    getState(): GameState;
    /**
     * Set game state (updates both Redis and cache)
     *
     * CRITICAL: ALWAYS use this instead of `this.state =`
     *
     * @param newState - New game state
     * @param ttl - Optional expiration (seconds). Use for temporary states.
     */
    protected setState(newState: GameState, ttl?: number): Promise<void>;
    /**
     * Get current pot size
     */
    getPot(): number;
    /**
     * Add to pot (updates Redis + cache)
     */
    protected addToPot(amount: number): Promise<void>;
    /**
     * Reset pot to zero
     */
    protected resetPot(): Promise<void>;
    /**
     * Get all players (cached)
     */
    getPlayers(): Map<string, Player>;
    /**
     * Get player count
     */
    getPlayerCount(): number;
    /**
     * Add player to game (with distributed lock)
     *
     * LOCKING: Uses table-level lock to prevent race conditions
     * - Two players can't take the same seat
     * - Player count can't exceed maxPlayers
     *
     * @param userId - User ID (from Passport session)
     * @param seatIndex - Seat position (0 to maxPlayers-1)
     * @returns Success status
     */
    addPlayer(userId: string, seatIndex: number): Promise<boolean>;
    /**
     * Remove player from game (with lock)
     *
     * @param userId - User ID
     * @param seatIndex - Seat position
     */
    removePlayer(userId: string, seatIndex: number): Promise<void>;
    /**
     * Deduct chips from player (in-game state + database)
     *
     * CRITICAL MONEY OPERATION - Uses distributed lock + Prisma transaction
     *
     * WHY BOTH LOCKS AND TRANSACTIONS?
     * - Lock: Prevents concurrent modifications to game state
     * - Transaction: Ensures database consistency (ACID guarantees)
     *
     * @param userId - User ID
     * @param seatIndex - Seat position
     * @param amount - Chip amount to deduct
     * @returns Success status
     */
    deductChips(userId: string, seatIndex: number, amount: number): Promise<boolean>;
    /**
     * Award chips to player (with transaction)
     *
     * @param userId - User ID
     * @param seatIndex - Seat position
     * @param amount - Chip amount to award
     */
    awardChips(userId: string, seatIndex: number, amount: number): Promise<void>;
    /**
     * Get current hand number (for audit trail)
     */
    protected getHandNumber(): Promise<number>;
    /**
     * Increment hand number
     */
    protected incrementHandNumber(): Promise<number>;
    /**
     * Save custom game state (e.g., shoe, deck, dealer hand)
     *
     * USE CASE: Blackjack saves shoe position, dealer cards
     *
     * @param state - Serializable state object
     */
    protected saveCustomState<T>(state: T): Promise<void>;
    /**
     * Load custom game state
     *
     * @returns Parsed state object or null
     */
    protected loadCustomState<T>(): Promise<T | null>;
    /**
     * Clear all game state (for cleanup)
     */
    clearState(): Promise<void>;
}
//# sourceMappingURL=BaseGameEngine.v5.d.ts.map