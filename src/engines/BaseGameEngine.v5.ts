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

import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
import { getSyndicateService, SyndicateService } from '../services/SyndicateService';
import { getLockManager, LOCK_PRESETS, LockResult } from '../services/LockManager';

/**
 * Game state machine (immutable across all games)
 */
export enum GameState {
  WAITING = 'WAITING',
  PLACING_BETS = 'PLACING_BETS',
  DEALING = 'DEALING',
  PLAYING = 'PLAYING',
  PLAYER_TURN = 'PLAYER_TURN',
  DEALER_TURN = 'DEALER_TURN',
  RESOLVING = 'RESOLVING',
  COMPLETE = 'COMPLETE'
}

/**
 * Player data structure (strongly typed)
 */
export interface Player {
  userId: string;
  seatIndex: number;
  chips: number;        // In-game chip count (cached from DB)
  currentBet: number;   // Active bet for current hand
  connected: boolean;   // WebSocket connection status
  lastAction?: Date;    // For timeout detection
}

/**
 * Game configuration (immutable per table)
 */
export interface GameConfig {
  tableId: string;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
  autoStartDelay?: number; // Milliseconds before auto-start
}

/**
 * Redis state keys (namespaced per table)
 */
interface StateKeys {
  gameState: string;       // Current game state (WAITING, PLAYING, etc.)
  players: string;         // Map of players (userId:seatIndex → Player)
  pot: string;            // Total chips in pot
  handNumber: string;     // Current hand number (for audit trail)
  customState: string;    // Game-specific state (shoe, deck, etc.)
}

/**
 * Abstract Base Class for all casino games
 *
 * ALL games (War, Blackjack, Bingo) MUST extend this class
 */
export abstract class BaseGameEngine {
  // Immutable configuration
  protected readonly config: GameConfig;
  protected readonly prisma: PrismaClient;
  protected readonly redis: Redis;
  protected readonly engagement: EngagementService;

  // Redis key namespace for this table
  private readonly stateKeys: StateKeys;

  // In-memory cache (READ-ONLY, synced from Redis)
  // NEVER write to these directly - use Redis methods
  protected cachedState: GameState = GameState.WAITING;
  protected cachedPlayers: Map<string, Player> = new Map();
  protected cachedPot: number = 0;

  /**
   * Constructor
   *
   * NOTE: After construction, call `await this.initialize()` to load Redis state
   */
  constructor(
    config: GameConfig,
    prisma: PrismaClient,
    redis: Redis,
    engagement: EngagementService
  ) {
    this.config = config;
    this.prisma = prisma;
    this.redis = redis;
    this.engagement = engagement;

    // Generate Redis key namespace
    this.stateKeys = {
      gameState: `table:${config.tableId}:state`,
      players: `table:${config.tableId}:players`,
      pot: `table:${config.tableId}:pot`,
      handNumber: `table:${config.tableId}:handNumber`,
      customState: `table:${config.tableId}:customState`
    };
  }

  // ==========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ==========================================================================

  /**
   * Game type identifier (for polymorphism)
   */
  abstract getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO' | 'LET_IT_RIDE';

  /**
   * Start new hand/round
   */
  abstract startHand(): Promise<void>;

  /**
   * Resolve hand and calculate payouts
   */
  abstract resolveHand(): Promise<void>;

  // ==========================================================================
  // REDIS-FIRST STATE MANAGEMENT
  // ==========================================================================

  /**
   * Initialize game state from Redis (call after construction)
   *
   * WHY SEPARATE FROM CONSTRUCTOR?
   * - Constructors can't be async
   * - Allows graceful handling of Redis connection failures
   */
  async initialize(): Promise<void> {
    try {
      // Load state from Redis or initialize defaults
      const state = await this.redis.get(this.stateKeys.gameState);
      this.cachedState = (state as GameState) || GameState.WAITING;

      const playersJson = await this.redis.get(this.stateKeys.players);
      this.cachedPlayers = playersJson
        ? new Map(JSON.parse(playersJson))
        : new Map();

      const pot = await this.redis.get(this.stateKeys.pot);
      this.cachedPot = pot ? parseInt(pot) : 0;

      console.log(`✅ Game engine initialized for table ${this.config.tableId}`);
    } catch (error) {
      console.error(`❌ Failed to initialize game engine for table ${this.config.tableId}:`, error);
      throw error;
    }
  }

  /**
   * Get current game state (from cache, synced from Redis)
   *
   * SAFE: Read-only access to cached state
   */
  getState(): GameState {
    return this.cachedState;
  }

  /**
   * Set game state (updates both Redis and cache)
   *
   * CRITICAL: ALWAYS use this instead of `this.state =`
   *
   * @param newState - New game state
   * @param ttl - Optional expiration (seconds). Use for temporary states.
   */
  protected async setState(newState: GameState, ttl?: number): Promise<void> {
    try {
      // Update Redis (source of truth)
      if (ttl) {
        await this.redis.setex(this.stateKeys.gameState, ttl, newState);
      } else {
        await this.redis.set(this.stateKeys.gameState, newState);
      }

      // Update cache
      this.cachedState = newState;

      console.log(`🎮 State transition: ${newState} (table ${this.config.tableId})`);
    } catch (error) {
      console.error(`❌ Failed to set state for table ${this.config.tableId}:`, error);
      throw error;
    }
  }

  /**
   * Get current pot size
   */
  getPot(): number {
    return this.cachedPot;
  }

  /**
   * Add to pot (updates Redis + cache)
   */
  protected async addToPot(amount: number): Promise<void> {
    const newPot = this.cachedPot + amount;
    await this.redis.set(this.stateKeys.pot, newPot.toString());
    this.cachedPot = newPot;
  }

  /**
   * Reset pot to zero
   */
  protected async resetPot(): Promise<void> {
    await this.redis.set(this.stateKeys.pot, '0');
    this.cachedPot = 0;
  }

  /**
   * Get all players (cached)
   */
  getPlayers(): Map<string, Player> {
    return new Map(this.cachedPlayers); // Return copy to prevent mutation
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.cachedPlayers.size;
  }

  // ==========================================================================
  // PLAYER MANAGEMENT (Redis-backed)
  // ==========================================================================

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
  async addPlayer(userId: string, seatIndex: number): Promise<boolean> {
    const lockManager = getLockManager();

    const result = await lockManager.withLock(
      `table:${this.config.tableId}`,
      async () => {
        // 1. FETCH latest state from Redis
        const playersJson = await this.redis.get(this.stateKeys.players);
        const players: Map<string, Player> = playersJson
          ? new Map(JSON.parse(playersJson))
          : new Map();

        // 2. VALIDATE capacity
        if (players.size >= this.config.maxPlayers) {
          throw new Error('Table full');
        }

        // 3. FETCH user balance from Postgres
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { chipBalance: true }
        });

        if (!user || user.chipBalance < BigInt(this.config.minBet)) {
          throw new Error('Insufficient balance');
        }

        // 4. ADD player
        const playerKey = `${userId}:${seatIndex}`;
        players.set(playerKey, {
          userId,
          seatIndex,
          chips: Number(user.chipBalance),
          currentBet: 0,
          connected: true,
          lastAction: new Date()
        });

        // 5. SAVE to Redis
        await this.redis.set(this.stateKeys.players, JSON.stringify(Array.from(players.entries())));

        // 6. UPDATE cache
        this.cachedPlayers = players;

        return true;
      },
      LOCK_PRESETS.FAST
    );

    return result.success && result.data === true;
  }

  /**
   * Remove player from game (with lock)
   *
   * @param userId - User ID
   * @param seatIndex - Seat position
   */
  async removePlayer(userId: string, seatIndex: number): Promise<void> {
    const lockManager = getLockManager();

    await lockManager.withLock(
      `table:${this.config.tableId}`,
      async () => {
        const playerKey = `${userId}:${seatIndex}`;

        // 1. FETCH from Redis
        const playersJson = await this.redis.get(this.stateKeys.players);
        const players: Map<string, Player> = playersJson
          ? new Map(JSON.parse(playersJson))
          : new Map();

        // 2. REMOVE player
        players.delete(playerKey);

        // 3. SAVE to Redis
        await this.redis.set(this.stateKeys.players, JSON.stringify(Array.from(players.entries())));

        // 4. UPDATE cache
        this.cachedPlayers = players;
      },
      LOCK_PRESETS.FAST
    );
  }

  // ==========================================================================
  // CHIP OPERATIONS (Atomic with Prisma Transactions)
  // ==========================================================================

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
  async deductChips(userId: string, seatIndex: number, amount: number): Promise<boolean> {
    const lockManager = getLockManager();
    const playerKey = `${userId}:${seatIndex}`;

    const result = await lockManager.withLock(
      `user:${userId}:balance`,
      async () => {
        // Use Prisma Interactive Transaction (all-or-nothing)
        const success = await this.prisma.$transaction(async (tx) => {
          // 1. FETCH latest user balance (with row-level lock)
          const user = await tx.user.findUnique({
            where: { id: userId }
          });

          if (!user || user.chipBalance < BigInt(amount)) {
            return false; // Insufficient funds
          }

          // 2. DEDUCT from database
          await tx.user.update({
            where: { id: userId },
            data: { chipBalance: { decrement: BigInt(amount) } }
          });

          // 3. FETCH game state from Redis
          const playersJson = await this.redis.get(this.stateKeys.players);
          const players: Map<string, Player> = playersJson
            ? new Map(JSON.parse(playersJson))
            : new Map();

          const player = players.get(playerKey);
          if (!player) return false;

          // 4. UPDATE in-game chips
          player.chips -= amount;
          player.currentBet += amount;

          // 5. SAVE to Redis
          await this.redis.set(this.stateKeys.players, JSON.stringify(Array.from(players.entries())));

          // 6. UPDATE pot
          await this.addToPot(amount);

          // 7. RECORD transaction for audit
          await tx.transaction.create({
            data: {
              userId,
              amount: -amount,
              type: 'BET',
              balanceBefore: user.chipBalance,
              balanceAfter: user.chipBalance - BigInt(amount),
              metadata: {
                tableId: this.config.tableId,
                seatIndex,
                handNumber: await this.getHandNumber()
              }
            }
          });

          return true;
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000
        });

        return success;
      },
      LOCK_PRESETS.CRITICAL // Extended timeout for money operations
    );

    return result.success && result.data === true;
  }

  /**
   * Award chips to player (with transaction)
   *
   * @param userId - User ID
   * @param seatIndex - Seat position
   * @param amount - Chip amount to award
   */
  async awardChips(userId: string, seatIndex: number, amount: number): Promise<void> {
    const lockManager = getLockManager();
    const playerKey = `${userId}:${seatIndex}`;

    await lockManager.withLock(
      `user:${userId}:balance`,
      async () => {
        await this.prisma.$transaction(async (tx) => {
          // --- Syndicate Tax Logic ---
          // 1. FETCH user balance
          const user = await tx.user.findUnique({
            where: { id: userId }
          });

          if (!user) return;

          let finalAmount = amount;
          let taxAmount = 0;
          const BIG_WIN_THRESHOLD = 1000;
          const MIN_TAX_AMOUNT = 10;
          const TAX_RATE = 0.01;

          if (amount >= BIG_WIN_THRESHOLD) {
            const userForTax = await tx.user.findUnique({
              where: { id: userId },
              select: { syndicateMembership: { select: { syndicateId: true } } }
            });

            if (userForTax?.syndicateMembership) {
              taxAmount = Math.max(MIN_TAX_AMOUNT, Math.floor(amount * TAX_RATE));
              finalAmount = amount - taxAmount;

              const syndicateService = getSyndicateService();
              await syndicateService.contributeToTreasury(
                tx,
                userForTax.syndicateMembership.syndicateId,
                userId,
                taxAmount,
                {
                  gameType: this.getGameType(),
                  originalWin: amount,
                  gameSessionId: this.config.tableId
                }
              );

              // Create a separate transaction log for the tax
              await tx.transaction.create({
                data: {
                  userId,
                  amount: -taxAmount,
                  balanceBefore: user.chipBalance,
                  balanceAfter: user.chipBalance - BigInt(taxAmount),
                  type: 'TIP',
                  description: `Syndicate Treasury Tax (${(TAX_RATE * 100).toFixed(1)}%)`,
                  metadata: {
                    syndicateId: userForTax.syndicateMembership.syndicateId,
                    originalWin: amount
                  }
                }
              });
            }
          }
          // --- End Syndicate Tax Logic ---

          // 2. ADD to database
          await tx.user.update({
            where: { id: userId },
            data: { chipBalance: { increment: BigInt(finalAmount) } }
          });

          // 3. FETCH game state
          const playersJson = await this.redis.get(this.stateKeys.players);
          const players: Map<string, Player> = playersJson
            ? new Map(JSON.parse(playersJson))
            : new Map();

          const player = players.get(playerKey);
          if (player) {
            player.chips += finalAmount;

            // 4. SAVE to Redis
            await this.redis.set(this.stateKeys.players, JSON.stringify(Array.from(players.entries())));
          }

          // 5. RECORD transaction for the win
          await tx.transaction.create({
            data: {
              userId,
              amount: finalAmount,
              balanceBefore: user.chipBalance,
              balanceAfter: user.chipBalance + BigInt(finalAmount),
              type: 'WIN',
              metadata: {
                tableId: this.config.tableId,
                seatIndex,
                handNumber: await this.getHandNumber(),
                taxDeducted: taxAmount
              }
            }
          });
        });
      },
      LOCK_PRESETS.CRITICAL
    );
  }

  /**
   * Get current hand number (for audit trail)
   */
  protected async getHandNumber(): Promise<number> {
    const handNumber = await this.redis.get(this.stateKeys.handNumber);
    return handNumber ? parseInt(handNumber) : 0;
  }

  /**
   * Increment hand number
   */
  protected async incrementHandNumber(): Promise<number> {
    const newHandNumber = await this.redis.incr(this.stateKeys.handNumber);
    return newHandNumber;
  }

  // ==========================================================================
  // CUSTOM STATE MANAGEMENT (Game-specific data)
  // ==========================================================================

  /**
   * Save custom game state (e.g., shoe, deck, dealer hand)
   *
   * USE CASE: Blackjack saves shoe position, dealer cards
   *
   * @param state - Serializable state object
   */
  protected async saveCustomState<T>(state: T): Promise<void> {
    await this.redis.set(this.stateKeys.customState, JSON.stringify(state));
  }

  /**
   * Load custom game state
   *
   * @returns Parsed state object or null
   */
  protected async loadCustomState<T>(): Promise<T | null> {
    const stateJson = await this.redis.get(this.stateKeys.customState);
    return stateJson ? JSON.parse(stateJson) : null;
  }

  /**
   * Clear all game state (for cleanup)
   */
  async clearState(): Promise<void> {
    await this.redis.del(
      this.stateKeys.gameState,
      this.stateKeys.players,
      this.stateKeys.pot,
      this.stateKeys.handNumber,
      this.stateKeys.customState
    );
  }
}
