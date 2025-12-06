"use strict";
/**
 * War Game Engine - High-Velocity Community Table
 *
 * FREE-TIER OPTIMIZED ARCHITECTURE
 * =================================
 * - In-Memory Game Loop: All round logic happens in class instance
 * - Batched DB Writes: Single write per round during payout phase only
 * - Lightweight State Broadcasting: Minimal JSON over sockets
 * - No Seat Ownership: Players bet on any of 25 spots, first-come-first-served
 *
 * TOPOLOGY
 * ========
 * - 5 Zones (arranged in semi-circle)
 * - 5 Spots per Zone
 * - Total: 25 playable betting spots (indices 0-24)
 *
 * HARD ROCK CASINO WAR RULES
 * ===========================
 * - Dealer draws ONE house card
 * - Each active spot gets ONE player card
 * - Win: Player card > Dealer card (pays 1:1)
 * - Lose: Player card < Dealer card (lose bet)
 * - Tie: Player must choose:
 *   - Surrender: Forfeit 50% of bet
 *   - War: Match original bet
 *     - War Win: Player wins (+1 unit on war bet)
 *     - War Tie: Player wins (+2 units total)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarEngine = void 0;
const GameEngine_1 = require("./GameEngine");
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const events_1 = require("events");
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
// Neon color palette for persistent player identification
const NEON_COLORS = [
    '#FF00FF', // Neon Magenta
    '#00FFFF', // Neon Cyan
    '#FFFF00', // Neon Yellow
    '#FF0080', // Neon Pink
    '#00FF00', // Neon Green
    '#FF6600', // Neon Orange
    '#8000FF', // Neon Purple
    '#00FF80', // Neon Mint
    '#FF0040', // Neon Red
    '#40FF00', // Neon Lime
    '#0080FF', // Neon Blue
    '#FF00C0', // Neon Rose
    '#00FFC0', // Neon Aqua
    '#C000FF', // Neon Violet
    '#FFE000', // Neon Gold
];
/**
 * Fetch external entropy from Cloudflare's QRNG service
 */
async function fetchQRNGEntropy() {
    return new Promise((resolve) => {
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
 * War Game Engine - Community Table (Free-Tier Optimized)
 */
class WarEngine extends GameEngine_1.GameEngine {
    // Game State (In-Memory)
    spots = []; // 25 spots (indices 0-24)
    playerColors = new Map(); // userId -> persistent color
    playerInfo = new Map(); // userId -> player data
    houseCard = null;
    deck = [];
    bettingPhase = true;
    warPhase = false; // True when waiting for war decisions
    pendingPayouts = new Map(); // Batched DB writes
    // Provably Fair
    playerSeed = '';
    serverSeed = '';
    // Socket Events
    events = new events_1.EventEmitter();
    // Color Assignment
    colorIndex = 0;
    constructor(roomId, prisma, redis, engagement) {
        super({
            roomId,
            minBet: 10,
            maxBet: 10000,
            maxPlayers: 100 // Community table, no seat limit
        }, prisma, redis, engagement);
        // Initialize 25 empty betting spots (5 zones × 5 spots)
        this.spots = Array(25).fill(null).map(() => ({ bet: 0 }));
        this.deck = this.createDeck();
        this.state = GameEngine_1.GameState.PLACING_BETS;
    }
    getGameType() {
        return 'WAR';
    }
    // ==========================================================================
    // DECK MANAGEMENT (Provably Fair)
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
    shuffleDeck(deck) {
        const shuffled = [...deck];
        const combinedHash = crypto_1.default
            .createHash('sha256')
            .update(this.playerSeed + this.serverSeed)
            .digest();
        let seedIndex = 0;
        for (let i = shuffled.length - 1; i > 0; i--) {
            const byte = combinedHash[seedIndex % 32];
            const j = byte % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            seedIndex++;
        }
        this.events.emit('deck_shuffled', { cardCount: shuffled.length });
        return shuffled;
    }
    async initializeWithQRNG(playerSeed) {
        this.playerSeed = playerSeed;
        this.serverSeed = await fetchQRNGEntropy();
        this.deck = this.createDeck();
        this.events.emit('qrng_initialized', {
            playerSeedHash: crypto_1.default.createHash('sha256').update(playerSeed).digest('hex').substring(0, 8)
        });
    }
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
        const card = this.deck.pop() || null;
        if (card) {
            this.events.emit('card_drawn', { cardsRemaining: this.deck.length });
        }
        return card;
    }
    // ==========================================================================
    // PLAYER CONNECTION (No Sit-Down Required)
    // ==========================================================================
    /**
     * Connect player to table and assign persistent neon color
     */
    async connectPlayer(userId, name) {
        // Check if player already connected (return existing color)
        if (this.playerColors.has(userId)) {
            const player = this.playerInfo.get(userId);
            return {
                success: true,
                color: this.playerColors.get(userId),
                chips: player?.chipBalance || 0
            };
        }
        // Load player balance from DB (one-time read)
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return { success: false, color: '', chips: 0 };
        }
        // Assign persistent neon color
        const color = NEON_COLORS[this.colorIndex % NEON_COLORS.length];
        this.colorIndex++;
        this.playerColors.set(userId, color);
        this.playerInfo.set(userId, {
            userId,
            name,
            color,
            chipBalance: Number(user.chipBalance)
        });
        this.events.emit('player_connected', { userId, name, color });
        return {
            success: true,
            color,
            chips: Number(user.chipBalance)
        };
    }
    /**
     * Disconnect player (optional cleanup)
     */
    disconnectPlayer(userId) {
        // Note: Color persists in playerColors Map for reconnection
        this.events.emit('player_disconnected', { userId });
    }
    /**
     * Get player info
     */
    getPlayer(userId) {
        return this.playerInfo.get(userId) || null;
    }
    // ==========================================================================
    // BETTING (First-Come-First-Served on 25 Spots)
    // ==========================================================================
    /**
     * Place bet on any spot (0-24)
     * NO database write - all in-memory
     */
    async placeBet(userId, amount, spotIndex) {
        if (!this.bettingPhase || this.warPhase)
            return false;
        if (spotIndex === undefined || spotIndex < 0 || spotIndex >= 25)
            return false;
        if (!this.validateBet(amount))
            return false;
        const player = this.playerInfo.get(userId);
        if (!player)
            return false;
        const spot = this.spots[spotIndex];
        // Check if spot is already occupied
        if (spot.bet > 0 && spot.playerId !== userId) {
            this.events.emit('spot_occupied', { spotIndex, occupiedBy: spot.playerId });
            return false;
        }
        // Check if player has sufficient chips (in-memory check)
        if (player.chipBalance < amount) {
            this.events.emit('insufficient_chips', { userId, required: amount, available: player.chipBalance });
            return false;
        }
        // Deduct chips in-memory (NO DB WRITE YET)
        player.chipBalance -= amount;
        // Place bet
        if (spot.playerId === userId) {
            // Add to existing bet
            spot.bet += amount;
        }
        else {
            // New bet
            spot.bet = amount;
            spot.playerId = userId;
            spot.playerName = player.name;
            spot.playerColor = player.color;
        }
        this.pot += amount;
        this.events.emit('bet_placed', {
            userId,
            spotIndex,
            amount,
            totalBet: spot.bet,
            color: player.color,
            playerChips: player.chipBalance
        });
        return true;
    }
    /**
     * Remove bet (only during betting phase)
     */
    removeBet(userId, spotIndex) {
        if (!this.bettingPhase || this.warPhase)
            return false;
        if (spotIndex < 0 || spotIndex >= 25)
            return false;
        const spot = this.spots[spotIndex];
        if (spot.playerId !== userId)
            return false;
        const player = this.playerInfo.get(userId);
        if (!player)
            return false;
        // Return chips in-memory
        player.chipBalance += spot.bet;
        this.pot -= spot.bet;
        const refundAmount = spot.bet;
        // Clear spot
        spot.bet = 0;
        spot.playerId = undefined;
        spot.playerName = undefined;
        spot.playerColor = undefined;
        spot.card = undefined;
        this.events.emit('bet_removed', { userId, spotIndex, refundAmount, playerChips: player.chipBalance });
        return true;
    }
    /**
     * Get all active spots
     */
    getActiveSpots() {
        return this.spots
            .map((spot, index) => ({ index, spot }))
            .filter(({ spot }) => spot.bet > 0 && spot.playerId);
    }
    // ==========================================================================
    // GAME FLOW
    // ==========================================================================
    async startNewHand() {
        const activeSpots = this.getActiveSpots();
        if (!this.bettingPhase || activeSpots.length === 0)
            return;
        this.bettingPhase = false;
        this.handNumber++;
        this.state = GameEngine_1.GameState.DEALING;
        this.events.emit('hand_started', { handNumber: this.handNumber, activeSpotsCount: activeSpots.length });
        // Deal cards to all active spots
        for (const { spot } of activeSpots) {
            spot.card = this.drawCard() || undefined;
        }
        // Deal single house card
        this.houseCard = this.drawCard();
        this.events.emit('cards_dealt', {
            houseCard: this.houseCard,
            spotCards: activeSpots.map(({ index, spot }) => ({ index, card: spot.card }))
        });
        // Check for ties (war decision required)
        const tieSpots = activeSpots.filter(({ spot }) => spot.card && this.houseCard && spot.card.value === this.houseCard.value);
        if (tieSpots.length > 0) {
            // War phase - wait for player decisions
            this.warPhase = true;
            this.state = GameEngine_1.GameState.PLAYER_TURN;
            for (const { index, spot } of tieSpots) {
                spot.decision = 'pending';
            }
            this.events.emit('war_decisions_required', {
                spots: tieSpots.map(({ index }) => index)
            });
            await this.saveStateToRedis();
        }
        else {
            // No ties, proceed to resolution
            await this.resolveHand();
        }
    }
    /**
     * Handle war decision (Surrender or War)
     */
    async makeWarDecision(userId, spotIndex, decision) {
        if (!this.warPhase)
            return false;
        if (spotIndex < 0 || spotIndex >= 25)
            return false;
        const spot = this.spots[spotIndex];
        if (spot.playerId !== userId || spot.decision !== 'pending')
            return false;
        const player = this.playerInfo.get(userId);
        if (!player)
            return false;
        if (decision === 'surrender') {
            // Surrender: Return 50% of bet
            const refund = Math.floor(spot.bet * 0.5);
            player.chipBalance += refund;
            spot.decision = 'surrender';
            this.events.emit('war_surrender', { userId, spotIndex, refund, playerChips: player.chipBalance });
        }
        else {
            // War: Match the original bet
            if (player.chipBalance < spot.bet) {
                this.events.emit('insufficient_chips_for_war', { userId, spotIndex });
                return false;
            }
            player.chipBalance -= spot.bet;
            spot.warBet = spot.bet;
            spot.decision = 'war';
            this.events.emit('war_declared', { userId, spotIndex, warBet: spot.warBet, playerChips: player.chipBalance });
            // Deal war cards
            spot.card = this.drawCard() || undefined;
            this.houseCard = this.drawCard();
            this.events.emit('war_cards_dealt', {
                spotIndex,
                playerCard: spot.card,
                houseCard: this.houseCard
            });
        }
        // Check if all war decisions are made
        const pendingDecisions = this.spots.filter(spot => spot.decision === 'pending');
        if (pendingDecisions.length === 0) {
            this.warPhase = false;
            await this.resolveHand();
        }
        return true;
    }
    /**
     * Resolve hand and execute BATCHED DATABASE WRITE
     */
    async resolveHand() {
        if (!this.houseCard)
            return;
        this.state = GameEngine_1.GameState.RESOLVING;
        this.pendingPayouts.clear(); // Reset batch
        const dealerValue = this.houseCard.value;
        const activeSpots = this.getActiveSpots();
        for (const { index, spot } of activeSpots) {
            if (!spot.card || !spot.playerId)
                continue;
            const player = this.playerInfo.get(spot.playerId);
            if (!player)
                continue;
            const playerValue = spot.card.value;
            let outcome = 'lose';
            let payout = 0;
            // Handle surrender
            if (spot.decision === 'surrender') {
                outcome = 'surrender';
                payout = 0; // Already refunded 50%
            }
            // Handle war resolution
            else if (spot.decision === 'war' && spot.warBet) {
                if (playerValue > dealerValue) {
                    // War Win: +1 unit on war bet
                    outcome = 'war_win';
                    payout = spot.warBet * 2; // Return war bet + winnings
                    player.chipBalance += payout;
                }
                else if (playerValue === dealerValue) {
                    // War Tie: +2 units total (original bet + war bet)
                    outcome = 'war_tie';
                    payout = (spot.bet + spot.warBet) * 2;
                    player.chipBalance += payout;
                }
                else {
                    // War Lose
                    outcome = 'lose';
                    payout = 0; // Lose both bets
                }
            }
            // Standard resolution
            else {
                if (playerValue > dealerValue) {
                    // Win: +1 unit
                    outcome = 'win';
                    payout = spot.bet * 2;
                    player.chipBalance += payout;
                }
                else if (playerValue === dealerValue) {
                    // This shouldn't happen (ties trigger war phase)
                    outcome = 'win'; // Push
                    payout = spot.bet;
                    player.chipBalance += payout;
                }
                else {
                    // Lose
                    outcome = 'lose';
                    payout = 0;
                }
            }
            // Track payout for batched DB write
            this.trackPayout(spot.playerId, spot.bet, spot.warBet || 0, payout);
            this.events.emit('spot_resolved', {
                spotIndex: index,
                userId: spot.playerId,
                outcome,
                playerCard: spot.card,
                playerValue,
                dealerValue,
                payout,
                playerChips: player.chipBalance
            });
        }
        this.state = GameEngine_1.GameState.COMPLETE;
        // CRITICAL: Single batched database write
        await this.executeBatchedPayouts();
        this.events.emit('hand_complete', {
            handNumber: this.handNumber,
            dealerCard: this.houseCard,
            dealerValue
        });
        await this.saveStateToRedis();
    }
    /**
     * Track payout for batched write
     */
    trackPayout(userId, bet, warBet, payout) {
        const totalWagered = bet + warBet;
        const netWin = payout - totalWagered;
        if (!this.pendingPayouts.has(userId)) {
            this.pendingPayouts.set(userId, {
                userId,
                chipDelta: netWin,
                wagered: totalWagered,
                won: payout
            });
        }
        else {
            const pending = this.pendingPayouts.get(userId);
            pending.chipDelta += netWin;
            pending.wagered += totalWagered;
            pending.won += payout;
        }
    }
    /**
     * BATCHED DATABASE WRITE - Free-Tier Optimization
     * Single transaction per round
     */
    async executeBatchedPayouts() {
        if (this.pendingPayouts.size === 0)
            return;
        const sessionId = crypto_1.default.randomUUID();
        this.events.emit('payout_batch_started', { playerCount: this.pendingPayouts.size });
        try {
            await this.prisma.$transaction(async (tx) => {
                for (const [userId, payout] of this.pendingPayouts.entries()) {
                    const player = this.playerInfo.get(userId);
                    if (!player)
                        continue;
                    const user = await tx.user.findUnique({ where: { id: userId } });
                    if (!user)
                        continue;
                    // Update user balance and stats
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            chipBalance: player.chipBalance,
                            totalWagered: { increment: payout.wagered },
                            totalWon: payout.won > 0 ? { increment: payout.won } : undefined,
                            totalHandsPlayed: { increment: 1 },
                            lastHandPlayed: new Date()
                        }
                    });
                    // Record transaction
                    if (payout.chipDelta !== 0) {
                        await tx.transaction.create({
                            data: {
                                userId,
                                amount: payout.chipDelta,
                                type: payout.chipDelta > 0 ? 'WIN' : 'BET',
                                balanceBefore: Number(user.chipBalance),
                                balanceAfter: BigInt(player.chipBalance),
                                gameSessionId: sessionId,
                                description: `WAR - Hand #${this.handNumber}`
                            }
                        });
                    }
                    // Check for big win
                    if (payout.chipDelta > payout.wagered * 5) {
                        await this.engagement.recordBigWin(userId, payout.chipDelta, 'WAR');
                    }
                }
                // Create game session record
                await tx.gameSession.create({
                    data: {
                        id: sessionId,
                        gameType: 'WAR',
                        roomId: this.config.roomId,
                        hostUserId: Array.from(this.pendingPayouts.keys())[0],
                        serverSeed: this.serverSeed,
                        finalState: {
                            handNumber: this.handNumber,
                            activeSpotsCount: this.getActiveSpots().length
                        },
                        totalPot: this.pot,
                        winners: Array.from(this.pendingPayouts.entries())
                            .filter(([_, p]) => p.chipDelta > 0)
                            .map(([userId, p]) => ({ userId, amount: p.chipDelta }))
                    }
                });
            });
            this.events.emit('payout_batch_complete', { sessionId });
        }
        catch (error) {
            this.events.emit('payout_batch_error', { error: String(error) });
            console.error('Batched payout failed:', error);
        }
        this.pendingPayouts.clear();
    }
    /**
     * Reset for next round
     */
    async resetForNextRound() {
        this.pot = 0;
        this.houseCard = null;
        this.bettingPhase = true;
        this.warPhase = false;
        this.state = GameEngine_1.GameState.PLACING_BETS;
        // Clear all spots
        for (const spot of this.spots) {
            spot.bet = 0;
            spot.playerId = undefined;
            spot.playerName = undefined;
            spot.playerColor = undefined;
            spot.card = undefined;
            spot.warBet = undefined;
            spot.decision = undefined;
        }
        this.events.emit('round_reset', {});
        await this.saveStateToRedis();
    }
    // ==========================================================================
    // STATE BROADCASTING (Lightweight JSON)
    // ==========================================================================
    getGameState() {
        return {
            roomId: this.config.roomId,
            gameType: 'WAR',
            spots: this.spots.map((spot, index) => ({
                index,
                bet: spot.bet,
                playerId: spot.playerId,
                playerColor: spot.playerColor,
                card: spot.card,
                decision: spot.decision,
                warBet: spot.warBet
            })),
            houseCard: this.houseCard,
            pot: this.pot,
            minBet: this.config.minBet,
            maxBet: this.config.maxBet,
            bettingPhase: this.bettingPhase,
            warPhase: this.warPhase,
            status: this.getStatusMessage(),
            handNumber: this.handNumber,
            state: this.state
        };
    }
    /**
     * Get player-specific state (includes personal chip balance)
     */
    getPlayerState(userId) {
        const player = this.playerInfo.get(userId);
        return {
            ...this.getGameState(),
            playerColor: this.playerColors.get(userId),
            playerChips: player?.chipBalance || 0,
            playerSpots: this.spots
                .map((spot, index) => ({ index, spot }))
                .filter(({ spot }) => spot.playerId === userId)
                .map(({ index }) => index)
        };
    }
    getStatusMessage() {
        if (this.bettingPhase)
            return 'Place your bets!';
        if (this.warPhase)
            return 'War decisions required';
        if (this.state === GameEngine_1.GameState.DEALING)
            return 'Dealing cards...';
        if (this.state === GameEngine_1.GameState.RESOLVING)
            return 'Resolving hands...';
        return 'Round complete';
    }
    // ==========================================================================
    // UTILITY
    // ==========================================================================
    getActiveSpotsCount() {
        return this.spots.filter(spot => spot.bet > 0).length;
    }
    getPlayerCount() {
        return this.playerInfo.size;
    }
    getConnectedPlayers() {
        return Array.from(this.playerInfo.values());
    }
}
exports.WarEngine = WarEngine;
//# sourceMappingURL=WarEngine.js.map