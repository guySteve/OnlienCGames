"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGameEngine = exports.GameState = void 0;
const client_1 = require("@prisma/client");
const SyndicateService_1 = require("../services/SyndicateService");
const LockManager_1 = require("../services/LockManager");
/**
 * Game state machine (immutable across all games)
 */
var GameState;
(function (GameState) {
    GameState["WAITING"] = "WAITING";
    GameState["PLACING_BETS"] = "PLACING_BETS";
    GameState["DEALING"] = "DEALING";
    GameState["PLAYING"] = "PLAYING";
    GameState["PLAYER_TURN"] = "PLAYER_TURN";
    GameState["DEALER_TURN"] = "DEALER_TURN";
    GameState["RESOLVING"] = "RESOLVING";
    GameState["COMPLETE"] = "COMPLETE";
})(GameState || (exports.GameState = GameState = {}));
/**
 * Abstract Base Class for all casino games
 *
 * ALL games (War, Blackjack, Bingo) MUST extend this class
 */
class BaseGameEngine {
    // Immutable configuration
    config;
    prisma;
    redis;
    engagement;
    // Redis key namespace for this table
    stateKeys;
    // In-memory cache (READ-ONLY, synced from Redis)
    // NEVER write to these directly - use Redis methods
    cachedState = GameState.WAITING;
    cachedPlayers = new Map();
    cachedPot = 0;
    /**
     * Constructor
     *
     * NOTE: After construction, call `await this.initialize()` to load Redis state
     */
    constructor(config, prisma, redis, engagement) {
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
    // REDIS-FIRST STATE MANAGEMENT
    // ==========================================================================
    /**
     * Initialize game state from Redis (call after construction)
     *
     * WHY SEPARATE FROM CONSTRUCTOR?
     * - Constructors can't be async
     * - Allows graceful handling of Redis connection failures
     */
    async initialize() {
        try {
            // Load state from Redis or initialize defaults
            const state = await this.redis.get(this.stateKeys.gameState);
            this.cachedState = state || GameState.WAITING;
            const playersJson = await this.redis.get(this.stateKeys.players);
            this.cachedPlayers = playersJson
                ? new Map(JSON.parse(playersJson))
                : new Map();
            const pot = await this.redis.get(this.stateKeys.pot);
            this.cachedPot = pot ? parseInt(pot) : 0;
            console.log(`✅ Game engine initialized for table ${this.config.tableId}`);
        }
        catch (error) {
            console.error(`❌ Failed to initialize game engine for table ${this.config.tableId}:`, error);
            throw error;
        }
    }
    /**
     * Get current game state (from cache, synced from Redis)
     *
     * SAFE: Read-only access to cached state
     */
    getState() {
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
    async setState(newState, ttl) {
        try {
            // Update Redis (source of truth)
            if (ttl) {
                await this.redis.setex(this.stateKeys.gameState, ttl, newState);
            }
            else {
                await this.redis.set(this.stateKeys.gameState, newState);
            }
            // Update cache
            this.cachedState = newState;
            console.log(`🎮 State transition: ${newState} (table ${this.config.tableId})`);
        }
        catch (error) {
            console.error(`❌ Failed to set state for table ${this.config.tableId}:`, error);
            throw error;
        }
    }
    /**
     * Get current pot size
     */
    getPot() {
        return this.cachedPot;
    }
    /**
     * Add to pot (updates Redis + cache)
     */
    async addToPot(amount) {
        const newPot = this.cachedPot + amount;
        await this.redis.set(this.stateKeys.pot, newPot.toString());
        this.cachedPot = newPot;
    }
    /**
     * Reset pot to zero
     */
    async resetPot() {
        await this.redis.set(this.stateKeys.pot, '0');
        this.cachedPot = 0;
    }
    /**
     * Get all players (cached)
     */
    getPlayers() {
        return new Map(this.cachedPlayers); // Return copy to prevent mutation
    }
    /**
     * Get player count
     */
    getPlayerCount() {
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
    async addPlayer(userId, seatIndex) {
        const lockManager = (0, LockManager_1.getLockManager)();
        const result = await lockManager.withLock(`table:${this.config.tableId}`, async () => {
            // 1. FETCH latest state from Redis
            const playersJson = await this.redis.get(this.stateKeys.players);
            const players = playersJson
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
            await this.redis.set(this.stateKeys.players, JSON.stringify([...players]));
            // 6. UPDATE cache
            this.cachedPlayers = players;
            return true;
        }, LockManager_1.LOCK_PRESETS.FAST);
        return result.success && result.data === true;
    }
    /**
     * Remove player from game (with lock)
     *
     * @param userId - User ID
     * @param seatIndex - Seat position
     */
    async removePlayer(userId, seatIndex) {
        const lockManager = (0, LockManager_1.getLockManager)();
        await lockManager.withLock(`table:${this.config.tableId}`, async () => {
            const playerKey = `${userId}:${seatIndex}`;
            // 1. FETCH from Redis
            const playersJson = await this.redis.get(this.stateKeys.players);
            const players = playersJson
                ? new Map(JSON.parse(playersJson))
                : new Map();
            // 2. REMOVE player
            players.delete(playerKey);
            // 3. SAVE to Redis
            await this.redis.set(this.stateKeys.players, JSON.stringify([...players]));
            // 4. UPDATE cache
            this.cachedPlayers = players;
        }, LockManager_1.LOCK_PRESETS.FAST);
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
    async deductChips(userId, seatIndex, amount) {
        const lockManager = (0, LockManager_1.getLockManager)();
        const playerKey = `${userId}:${seatIndex}`;
        const result = await lockManager.withLock(`user:${userId}:balance`, async () => {
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
                const players = playersJson
                    ? new Map(JSON.parse(playersJson))
                    : new Map();
                const player = players.get(playerKey);
                if (!player)
                    return false;
                // 4. UPDATE in-game chips
                player.chips -= amount;
                player.currentBet += amount;
                // 5. SAVE to Redis
                await this.redis.set(this.stateKeys.players, JSON.stringify([...players]));
                // 6. UPDATE pot
                await this.addToPot(amount);
                // 7. RECORD transaction for audit
                await tx.transaction.create({
                    data: {
                        userId,
                        amount: BigInt(-amount),
                        type: 'BET',
                        metadata: {
                            tableId: this.config.tableId,
                            seatIndex,
                            handNumber: await this.getHandNumber()
                        }
                    }
                });
                return true;
            }, {
                isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
                maxWait: 5000,
                timeout: 10000
            });
            return success;
        }, LockManager_1.LOCK_PRESETS.CRITICAL // Extended timeout for money operations
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
    async awardChips(userId, seatIndex, amount) {
        const lockManager = (0, LockManager_1.getLockManager)();
        const playerKey = `${userId}:${seatIndex}`;
        await lockManager.withLock(`user:${userId}:balance`, async () => {
            await this.prisma.$transaction(async (tx) => {
                // --- Syndicate Tax Logic ---
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
                        const syndicateService = (0, SyndicateService_1.getSyndicateService)();
                        await syndicateService.contributeToTreasury(tx, userForTax.syndicateMembership.syndicateId, userId, taxAmount, {
                            gameType: this.getGameType(),
                            originalWin: amount,
                            gameSessionId: this.config.tableId
                        });
                        // Create a separate transaction log for the tax
                        await tx.transaction.create({
                            data: {
                                userId,
                                amount: BigInt(-taxAmount),
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
                // 1. ADD to database
                await tx.user.update({
                    where: { id: userId },
                    data: { chipBalance: { increment: BigInt(finalAmount) } }
                });
                // 2. FETCH game state
                const playersJson = await this.redis.get(this.stateKeys.players);
                const players = playersJson
                    ? new Map(JSON.parse(playersJson))
                    : new Map();
                const player = players.get(playerKey);
                if (player) {
                    player.chips += finalAmount;
                    // 3. SAVE to Redis
                    await this.redis.set(this.stateKeys.players, JSON.stringify([...players]));
                }
                // 4. RECORD transaction for the win
                await tx.transaction.create({
                    data: {
                        userId,
                        amount: BigInt(finalAmount),
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
        }, LockManager_1.LOCK_PRESETS.CRITICAL);
    }
    /**
     * Get current hand number (for audit trail)
     */
    async getHandNumber() {
        const handNumber = await this.redis.get(this.stateKeys.handNumber);
        return handNumber ? parseInt(handNumber) : 0;
    }
    /**
     * Increment hand number
     */
    async incrementHandNumber() {
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
    async saveCustomState(state) {
        await this.redis.set(this.stateKeys.customState, JSON.stringify(state));
    }
    /**
     * Load custom game state
     *
     * @returns Parsed state object or null
     */
    async loadCustomState() {
        const stateJson = await this.redis.get(this.stateKeys.customState);
        return stateJson ? JSON.parse(stateJson) : null;
    }
    /**
     * Clear all game state (for cleanup)
     */
    async clearState() {
        await this.redis.del(this.stateKeys.gameState, this.stateKeys.players, this.stateKeys.pot, this.stateKeys.handNumber, this.stateKeys.customState);
    }
}
exports.BaseGameEngine = BaseGameEngine;
//# sourceMappingURL=BaseGameEngine.v5.js.map