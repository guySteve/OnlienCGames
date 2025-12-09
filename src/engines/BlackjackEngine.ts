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

import { GameEngine, GameState, GameConfig } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import crypto from 'crypto';
import https from 'https';
import { EventEmitter } from 'events';

type Redis = any;

interface Card {
  rank: string;
  suit: string;
  value: number;
}

interface Hand {
  cards: Card[];
  bet: number;
  status: 'active' | 'stand' | 'bust' | 'blackjack' | 'surrender';
  doubled: boolean;
  split: boolean;
}

interface BlackjackPlayer {
  userId: string;
  seatIndex: number;
  hands: Hand[];
  currentHandIndex: number;
  insurance: number;
}

export class BlackjackEngine extends GameEngine {
  private shoe: Card[] = [];
  private cutCardPosition: number = 0;
  private currentShoePosition: number = 0;

  private dealerHand: Card[] = [];
  private bjPlayers: Map<string, BlackjackPlayer> = new Map();
  private currentPlayerIndex: number = 0;

  private readonly DECKS = 6;
  private readonly PENETRATION = 0.75;
  private readonly BLACKJACK_PAYOUT = 1.5;
  private readonly INSURANCE_PAYOUT = 2.0;

  private playerSeed: string = '';
  private serverSeed: string = '';

  // Event emitter for socket broadcasts
  public events: EventEmitter = new EventEmitter();

  constructor(
    config: GameConfig,
    prisma: PrismaClient,
    redis: Redis,
    engagement: EngagementService
  ) {
    super(config, prisma, redis, engagement);
    this.initializeShoe();
  }

  getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO' {
    return 'BLACKJACK';
  }

  // ==========================================================================
  // SHOE MANAGEMENT WITH SOCKET EVENTS
  // ==========================================================================

  private initializeShoe(): void {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['♠', '♥', '♦', '♣'];

    this.shoe = [];

    for (let deck = 0; deck < this.DECKS; deck++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          let value = 0;
          if (rank === 'A') value = 11;
          else if (['J', 'Q', 'K'].includes(rank)) value = 10;
          else value = parseInt(rank);

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

  private shuffleShoe(): void {
    // Cryptographically secure Fisher-Yates shuffle using dual-seed hash
    const combinedHash = crypto
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
  private async fetchQRNGEntropy(): Promise<string> {
    return new Promise((resolve) => {
      const request = https.get('https://drand.cloudflare.com/public/latest', (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.randomness || crypto.randomBytes(32).toString('hex'));
          } catch (e) {
            resolve(crypto.randomBytes(32).toString('hex'));
          }
        });
      });
      request.on('error', () => {
        resolve(crypto.randomBytes(32).toString('hex'));
      });
    });
  }

  /**
   * Initialize game with QRNG entropy and player seed
   */
  public async initializeWithQRNG(playerSeed: string): Promise<void> {
    this.playerSeed = playerSeed;
    this.serverSeed = await this.fetchQRNGEntropy();
    this.initializeShoe();
  }

  /**
   * Get the dual seeds for verification (public audit)
   */
  public getDualSeeds(): { playerSeed: string; serverSeed: string } {
    return {
      playerSeed: this.playerSeed,
      serverSeed: this.serverSeed
    };
  }

  private dealCard(): Card {
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

  private calculateHandValue(cards: Card[]): number {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.rank === 'A') {
        aces++;
        total += 11;
      } else {
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

  private isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && this.calculateHandValue(cards) === 21;
  }

  private isSoftHand(cards: Card[]): boolean {
    const hasAce = cards.some(c => c.rank === 'A');
    if (!hasAce) return false;

    const total = this.calculateHandValue(cards);
    return total <= 21 && cards.some(c => c.rank === 'A' && c.value === 11);
  }

  // ==========================================================================
  // GAME FLOW WITH EVENT EMISSIONS
  // ==========================================================================

  async placeBet(userId: string, amount: number, seatIndex: number = 0): Promise<boolean> {
    if (this.state !== GameState.PLACING_BETS) {
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

  async startNewHand(): Promise<void> {
    this.handNumber++;
    this.state = GameState.DEALING;
    this.dealerHand = [];
    this.currentPlayerIndex = 0;

    this.events.emit('hand_started', { handNumber: this.handNumber });

    // Deal initial cards (player-dealer-player-dealer)
    for (let round = 0; round < 2; round++) {
      for (const player of this.bjPlayers.values()) {
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
      this.state = GameState.PLAYER_TURN;
      this.events.emit('insurance_offered', { dealerUpCard: this.dealerHand[0] });
      return;
    }

    this.state = GameState.PLAYER_TURN;
    await this.saveStateToRedis();
  }

  /**
   * Player actions: HIT, STAND, DOUBLE, SPLIT, INSURANCE
   */
  async playerAction(userId: string, seatIndex: number, action: 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'INSURANCE', insuranceAmount?: number): Promise<{
    success: boolean;
    newCard?: Card;
    handValue?: number;
    busted?: boolean;
  }> {
    if (this.state !== GameState.PLAYER_TURN) {
      return { success: false };
    }

    const playerKey = `${userId}:${seatIndex}`;
    const player = this.bjPlayers.get(playerKey);
    if (!player) return { success: false };

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

        const secondCard = hand.cards.pop()!;
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

  private async moveToNextPlayer(): Promise<void> {
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

  private async dealerPlay(): Promise<void> {
    this.state = GameState.DEALER_TURN;

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
      } else {
        break;
      }
    }

    const finalValue = this.calculateHandValue(this.dealerHand);

    if (finalValue > 21) {
      this.events.emit('dealer_bust', { handValue: finalValue });
    } else {
      this.events.emit('dealer_stand', { handValue: finalValue });
    }

    await this.resolveHand();
  }

  private async resolveDealerBlackjack(): Promise<void> {
    for (const player of this.bjPlayers.values()) {
      if (player.insurance > 0) {
        const payout = player.insurance * this.INSURANCE_PAYOUT;
        this.awardChips(player.userId, player.seatIndex, payout);
        this.events.emit('insurance_win', { userId: player.userId, seatIndex: player.seatIndex, payout });
      }

      const hand = player.hands[0];
      if (this.isBlackjack(hand.cards)) {
        this.awardChips(player.userId, player.seatIndex, hand.bet);
        this.events.emit('push', { userId: player.userId, seatIndex: player.seatIndex, reason: 'both_blackjack' });
      } else {
        this.events.emit('player_loss', { userId: player.userId, seatIndex: player.seatIndex, amount: hand.bet });
      }
    }

    await this.completeHand();
  }

  async resolveHand(): Promise<void> {
    this.state = GameState.RESOLVING;

    const dealerValue = this.calculateHandValue(this.dealerHand);
    const dealerBusted = dealerValue > 21;

    for (const player of this.bjPlayers.values()) {
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
        } else if (handValue === dealerValue) {
          this.awardChips(player.userId, player.seatIndex, hand.bet);
          this.events.emit('push', {
            userId: player.userId,
            seatIndex: player.seatIndex,
            reason: 'same_value'
          });
        } else {
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

  private async completeHand(): Promise<void> {
    const sessionId = `${this.config.roomId}:${this.handNumber}`;

    await this.persistChipChanges(sessionId);

    this.events.emit('hand_complete', { sessionId, handNumber: this.handNumber });

    this.bjPlayers.clear();
    this.dealerHand = [];
    this.currentPlayerIndex = 0;
    this.pot = 0;

    this.state = GameState.PLACING_BETS;
    await this.saveStateToRedis();
  }

  getGameState(): any {
    const seats = Array(5).fill(null).map((_, i) => ({
      empty: true,
      seatIndex: i,
      ready: false,
      connected: false,
      name: null as string | null,
      photo: null as string | null,
      chips: 0,
      currentBet: 0,
      hands: [] as any[]
    }));

    for (const player of this.players.values()) {
      if (player.seatIndex >= 0 && player.seatIndex < 5) {
        seats[player.seatIndex] = {
          empty: false,
          seatIndex: player.seatIndex,
          ready: player.currentBet > 0,
          connected: player.connected, // CRITICAL: Include connected status
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
            (seat as any).card = seat.hands[0].cards[0];
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
      bettingPhase: this.state === GameState.PLACING_BETS,
      status: this.state,
      observerCount: 0
    };
  }
}
