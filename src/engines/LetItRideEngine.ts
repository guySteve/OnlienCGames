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

import { GameEngine, GameState, GameConfig } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

type Redis = any;

interface Card {
  rank: string;
  suit: string;
  value: number;
}

interface LetItRidePlayer {
  userId: string;
  seatIndex: number;
  hand: Card[];
  bets: {
    bet1: { amount: number; active: boolean };
    bet2: { amount: number; active: boolean };
    bet3: { amount: number; active: boolean };
  };
  totalBet: number;
}

export class LetItRideEngine extends GameEngine {
  private deck: Card[] = [];
  private communityCards: Card[] = [];
  private lirPlayers: Map<string, LetItRidePlayer> = new Map();
  private currentDecisionPhase: 1 | 2 | 3 = 1;

  private readonly PAYOUT_TABLE = {
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

  public events: EventEmitter = new EventEmitter();

  constructor(
    config: GameConfig,
    prisma: PrismaClient,
    redis: Redis,
    engagement: EngagementService
  ) {
    super(config, prisma, redis, engagement);
    this.initializeDeck();
  }

  getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO' | 'LET_IT_RIDE' {
    return 'LET_IT_RIDE';
  }

  private initializeDeck(): void {
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const suits = ['♠', '♥', '♦', '♣'];
    const values: Record<string, number> = {
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

  private shuffleDeck(): void {
    // Cryptographically secure Fisher-Yates shuffle
    const seed = crypto.randomBytes(32);
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = seed[i % 32] % (i + 1);
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  private dealCard(): Card {
    return this.deck.pop()!;
  }

  async placeBet(userId: string, amount: number, seatIndex: number = 0): Promise<boolean> {
    if (this.state !== GameState.PLACING_BETS) {
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

  async startNewHand(): Promise<void> {
    this.handNumber++;
    this.state = GameState.DEALING;
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

    this.state = GameState.PLAYER_TURN;
    this.events.emit('decision_phase', { phase: 1 });
    await this.saveStateToRedis();
  }

  async playerDecision(
    userId: string,
    seatIndex: number,
    decision: 'PULL_BACK' | 'LET_IT_RIDE',
    betNumber: 1 | 2
  ): Promise<boolean> {
    if (this.state !== GameState.PLAYER_TURN) {
      return false;
    }

    const playerKey = `${userId}:${seatIndex}`;
    const player = this.lirPlayers.get(playerKey);
    if (!player) return false;

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
    } else {
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
    } else {
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

  async resolveHand(): Promise<void> {
    this.state = GameState.RESOLVING;

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
      } else {
        this.events.emit('player_loss', {
          userId: player.userId,
          seatIndex: player.seatIndex,
          hand: handRank.name
        });
      }
    }

    await this.completeHand();
  }

  private evaluateHand(cards: Card[]): { name: string; multiplier: number } {
    // Sort by value
    const sorted = [...cards].sort((a, b) => b.value - a.value);

    // Check for flush
    const isFlush = cards.every(c => c.suit === cards[0].suit);

    // Check for straight
    const values = sorted.map(c => c.value);
    const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] - 1);
    const isRoyalStraight = values[0] === 14 && values[1] === 13 && values[2] === 12 && values[3] === 11 && values[4] === 10;

    // Count ranks
    const rankCounts: Record<string, number> = {};
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
      const pairRank = Object.keys(rankCounts).find(r => rankCounts[r] === 2)!;
      const pairValue = sorted.find(c => c.rank === pairRank)!.value;
      if (pairValue >= 10) {
        return { name: 'PAIR_10S_OR_BETTER', multiplier: this.PAYOUT_TABLE.PAIR_10S_OR_BETTER };
      }
    }

    return { name: 'NO_WIN', multiplier: 0 };
  }

  private calculatePayout(player: LetItRidePlayer, handRank: { name: string; multiplier: number }): number {
    if (handRank.multiplier === 0) return 0;

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

  private async completeHand(): Promise<void> {
    const sessionId = `${this.config.roomId}:${this.handNumber}`;
    await this.persistChipChanges(sessionId);

    this.events.emit('hand_complete', { sessionId, handNumber: this.handNumber });

    this.lirPlayers.clear();
    this.communityCards = [];
    this.pot = 0;
    this.initializeDeck();

    this.state = GameState.PLACING_BETS;
    await this.saveStateToRedis();
  }

  getGameState(): any {
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
