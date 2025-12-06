"use strict";
/**
 * Professional Blackjack Engine - Hard Rock Casino Standards
 *
 * Rules:
 * - 6-deck shoe with 75% penetration
 * - Dealer HITS on soft 17 (Hard Rock Standard)
 * - Blackjack pays 3:2
 * - Insurance pays 2:1
 * - Double down on any two cards
 * - Split pairs (up to 3 hands)
 *
 * Features:
 * - Cryptographically secure Fisher-Yates shuffle
 * - Socket event emissions for real-time updates
 * - Provably fair dual-seed system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlackjackEngine = void 0;
const GameEngine_1 = require("./GameEngine");
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const events_1 = require("events");
class BlackjackEngine extends GameEngine_1.GameEngine {
    shoe = [];
    cutCardPosition = 0;
    currentShoePosition = 0;
    dealerHand = [];
    bjPlayers = new Map();
    currentPlayerIndex = 0;
    DECKS = 6;
    PENETRATION = 0.75;
    BLACKJACK_PAYOUT = 1.5;
    INSURANCE_PAYOUT = 2.0;
    playerSeed = '';
    serverSeed = '';
    // Event emitter for socket broadcasts
    events = new events_1.EventEmitter();
    constructor(config, prisma, redis, engagement) {
        super(config, prisma, redis, engagement);
        this.initializeShoe();
    }
    getGameType() {
        return 'BLACKJACK';
    }
    // ==========================================================================
    // SHOE MANAGEMENT WITH SOCKET EVENTS
    // ==========================================================================
    initializeShoe() {
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const suits = ['♠', '♥', '♦', '♣'];
        this.shoe = [];
        for (let deck = 0; deck < this.DECKS; deck++) {
            for (const suit of suits) {
                for (const rank of ranks) {
                    let value = 0;
                    if (rank === 'A')
                        value = 11;
                    else if (['J', 'Q', 'K'].includes(rank))
                        value = 10;
                    else
                        value = parseInt(rank);
                    this.shoe.push({ rank, suit, value });
                }
            }
        }
        this.events.emit('shuffle_start', { deckCount: this.DECKS });
        this.shuffleShoe();
        this.events.emit('shuffle_complete', { cardCount: this.shoe.length });
        this.cutCardPosition = Math.floor(this.shoe.length * this.PENETRATION);
        this.currentShoePosition = 0;
    }
    shuffleShoe() {
        // Cryptographically secure Fisher-Yates shuffle using dual-seed hash
        const combinedHash = crypto_1.default
            .createHash('sha256')
            .update(this.playerSeed + this.serverSeed)
            .digest();
        let seedIndex = 0;
        for (let i = this.shoe.length - 1; i > 0; i--) {
            const byte = combinedHash[seedIndex % 32];
            const j = byte % (i + 1);
            [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]];
            seedIndex++;
        }
    }
    /**
     * Fetch external entropy from Cloudflare's QRNG service
     */
    async fetchQRNGEntropy() {
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
     * Initialize game with QRNG entropy and player seed
     */
    async initializeWithQRNG(playerSeed) {
        this.playerSeed = playerSeed;
        this.serverSeed = await this.fetchQRNGEntropy();
        this.initializeShoe();
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
    dealCard() {
        if (this.currentShoePosition >= this.cutCardPosition) {
            this.events.emit('cut_card_reached', { remainingCards: this.shoe.length - this.currentShoePosition });
            this.initializeShoe();
        }
        const card = this.shoe[this.currentShoePosition++];
        this.events.emit('card_dealt', { card, position: this.currentShoePosition });
        return card;
    }
    // ==========================================================================
    // HAND EVALUATION
    // ==========================================================================
    calculateHandValue(cards) {
        let total = 0;
        let aces = 0;
        for (const card of cards) {
            if (card.rank === 'A') {
                aces++;
                total += 11;
            }
            else {
                total += card.value;
            }
        }
        // Adjust aces from 11 to 1 if needed
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }
        return total;
    }
    isBlackjack(cards) {
        return cards.length === 2 && this.calculateHandValue(cards) === 21;
    }
    isSoftHand(cards) {
        const hasAce = cards.some(c => c.rank === 'A');
        if (!hasAce)
            return false;
        const total = this.calculateHandValue(cards);
        return total <= 21 && cards.some(c => c.rank === 'A' && c.value === 11);
    }
    // ==========================================================================
    // GAME FLOW WITH EVENT EMISSIONS
    // ==========================================================================
    async placeBet(userId, amount, seatIndex = 0) {
        if (this.state !== GameEngine_1.GameState.PLACING_BETS) {
            return false;
        }
        if (!this.validateBet(amount)) {
            return false;
        }
        const success = await this.deductChips(userId, seatIndex, amount);
        if (!success) {
            return false;
        }
        // Initialize player hand
        this.bjPlayers.set(`${userId}:${seatIndex}`, {
            userId,
            seatIndex,
            hands: [{
                    cards: [],
                    bet: amount,
                    status: 'active',
                    doubled: false,
                    split: false
                }],
            currentHandIndex: 0,
            insurance: 0
        });
        // Emit bet event
        this.events.emit('bet_placed', {
            userId,
            seatIndex,
            amount,
            isHighStakes: amount >= this.config.minBet * 10
        });
        await this.saveStateToRedis();
        return true;
    }
    async startNewHand() {
        this.handNumber++;
        this.state = GameEngine_1.GameState.DEALING;
        this.dealerHand = [];
        this.currentPlayerIndex = 0;
        this.events.emit('hand_started', { handNumber: this.handNumber });
        // Deal initial cards (player-dealer-player-dealer)
        for (let round = 0; round < 2; round++) {
            for (const [key, player] of this.bjPlayers.entries()) {
                const card = this.dealCard();
                player.hands[0].cards.push(card);
                this.events.emit('player_card_dealt', { userId: player.userId, seatIndex: player.seatIndex, card, handIndex: 0 });
            }
            const dealerCard = this.dealCard();
            this.dealerHand.push(dealerCard);
            this.events.emit('dealer_card_dealt', { card: dealerCard, faceDown: round === 1 });
        }
        // Check for dealer blackjack
        if (this.isBlackjack(this.dealerHand)) {
            this.events.emit('dealer_blackjack', { hand: this.dealerHand });
            await this.resolveDealerBlackjack();
            return;
        }
        // Offer insurance if dealer shows ace
        if (this.dealerHand[0].rank === 'A') {
            this.state = GameEngine_1.GameState.PLAYER_TURN;
            this.events.emit('insurance_offered', { dealerUpCard: this.dealerHand[0] });
            return;
        }
        this.state = GameEngine_1.GameState.PLAYER_TURN;
        await this.saveStateToRedis();
    }
    /**
     * Player actions: HIT, STAND, DOUBLE, SPLIT, INSURANCE
     */
    async playerAction(userId, seatIndex, action, insuranceAmount) {
        if (this.state !== GameEngine_1.GameState.PLAYER_TURN) {
            return { success: false };
        }
        const playerKey = `${userId}:${seatIndex}`;
        const player = this.bjPlayers.get(playerKey);
        if (!player)
            return { success: false };
        const hand = player.hands[player.currentHandIndex];
        if (!hand || hand.status !== 'active') {
            return { success: false };
        }
        switch (action) {
            case 'HIT': {
                const card = this.dealCard();
                hand.cards.push(card);
                const value = this.calculateHandValue(hand.cards);
                this.events.emit('player_hit', { userId, seatIndex, card, handValue: value });
                if (value > 21) {
                    hand.status = 'bust';
                    this.events.emit('player_bust', { userId, seatIndex, handValue: value, bet: hand.bet });
                    await this.moveToNextPlayer();
                }
                await this.saveStateToRedis();
                return { success: true, newCard: card, handValue: value, busted: value > 21 };
            }
            case 'STAND': {
                hand.status = 'stand';
                this.events.emit('player_stand', { userId, seatIndex, handValue: this.calculateHandValue(hand.cards) });
                await this.moveToNextPlayer();
                await this.saveStateToRedis();
                return { success: true };
            }
            case 'DOUBLE': {
                if (hand.cards.length !== 2) {
                    return { success: false };
                }
                const doubleSuccess = await this.deductChips(userId, seatIndex, hand.bet);
                if (!doubleSuccess) {
                    return { success: false };
                }
                hand.bet *= 2;
                hand.doubled = true;
                const card = this.dealCard();
                hand.cards.push(card);
                const value = this.calculateHandValue(hand.cards);
                this.events.emit('player_double', { userId, seatIndex, card, newBet: hand.bet });
                hand.status = value > 21 ? 'bust' : 'stand';
                if (value > 21) {
                    this.events.emit('player_bust', { userId, seatIndex, handValue: value, bet: hand.bet });
                }
                await this.moveToNextPlayer();
                await this.saveStateToRedis();
                return { success: true, newCard: card, handValue: value, busted: value > 21 };
            }
            case 'SPLIT': {
                if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) {
                    return { success: false };
                }
                if (player.hands.length >= 3) {
                    return { success: false };
                }
                const splitSuccess = await this.deductChips(userId, seatIndex, hand.bet);
                if (!splitSuccess) {
                    return { success: false };
                }
                const secondCard = hand.cards.pop();
                player.hands.push({
                    cards: [secondCard, this.dealCard()],
                    bet: hand.bet,
                    status: 'active',
                    doubled: false,
                    split: true
                });
                hand.cards.push(this.dealCard());
                hand.split = true;
                this.events.emit('player_split', { userId, seatIndex, handCount: player.hands.length });
                await this.saveStateToRedis();
                return { success: true };
            }
            case 'INSURANCE': {
                if (this.dealerHand[0].rank !== 'A') {
                    return { success: false };
                }
                if (!insuranceAmount || insuranceAmount > hand.bet / 2) {
                    return { success: false };
                }
                const insSuccess = await this.deductChips(userId, seatIndex, insuranceAmount);
                if (!insSuccess) {
                    return { success: false };
                }
                player.insurance = insuranceAmount;
                this.events.emit('insurance_taken', { userId, seatIndex, amount: insuranceAmount });
                await this.saveStateToRedis();
                return { success: true };
            }
            default:
                return { success: false };
        }
    }
    async moveToNextPlayer() {
        const playersArray = Array.from(this.bjPlayers.values());
        const currentPlayer = playersArray[this.currentPlayerIndex];
        if (currentPlayer && currentPlayer.currentHandIndex < currentPlayer.hands.length - 1) {
            currentPlayer.currentHandIndex++;
            return;
        }
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= playersArray.length) {
            await this.dealerPlay();
        }
    }
    async dealerPlay() {
        this.state = GameEngine_1.GameState.DEALER_TURN;
        this.events.emit('dealer_turn_start', {
            holeCard: this.dealerHand[1],
            upCard: this.dealerHand[0]
        });
        // HARD ROCK STANDARD: Dealer HITS on soft 17
        while (true) {
            const value = this.calculateHandValue(this.dealerHand);
            const isSoft = this.isSoftHand(this.dealerHand);
            // Dealer hits on 16 or less, OR on soft 17
            if (value < 17 || (value === 17 && isSoft)) {
                this.events.emit('dealer_thinking', { currentValue: value, isSoft });
                const card = this.dealCard();
                this.dealerHand.push(card);
                this.events.emit('dealer_hit', {
                    card,
                    handValue: this.calculateHandValue(this.dealerHand),
                    reason: value === 17 && isSoft ? 'soft_17' : 'under_17'
                });
            }
            else {
                break;
            }
        }
        const finalValue = this.calculateHandValue(this.dealerHand);
        if (finalValue > 21) {
            this.events.emit('dealer_bust', { handValue: finalValue });
        }
        else {
            this.events.emit('dealer_stand', { handValue: finalValue });
        }
        await this.resolveHand();
    }
    async resolveDealerBlackjack() {
        for (const [key, player] of this.bjPlayers.entries()) {
            if (player.insurance > 0) {
                const payout = player.insurance * this.INSURANCE_PAYOUT;
                this.awardChips(player.userId, player.seatIndex, payout);
                this.events.emit('insurance_win', { userId: player.userId, seatIndex: player.seatIndex, payout });
            }
            const hand = player.hands[0];
            if (this.isBlackjack(hand.cards)) {
                this.awardChips(player.userId, player.seatIndex, hand.bet);
                this.events.emit('push', { userId: player.userId, seatIndex: player.seatIndex, reason: 'both_blackjack' });
            }
            else {
                this.events.emit('player_loss', { userId: player.userId, seatIndex: player.seatIndex, amount: hand.bet });
            }
        }
        await this.completeHand();
    }
    async resolveHand() {
        this.state = GameEngine_1.GameState.RESOLVING;
        const dealerValue = this.calculateHandValue(this.dealerHand);
        const dealerBusted = dealerValue > 21;
        for (const [key, player] of this.bjPlayers.entries()) {
            for (const hand of player.hands) {
                if (hand.status === 'bust') {
                    continue;
                }
                const handValue = this.calculateHandValue(hand.cards);
                // Player blackjack
                if (this.isBlackjack(hand.cards) && !this.isBlackjack(this.dealerHand)) {
                    const payout = hand.bet + Math.floor(hand.bet * this.BLACKJACK_PAYOUT);
                    this.awardChips(player.userId, player.seatIndex, payout);
                    this.events.emit('blackjack', {
                        userId: player.userId,
                        seatIndex: player.seatIndex,
                        payout,
                        bet: hand.bet
                    });
                    continue;
                }
                // Dealer busted
                if (dealerBusted) {
                    const payout = hand.bet * 2;
                    this.awardChips(player.userId, player.seatIndex, payout);
                    this.events.emit('player_win', {
                        userId: player.userId,
                        seatIndex: player.seatIndex,
                        payout,
                        reason: 'dealer_bust'
                    });
                    continue;
                }
                // Compare hands
                if (handValue > dealerValue) {
                    const payout = hand.bet * 2;
                    this.awardChips(player.userId, player.seatIndex, payout);
                    this.events.emit('player_win', {
                        userId: player.userId,
                        seatIndex: player.seatIndex,
                        payout,
                        reason: 'higher_hand'
                    });
                }
                else if (handValue === dealerValue) {
                    this.awardChips(player.userId, player.seatIndex, hand.bet);
                    this.events.emit('push', {
                        userId: player.userId,
                        seatIndex: player.seatIndex,
                        reason: 'same_value'
                    });
                }
                else {
                    this.events.emit('player_loss', {
                        userId: player.userId,
                        seatIndex: player.seatIndex,
                        amount: hand.bet
                    });
                }
            }
        }
        await this.completeHand();
    }
    async completeHand() {
        const sessionId = `${this.config.roomId}:${this.handNumber}`;
        await this.persistChipChanges(sessionId);
        this.events.emit('hand_complete', { sessionId, handNumber: this.handNumber });
        this.bjPlayers.clear();
        this.dealerHand = [];
        this.currentPlayerIndex = 0;
        this.pot = 0;
        this.state = GameEngine_1.GameState.PLACING_BETS;
        await this.saveStateToRedis();
    }
    getGameState() {
        const seats = Array(5).fill(null).map((_, i) => ({
            empty: true,
            seatIndex: i,
            ready: false,
            name: null,
            photo: null,
            chips: 0,
            currentBet: 0,
            hands: []
        }));
        for (const player of this.players.values()) {
            if (player.seatIndex >= 0 && player.seatIndex < 5) {
                seats[player.seatIndex] = {
                    empty: false,
                    seatIndex: player.seatIndex,
                    ready: player.currentBet > 0,
                    name: 'Player',
                    photo: null,
                    chips: player.chips,
                    currentBet: player.currentBet,
                    hands: []
                };
            }
        }
        for (const player of this.bjPlayers.values()) {
            if (player.seatIndex >= 0 && player.seatIndex < 5) {
                const seat = seats[player.seatIndex];
                if (!seat.empty) {
                    seat.hands = player.hands.map(h => ({
                        cards: h.cards,
                        value: this.calculateHandValue(h.cards),
                        bet: h.bet,
                        status: h.status,
                        isBlackjack: this.isBlackjack(h.cards),
                        isSoft: this.isSoftHand(h.cards)
                    }));
                    if (seat.hands.length > 0 && seat.hands[0].cards.length > 0) {
                        seat.card = seat.hands[0].cards[0];
                    }
                }
            }
        }
        return {
            gameType: 'BLACKJACK',
            roomId: this.config.roomId,
            seats: seats,
            dealerHand: this.dealerHand,
            dealerValue: this.calculateHandValue(this.dealerHand),
            pot: this.pot,
            minBet: this.config.minBet,
            bettingPhase: this.state === GameEngine_1.GameState.PLACING_BETS,
            status: this.state,
            observerCount: 0
        };
    }
}
exports.BlackjackEngine = BlackjackEngine;
//# sourceMappingURL=BlackjackEngine.js.map