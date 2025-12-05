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
/**
 * War Game Engine - Modular implementation
 */
class WarEngine extends GameEngine_1.GameEngine {
    seats = [];
    houseCard = null;
    deck = [];
    bettingPhase = true;
    observers = new Set();
    gameSessionId = null;
    playerSeed = '';
    serverSeed = '';
    // Head-to-Head Private Mode
    isPrivate = false;
    tableCode = null;
    maxPlayersForMode = 5;
    waitingForOpponent = false;
    constructor(roomId, prisma, redis, engagement, options = {}) {
        super({
            roomId,
            minBet: WarEngine.getMinBet(),
            maxBet: 10000,
            maxPlayers: options.isPrivate ? 2 : 5
        }, prisma, redis, engagement);
        // Head-to-Head Private Mode setup
        this.isPrivate = options.isPrivate || false;
        this.maxPlayersForMode = this.isPrivate ? 2 : 5;
        if (this.isPrivate) {
            this.tableCode = WarEngine.generateTableCode();
            this.waitingForOpponent = true;
        }
        // Initialize seats based on mode
        this.seats = Array(this.maxPlayersForMode).fill(null).map(() => ({ empty: true }));
        this.deck = this.createDeck();
    }
    /**
     * Generate a 4-digit table code for private games
     */
    static generateTableCode() {
        return 'W-' + Math.floor(1000 + Math.random() * 9000).toString();
    }
    /**
     * Check if game is waiting for opponent in private mode
     */
    isWaitingForOpponent() {
        if (!this.isPrivate) return false;
        const seatedCount = this.seats.filter(s => !s.empty).length;
        return seatedCount < 2;
    }
    /**
     * Get table code for private games
     */
    getTableCode() {
        return this.tableCode;
    }
    /**
     * Check if private game is ready to start
     */
    isPrivateGameReady() {
        if (!this.isPrivate) return true;
        const seatedCount = this.seats.filter(s => !s.empty).length;
        return seatedCount === 2;
    }
    getGameType() {
        return 'WAR';
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
    // SEAT MANAGEMENT
    // ==========================================================================
    /**
     * Sit player at specific seat
     */
    sitAtSeat(socketId, seatIndex, name, photo, chips) {
        if (seatIndex < 0 || seatIndex >= 5) {
            return { success: false, error: 'Invalid seat index' };
        }
        if (!this.seats[seatIndex].empty) {
            return { success: false, error: 'Seat already occupied' };
        }
        this.seats[seatIndex] = {
            empty: false,
            socketId,
            name,
            photo: photo || undefined,
            chips,
            currentBet: 0,
            ready: false,
            card: undefined,
            connected: true
        };
        return { success: true };
    }
    /**
     * Leave seat
     */
    leaveSeat(socketId, seatIndex) {
        if (seatIndex !== null && seatIndex !== undefined) {
            // Leave specific seat
            if (this.seats[seatIndex] && this.seats[seatIndex].socketId === socketId) {
                this.seats[seatIndex] = { empty: true };
                return { success: true, seatIndex };
            }
        }
        else {
            // Leave any seat with this socketId
            for (let i = 0; i < this.seats.length; i++) {
                if (this.seats[i].socketId === socketId) {
                    this.seats[i] = { empty: true };
                    return { success: true, seatIndex: i };
                }
            }
        }
        return { success: false };
    }
    // ==========================================================================
    // BETTING
    // ==========================================================================
    async placeBet(userId, amount, seatIndex) {
        if (!this.bettingPhase)
            return false;
        if (!this.validateBet(amount))
            return false;
        const seat = this.seats[seatIndex || 0];
        if (seat.empty || !seat.chips || seat.chips < amount) {
            return false;
        }
        // Deduct chips and place bet
        seat.chips -= amount;
        seat.currentBet = amount;
        seat.ready = true;
        this.pot += amount;
        return true;
    }
    /**
     * Check if all seated players have placed bets
     * For private mode, requires exactly 2 players
     */
    allSeatedReady() {
        const seatedPlayers = this.seats.filter(s => !s.empty);
        if (seatedPlayers.length === 0)
            return false;
        // Private mode requires exactly 2 players
        if (this.isPrivate && seatedPlayers.length !== 2) {
            return false;
        }
        return seatedPlayers.every(s => s.ready);
    }
    // ==========================================================================
    // GAME FLOW
    // ==========================================================================
    async startNewHand() {
        if (!this.bettingPhase)
            return;
        this.bettingPhase = false;
        this.handNumber++;
        this.state = GameEngine_1.GameState.DEALING;
        // Deal cards to all seated and ready players
        for (const seat of this.seats) {
            if (!seat.empty && seat.ready) {
                seat.card = this.drawCard() || undefined;
            }
        }
        // Deal house card
        this.houseCard = this.drawCard() || null;
        this.state = GameEngine_1.GameState.RESOLVING;
        await this.saveStateToRedis();
    }
    async resolveHand() {
        if (!this.houseCard)
            return null;
        const houseValue = this.houseCard.value;
        const results = { winners: [], pot: this.pot, type: 'win' };
        // Compare each player's card to house
        const playerCards = this.seats
            .map((seat, index) => ({ seat, index, card: seat.card }))
            .filter(p => p.card !== undefined);
        if (playerCards.length === 0) {
            return null;
        }
        // Find highest player card
        const maxPlayerValue = Math.max(...playerCards.map(p => p.card.value));
        if (maxPlayerValue > houseValue) {
            // Players win
            const winners = playerCards.filter(p => p.card.value === maxPlayerValue);
            const payoutPerWinner = Math.floor(this.pot / winners.length);
            for (const winner of winners) {
                if (winner.seat.chips !== undefined) {
                    winner.seat.chips += payoutPerWinner;
                }
                results.winners.push({
                    name: winner.seat.name,
                    seatIndex: winner.index,
                    isHouse: false
                });
            }
        }
        else if (maxPlayerValue === houseValue) {
            // Tie - split pot
            const tiedPlayers = playerCards.filter(p => p.card.value === maxPlayerValue);
            const payoutPerPlayer = Math.floor(this.pot / (tiedPlayers.length + 1)); // +1 for house
            for (const player of tiedPlayers) {
                if (player.seat.chips !== undefined) {
                    player.seat.chips += payoutPerPlayer;
                }
                results.winners.push({
                    name: player.seat.name,
                    seatIndex: player.index,
                    isHouse: false
                });
            }
            results.winners.push({ name: 'House', isHouse: true });
            results.type = 'tie';
        }
        else {
            // House wins
            results.winners.push({ name: 'House', isHouse: true });
        }
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
        for (const seat of this.seats) {
            if (!seat.empty) {
                seat.currentBet = 0;
                seat.ready = false;
                seat.card = undefined;
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
            seats: this.seats,
            houseCard: this.houseCard,
            pot: this.pot,
            minBet: this.config.minBet,
            bettingPhase: this.bettingPhase,
            status: this.getStatusMessage(),
            observerCount: this.observers.size,
            deck: [], // Don't expose deck
            // Head-to-Head Private Mode info
            isPrivate: this.isPrivate,
            tableCode: this.isPrivate ? this.tableCode : null,
            waitingForOpponent: this.isWaitingForOpponent(),
            maxPlayers: this.maxPlayersForMode,
            gameType: 'WAR'
        };
    }
    getStatusMessage() {
        // Private mode waiting for opponent
        if (this.isPrivate && this.isWaitingForOpponent()) {
            return `Waiting for opponent... Share code: ${this.tableCode}`;
        }
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
    getSeatedCount() {
        return this.seats.filter(s => !s.empty).length;
    }
    getPlayerBySeat(seatIndex) {
        if (seatIndex < 0 || seatIndex >= 5)
            return null;
        return this.seats[seatIndex].empty ? null : this.seats[seatIndex];
    }
    getPlayerBySocket(socketId) {
        for (let i = 0; i < this.seats.length; i++) {
            if (!this.seats[i].empty && this.seats[i].socketId === socketId) {
                return { seat: this.seats[i], seatIndex: i };
            }
        }
        return null;
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
//# sourceMappingURL=WarEngine.js.map