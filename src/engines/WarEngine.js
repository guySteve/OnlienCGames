"use strict";
/**
 * War Game Engine
 *
 * Implements the Casino War card game logic following the GameEngine architecture.
 * Supports multi-seat play where one player can occupy multiple seats.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarEngine = void 0;
const GameEngine_1 = require("./GameEngine");
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
    { rank: 'A', value: 14 },
    { rank: 'K', value: 13 },
    { rank: 'Q', value: 12 },
    { rank: 'J', value: 11 },
    { rank: '10', value: 10 },
    { rank: '9', value: 9 },
    { rank: '8', value: 8 },
    { rank: '7', value: 7 },
    { rank: '6', value: 6 },
    { rank: '5', value: 5 },
    { rank: '4', value: 4 },
    { rank: '3', value: 3 },
    { rank: '2', value: 2 }
];
/**
 * Fetch external entropy from Cloudflare's QRNG service
 */
async function fetchQRNGEntropy() {
    return new Promise((resolve, reject) => {
        const request = https_1.default.get('https://drand.cloudflare.com/public/latest', (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.randomness || crypto_1.default.randomBytes(32).toString('hex'));
                }
                catch (e) {
                    resolve(crypto_1.default.randomBytes(32).toString('hex'));
                }
            });
        });
        request.on('error', () => {
            resolve(crypto_1.default.randomBytes(32).toString('hex'));
        });
    });
}
const PLAYER_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#FFE66D', // Yellow
    '#95E1D3', // Mint
    '#F38181', // Pink
    '#AA96DA', // Purple
    '#FCBAD3', // Light Pink
    '#A8D8EA', // Light Blue
    '#FFD93D', // Gold
    '#6BCB77' // Green
];
/**
 * War Game Engine - Multi-Spot Betting Implementation
 */
class WarEngine extends GameEngine_1.GameEngine {
    constructor(roomId, prisma, redis, engagement, options = {}) {
        super({
            roomId,
            minBet: WarEngine.getMinBet(),
            maxBet: 10000,
            maxPlayers: 20 // 5 seats × 4 spots
        }, prisma, redis, engagement);
        this.seats = [];
        this.players = new Map();
        this.houseCard = null;
        this.deck = [];
        this.bettingPhase = true;
        this.observers = new Set();
        this.gameSessionId = null;
        this.playerSeed = '';
        this.serverSeed = '';
        this.tableCode = '';
        this.isPrivate = false;
        this.colorIndex = 0;
        // Handle private game options
        if (options.isPrivate) {
            this.isPrivate = true;
            this.tableCode = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
        }
        // Initialize 5 seats, each with 4 empty betting spots
        this.seats = Array(5).fill(null).map(() => ({
            spots: Array(4).fill(null).map(() => ({ bet: 0 }))
        }));
        this.deck = this.createDeck();
    }
    getGameType() {
        return 'WAR';
    }
    /**
     * Get table code for private games
     */
    getTableCode() {
        return this.tableCode;
    }
    /**
     * Check if game is waiting for more players
     */
    isWaitingForOpponent() {
        const seatedCount = this.seats.filter(s => !s.empty).length;
        return seatedCount < 2 && this.bettingPhase;
    }
    // ==========================================================================
    // DECK MANAGEMENT
    // ==========================================================================
    createDeck() {
        const deck = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                deck.push({ rank: rank.rank, value: rank.value, suit });
            }
        }
        return this.shuffleDeck(deck);
    }
    /**
     * Shuffle deck using dual-seed hashing (Provably Fair 2.0)
     * Combines player seed + server seed for verifiable randomness
     */
    shuffleDeck(deck) {
        const shuffled = [...deck];
        // Generate deterministic RNG from combined seeds
        const combinedHash = crypto_1.default
            .createHash('sha256')
            .update(this.playerSeed + this.serverSeed)
            .digest();
        let seedIndex = 0;
        for (let i = shuffled.length - 1; i > 0; i--) {
            // Use bytes from hash as seed for randomness
            const byte = combinedHash[seedIndex % 32];
            const j = byte % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            seedIndex++;
        }
        return shuffled;
    }
    /**
     * Initialize game with QRNG entropy and player seed
     */
    async initializeWithQRNG(playerSeed) {
        this.playerSeed = playerSeed;
        this.serverSeed = await fetchQRNGEntropy();
        this.deck = this.createDeck();
    }
    /**
     * Get the dual seeds for verification (public audit)
     */
    getDualSeeds() {
        return {
            playerSeed: this.playerSeed,
            serverSeed: this.serverSeed
        };
    }
    drawCard() {
        if (this.deck.length === 0) {
            this.deck = this.createDeck();
        }
        return this.deck.pop() || null;
    }
    // ==========================================================================
    // PLAYER MANAGEMENT
    // ==========================================================================
    /**
     * Join game as a player (assigns color, no seat required)
     */
    joinGame(playerId, name, photo, chips) {
        if (this.players.has(playerId)) {
            const player = this.players.get(playerId);
            return { success: true, color: player.color };
        }
        // Assign a color to the player
        const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
        this.colorIndex++;
        this.players.set(playerId, {
            playerId,
            name,
            photo: photo || undefined,
            chips,
            color
        });
        return { success: true, color };
    }
    /**
     * Leave game - remove all bets and player info
     */
    leaveGame(playerId) {
        if (!this.players.has(playerId)) {
            return { success: false };
        }
        // Clear all bets from this player
        for (const seat of this.seats) {
            for (const spot of seat.spots) {
                if (spot.playerId === playerId) {
                    spot.bet = 0;
                    spot.playerId = undefined;
                    spot.playerName = undefined;
                    spot.playerColor = undefined;
                    spot.card = undefined;
                }
            }
        }
        this.players.delete(playerId);
        return { success: true };
    }
    /**
     * Get player info
     */
    getPlayer(playerId) {
        return this.players.get(playerId) || null;
    }
    /**
     * Update player chips
     */
    updatePlayerChips(playerId, chips) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        player.chips = chips;
        return true;
    }
    // ==========================================================================
    // BETTING
    // ==========================================================================
    /**
     * Place bet on a specific spot
     */
    async placeBet(playerId, amount, seatIndex, spotIndex) {
        if (!this.bettingPhase)
            return false;
        if (!this.validateBet(amount))
            return false;
        if (seatIndex < 0 || seatIndex >= 5)
            return false;
        if (spotIndex < 0 || spotIndex >= 4)
            return false;
        const player = this.players.get(playerId);
        if (!player || player.chips < amount) {
            return false;
        }
        const spot = this.seats[seatIndex].spots[spotIndex];
        // Check if spot is already occupied by another player
        if (spot.bet > 0 && spot.playerId !== playerId) {
            return false;
        }
        // If player already has a bet here, add to it
        if (spot.playerId === playerId) {
            player.chips -= amount;
            spot.bet += amount;
            this.pot += amount;
        }
        else {
            // New bet on empty spot
            player.chips -= amount;
            spot.bet = amount;
            spot.playerId = playerId;
            spot.playerName = player.name;
            spot.playerColor = player.color;
            this.pot += amount;
        }
        return true;
    }
    /**
     * Remove bet from a specific spot
     */
    removeBet(playerId, seatIndex, spotIndex) {
        if (!this.bettingPhase)
            return false;
        if (seatIndex < 0 || seatIndex >= 5)
            return false;
        if (spotIndex < 0 || spotIndex >= 4)
            return false;
        const spot = this.seats[seatIndex].spots[spotIndex];
        if (spot.playerId !== playerId)
            return false;
        const player = this.players.get(playerId);
        if (!player)
            return false;
        // Return chips to player
        player.chips += spot.bet;
        this.pot -= spot.bet;
        // Clear spot
        spot.bet = 0;
        spot.playerId = undefined;
        spot.playerName = undefined;
        spot.playerColor = undefined;
        return true;
    }
    /**
     * Check if any bets have been placed
     */
    hasActiveBets() {
        for (const seat of this.seats) {
            for (const spot of seat.spots) {
                if (spot.bet > 0)
                    return true;
            }
        }
        return false;
    }
    /**
     * Get all active betting spots
     */
    getActiveSpots() {
        const active = [];
        for (let seatIndex = 0; seatIndex < this.seats.length; seatIndex++) {
            for (let spotIndex = 0; spotIndex < this.seats[seatIndex].spots.length; spotIndex++) {
                const spot = this.seats[seatIndex].spots[spotIndex];
                if (spot.bet > 0 && spot.playerId) {
                    active.push({ seatIndex, spotIndex, spot });
                }
            }
        }
        return active;
    }
    // ==========================================================================
    // GAME FLOW
    // ==========================================================================
    async startNewHand() {
        if (!this.bettingPhase || !this.hasActiveBets())
            return;
        this.bettingPhase = false;
        this.handNumber++;
        this.state = GameEngine_1.GameState.DEALING;
        // Deal cards to all active betting spots
        const activeSpots = this.getActiveSpots();
        for (const { spot } of activeSpots) {
            spot.card = this.drawCard() || undefined;
        }
        // Deal house card
        this.houseCard = this.drawCard() || null;
        this.state = GameEngine_1.GameState.RESOLVING;
        await this.saveStateToRedis();
    }
    /**
     * Resolve hand - Each betting spot plays against the dealer individually
     * Casino War Rules:
     * - Player wins: Pays 1:1 on bet
     * - Dealer wins: Player loses bet
     * - Tie: Player can surrender (lose half) or go to war (auto-push for simplicity)
     */
    async resolveHand() {
        if (!this.houseCard)
            return null;
        const dealerValue = this.houseCard.value;
        const results = {
            outcomes: [],
            dealerCard: this.houseCard,
            dealerValue
        };
        // Resolve each betting spot against the dealer individually
        const activeSpots = this.getActiveSpots();
        for (const { seatIndex, spotIndex, spot } of activeSpots) {
            if (!spot.card || !spot.playerId)
                continue;
            const playerValue = spot.card.value;
            const bet = spot.bet;
            const player = this.players.get(spot.playerId);
            if (!player)
                continue;
            let outcome = 'lose';
            let payout = 0;
            if (playerValue > dealerValue) {
                // Player wins - pays 1:1
                outcome = 'win';
                payout = bet * 2; // Return bet + winnings
                player.chips += payout;
            }
            else if (playerValue === dealerValue) {
                // Tie - in simplified Casino War, push (return bet)
                outcome = 'tie';
                payout = bet; // Return original bet
                player.chips += payout;
            }
            else {
                // Dealer wins - player loses bet (already deducted)
                outcome = 'lose';
                payout = 0;
            }
            results.outcomes.push({
                seatIndex,
                spotIndex,
                playerId: spot.playerId,
                playerName: spot.playerName,
                playerColor: spot.playerColor,
                playerCard: spot.card,
                playerValue,
                outcome,
                bet,
                payout
            });
        }
        // Clear pot since each spot is resolved individually
        this.pot = 0;
        this.state = GameEngine_1.GameState.COMPLETE;
        await this.saveStateToRedis();
        return results;
    }
    /**
     * Reset for next round
     */
    async resetForNextRound() {
        this.pot = 0;
        this.houseCard = null;
        this.bettingPhase = true;
        this.state = GameEngine_1.GameState.PLACING_BETS;
        // Clear all betting spots
        for (const seat of this.seats) {
            for (const spot of seat.spots) {
                spot.bet = 0;
                spot.playerId = undefined;
                spot.playerName = undefined;
                spot.playerColor = undefined;
                spot.card = undefined;
            }
        }
        await this.saveStateToRedis();
    }
    // ==========================================================================
    // STATE & OBSERVERS
    // ==========================================================================
    getGameState() {
        return {
            roomId: this.config.roomId,
            gameType: 'WAR',
            seats: this.seats,
            players: Array.from(this.players.values()),
            houseCard: this.houseCard,
            pot: this.pot,
            minBet: this.config.minBet,
            maxBet: this.config.maxBet,
            bettingPhase: this.bettingPhase,
            status: this.getStatusMessage(),
            observerCount: this.observers.size,
            isPrivate: this.isPrivate,
            tableCode: this.tableCode,
            waitingForOpponent: this.isWaitingForOpponent()
        };
    }
    getStatusMessage() {
        if (this.bettingPhase) {
            return 'Place your bets!';
        }
        if (this.state === GameEngine_1.GameState.DEALING) {
            return 'Dealing cards...';
        }
        if (this.state === GameEngine_1.GameState.RESOLVING) {
            return 'Revealing cards...';
        }
        return '';
    }
    addObserver(socketId) {
        this.observers.add(socketId);
    }
    removeObserver(socketId) {
        this.observers.delete(socketId);
    }
    getActiveBetsCount() {
        let count = 0;
        for (const seat of this.seats) {
            for (const spot of seat.spots) {
                if (spot.bet > 0)
                    count++;
            }
        }
        return count;
    }
    getPlayerCount() {
        return this.players.size;
    }
    // ==========================================================================
    // UTILITY
    // ==========================================================================
    static getMinBet() {
        const hour = new Date().getHours();
        return hour >= 20 ? 50 : 10; // High Stakes Night after 8 PM
    }
}
exports.WarEngine = WarEngine;
