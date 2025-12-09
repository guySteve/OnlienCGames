"use strict";
/**
 * Abstract Game Engine Base Class
 *
 * All game implementations (War, Blackjack) extend this to ensure
 * consistent state management and hook into engagement mechanics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = exports.GameState = void 0;
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
 * Base class for all casino games
 */
class GameEngine {
    config;
    prisma;
    redis;
    engagement;
    state = GameState.WAITING;
    players = new Map();
    pot = 0;
    handNumber = 0;
    constructor(config, prisma, redis, engagement) {
        this.config = config;
        this.prisma = prisma;
        this.redis = redis;
        this.engagement = engagement;
    }
    // ==========================================================================
    // COMMON METHODS - Shared across all games
    // ==========================================================================
    /**
     * Add player to game
     */
    async addPlayer(userId, seatIndex) {
        if (this.players.size >= this.config.maxPlayers) {
            return false;
        }
        // Load player's chip balance from database
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.chipBalance < this.config.minBet) {
            return false;
        }
        this.players.set(`${userId}:${seatIndex}`, {
            userId,
            seatIndex,
            chips: Number(user.chipBalance),
            currentBet: 0,
            connected: true
        });
        return true;
    }
    /**
     * Remove player from game
     */
    removePlayer(userId, seatIndex) {
        this.players.delete(`${userId}:${seatIndex}`);
    }
    /**
     * Validate bet amount
     */
    validateBet(amount) {
        return amount >= this.config.minBet && amount <= this.config.maxBet;
    }
    /**
     * Deduct chips from player (in-game state)
     * Persists to database at end of hand
     */
    async deductChips(userId, seatIndex, amount) {
        const playerKey = `${userId}:${seatIndex}`;
        const player = this.players.get(playerKey);
        if (!player || player.chips < amount) {
            return false;
        }
        player.chips -= amount;
        player.currentBet += amount;
        this.pot += amount;
        return true;
    }
    /**
     * Award chips to player
     */
    awardChips(userId, seatIndex, amount) {
        const playerKey = `${userId}:${seatIndex}`;
        const player = this.players.get(playerKey);
        if (player) {
            player.chips += amount;
        }
    }
    /**
     * Persist chip changes to database
     * Called at end of each hand
     */
    async persistChipChanges(sessionId) {
        for (const player of this.players.values()) {
            const user = await this.prisma.user.findUnique({ where: { id: player.userId } });
            if (!user)
                continue;
            const chipDelta = player.chips - Number(user.chipBalance);
            if (chipDelta !== 0) {
                await this.prisma.$transaction(async (tx) => {
                    await tx.user.update({
                        where: { id: player.userId },
                        data: {
                            chipBalance: player.chips,
                            totalWagered: chipDelta < 0 ? { increment: Math.abs(chipDelta) } : undefined,
                            totalWon: chipDelta > 0 ? { increment: chipDelta } : undefined,
                            totalHandsPlayed: { increment: 1 },
                            lastHandPlayed: new Date()
                        }
                    });
                    // Record transaction
                    await tx.transaction.create({
                        data: {
                            userId: player.userId,
                            amount: chipDelta,
                            type: chipDelta > 0 ? 'WIN' : 'BET',
                            balanceBefore: user.chipBalance,
                            balanceAfter: BigInt(player.chips),
                            gameSessionId: sessionId,
                            description: `${this.getGameType()} - Hand ${this.handNumber}`
                        }
                    });
                });
                // Check for big win ticker
                if (chipDelta > 0) {
                    await this.engagement.recordBigWin(player.userId, chipDelta, this.getGameType());
                }
                // Award XP based on bet size
                const xpEarned = Math.floor(player.currentBet / 10);
                await this.engagement.awardXP(player.userId, xpEarned);
                // Roll for mystery drop
                const drop = await this.engagement.rollMysteryDrop(player.userId);
                if (drop.triggered) {
                    // Frontend should show modal here
                    await this.redis.publish(`room:${this.config.roomId}:mystery-drop`, JSON.stringify({ userId: player.userId, amount: drop.amount }));
                }
            }
        }
    }
    /**
     * Save game state to Redis (hot storage)
     */
    async saveStateToRedis() {
        const state = {
            roomId: this.config.roomId,
            gameType: this.getGameType(),
            state: this.state,
            players: Array.from(this.players.entries()),
            pot: this.pot,
            handNumber: this.handNumber,
            gameState: this.getGameState(),
            timestamp: Date.now()
        };
        await this.redis.setex(`game:${this.config.roomId}:state`, 3600, // 1 hour TTL
        JSON.stringify(state));
    }
    /**
     * Restore game state from Redis (for crash recovery)
     */
    async restoreStateFromRedis() {
        const stored = await this.redis.get(`game:${this.config.roomId}:state`);
        if (!stored)
            return false;
        const state = JSON.parse(stored);
        this.state = state.state;
        this.players = new Map(state.players);
        this.pot = state.pot;
        this.handNumber = state.handNumber;
        return true;
    }
    /**
     * Get current pot size
     */
    getPot() {
        return this.pot;
    }
    /**
     * Get all players
     */
    getPlayers() {
        return Array.from(this.players.values());
    }
    /**
     * Mark player as disconnected
     */
    setPlayerDisconnected(userId, seatIndex) {
        const key = `${userId}:${seatIndex}`;
        const player = this.players.get(key);
        if (player) {
            player.connected = false;
        }
    }
}
exports.GameEngine = GameEngine;
//# sourceMappingURL=GameEngine.js.map