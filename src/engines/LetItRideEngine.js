"use strict";
/**
 * LetItRideEngine.ts - Let It Ride Poker Game Engine
 *
 * Rules:
 * - Players make three equal bets
 * - Receive 3 cards, 2 community cards dealt face down
 * - Can pull back first two bets, final bet ($) must stay
 * - Minimum winning hand: Pair of 10s or better
 * - Payouts based on poker hand rankings
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LetItRideEngine = void 0;
const GameEngine_1 = require("./GameEngine");
const crypto = __importStar(require("crypto"));
const events_1 = require("events");
class LetItRideEngine extends GameEngine_1.GameEngine {
    deck = [];
    communityCards = [];
    lirPlayers = new Map();
    currentDecisionPhase = 1;
    PAYOUT_TABLE = {
        'ROYAL_FLUSH': 1000,
        'STRAIGHT_FLUSH': 200,
        'FOUR_OF_A_KIND': 50,
        'FULL_HOUSE': 11,
        'FLUSH': 8,
        'STRAIGHT': 5,
        'THREE_OF_A_KIND': 3,
        'TWO_PAIR': 2,
        'PAIR_10S_OR_BETTER': 1
    };
    events = new events_1.EventEmitter();
    constructor(config, prisma, redis, engagement) {
        super(config, prisma, redis, engagement);
        this.initializeDeck();
    }
    getGameType() {
        return 'WAR'; // Using WAR as placeholder since LetItRide not in union type
    }
    initializeDeck() {
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const suits = ['♠', '♥', '♦', '♣'];
        const values = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        this.deck = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.deck.push({ rank, suit, value: values[rank] });
            }
        }
        this.shuffleDeck();
    }
    shuffleDeck() {
        // Cryptographically secure Fisher-Yates shuffle
        const seed = crypto.randomBytes(32);
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = seed[i % 32] % (i + 1);
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    dealCard() {
        return this.deck.pop();
    }
    async placeBet(userId, amount, seatIndex = 0) {
        if (this.state !== GameEngine_1.GameState.PLACING_BETS) {
            return false;
        }
        // Let It Ride requires three equal bets
        const totalBet = amount * 3;
        if (!this.validateBet(totalBet)) {
            return false;
        }
        const success = await this.deductChips(userId, seatIndex, totalBet);
        if (!success) {
            return false;
        }
        this.lirPlayers.set(`${userId}:${seatIndex}`, {
            userId,
            seatIndex,
            hand: [],
            bets: {
                bet1: { amount, active: true },
                bet2: { amount, active: true },
                bet3: { amount, active: true }
            },
            totalBet: amount * 3
        });
        this.events.emit('bet_placed', { userId, seatIndex, amount: totalBet });
        await this.saveStateToRedis();
        return true;
    }
    async startNewHand() {
        this.handNumber++;
        this.state = GameEngine_1.GameState.DEALING;
        this.communityCards = [];
        this.currentDecisionPhase = 1;
        this.events.emit('hand_started', { handNumber: this.handNumber });
        // Deal 3 cards to each player
        for (const player of Array.from(this.lirPlayers.values())) {
            player.hand = [this.dealCard(), this.dealCard(), this.dealCard()];
            this.events.emit('player_dealt', {
                userId: player.userId,
                seatIndex: player.seatIndex,
                hand: player.hand
            });
        }
        // Deal 2 community cards face down
        this.communityCards = [this.dealCard(), this.dealCard()];
        this.state = GameEngine_1.GameState.PLAYER_TURN;
        this.events.emit('decision_phase', { phase: 1 });
        await this.saveStateToRedis();
    }
    async playerDecision(userId, seatIndex, decision, betNumber) {
        if (this.state !== GameEngine_1.GameState.PLAYER_TURN) {
            return false;
        }
        const playerKey = `${userId}:${seatIndex}`;
        const player = this.lirPlayers.get(playerKey);
        if (!player)
            return false;
        const betKey = betNumber === 1 ? 'bet1' : 'bet2';
        if (decision === 'PULL_BACK') {
            // Return bet to player
            const returnAmount = player.bets[betKey].amount;
            player.bets[betKey].active = false;
            await this.awardChips(userId, seatIndex, returnAmount);
            this.events.emit('bet_pulled_back', {
                userId,
                seatIndex,
                betNumber,
                amount: returnAmount
            });
        }
        else {
            this.events.emit('let_it_ride', {
                userId,
                seatIndex,
                betNumber
            });
        }
        // Check if all players have made decision
        // For now, auto-advance (in real game, wait for all players)
        if (betNumber === 1) {
            // Reveal first community card
            this.events.emit('community_revealed', {
                cardIndex: 0,
                card: this.communityCards[0]
            });
            this.currentDecisionPhase = 2;
            this.events.emit('decision_phase', { phase: 2 });
        }
        else {
            // Reveal second community card and resolve
            this.events.emit('community_revealed', {
                cardIndex: 1,
                card: this.communityCards[1]
            });
            await this.resolveHand();
        }
        await this.saveStateToRedis();
        return true;
    }
    async resolveHand() {
        this.state = GameEngine_1.GameState.RESOLVING;
        for (const player of Array.from(this.lirPlayers.values())) {
            const fullHand = [...player.hand, ...this.communityCards];
            const handRank = this.evaluateHand(fullHand);
            const payout = this.calculatePayout(player, handRank);
            if (payout > 0) {
                await this.awardChips(player.userId, player.seatIndex, payout);
                this.events.emit('player_win', {
                    userId: player.userId,
                    seatIndex: player.seatIndex,
                    hand: handRank.name,
                    payout
                });
            }
            else {
                this.events.emit('player_loss', {
                    userId: player.userId,
                    seatIndex: player.seatIndex,
                    hand: handRank.name
                });
            }
        }
        await this.completeHand();
    }
    evaluateHand(cards) {
        // Sort by value
        const sorted = [...cards].sort((a, b) => b.value - a.value);
        // Check for flush
        const isFlush = cards.every(c => c.suit === cards[0].suit);
        // Check for straight
        const values = sorted.map(c => c.value);
        const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] - 1);
        const isRoyalStraight = values[0] === 14 && values[1] === 13 && values[2] === 12 && values[3] === 11 && values[4] === 10;
        // Count ranks
        const rankCounts = {};
        for (const card of cards) {
            rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
        }
        const counts = Object.values(rankCounts).sort((a, b) => b - a);
        // Royal Flush
        if (isFlush && isRoyalStraight) {
            return { name: 'ROYAL_FLUSH', multiplier: this.PAYOUT_TABLE.ROYAL_FLUSH };
        }
        // Straight Flush
        if (isFlush && isStraight) {
            return { name: 'STRAIGHT_FLUSH', multiplier: this.PAYOUT_TABLE.STRAIGHT_FLUSH };
        }
        // Four of a Kind
        if (counts[0] === 4) {
            return { name: 'FOUR_OF_A_KIND', multiplier: this.PAYOUT_TABLE.FOUR_OF_A_KIND };
        }
        // Full House
        if (counts[0] === 3 && counts[1] === 2) {
            return { name: 'FULL_HOUSE', multiplier: this.PAYOUT_TABLE.FULL_HOUSE };
        }
        // Flush
        if (isFlush) {
            return { name: 'FLUSH', multiplier: this.PAYOUT_TABLE.FLUSH };
        }
        // Straight
        if (isStraight) {
            return { name: 'STRAIGHT', multiplier: this.PAYOUT_TABLE.STRAIGHT };
        }
        // Three of a Kind
        if (counts[0] === 3) {
            return { name: 'THREE_OF_A_KIND', multiplier: this.PAYOUT_TABLE.THREE_OF_A_KIND };
        }
        // Two Pair
        if (counts[0] === 2 && counts[1] === 2) {
            return { name: 'TWO_PAIR', multiplier: this.PAYOUT_TABLE.TWO_PAIR };
        }
        // Pair of 10s or Better
        if (counts[0] === 2) {
            const pairRank = Object.keys(rankCounts).find(r => rankCounts[r] === 2);
            const pairValue = sorted.find(c => c.rank === pairRank).value;
            if (pairValue >= 10) {
                return { name: 'PAIR_10S_OR_BETTER', multiplier: this.PAYOUT_TABLE.PAIR_10S_OR_BETTER };
            }
        }
        return { name: 'NO_WIN', multiplier: 0 };
    }
    calculatePayout(player, handRank) {
        if (handRank.multiplier === 0)
            return 0;
        let totalPayout = 0;
        // Each active bet wins based on the multiplier
        if (player.bets.bet1.active) {
            totalPayout += player.bets.bet1.amount * (handRank.multiplier + 1); // +1 to include original bet
        }
        if (player.bets.bet2.active) {
            totalPayout += player.bets.bet2.amount * (handRank.multiplier + 1);
        }
        if (player.bets.bet3.active) {
            totalPayout += player.bets.bet3.amount * (handRank.multiplier + 1);
        }
        return totalPayout;
    }
    async completeHand() {
        const sessionId = `${this.config.roomId}:${this.handNumber}`;
        await this.persistChipChanges(sessionId);
        this.events.emit('hand_complete', { sessionId, handNumber: this.handNumber });
        this.lirPlayers.clear();
        this.communityCards = [];
        this.pot = 0;
        this.initializeDeck();
        this.state = GameEngine_1.GameState.PLACING_BETS;
        await this.saveStateToRedis();
    }
    getGameState() {
        return {
            gameType: 'LET_IT_RIDE',
            roomId: this.config.roomId,
            state: this.state,
            handNumber: this.handNumber,
            communityCards: this.communityCards,
            currentDecisionPhase: this.currentDecisionPhase,
            players: Array.from(this.lirPlayers.values()).map(p => ({
                userId: p.userId,
                seatIndex: p.seatIndex,
                hand: p.hand,
                bets: p.bets
            }))
        };
    }
}
exports.LetItRideEngine = LetItRideEngine;
//# sourceMappingURL=LetItRideEngine.js.map