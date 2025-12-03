/**
 * War Game Engine
 * 
 * Implements the Casino War card game logic following the GameEngine architecture.
 * Supports multi-seat play where one player can occupy multiple seats.
 */

import { GameEngine, GameState, Player } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
import crypto from 'crypto';

interface Card {
  rank: string;
  value: number;
  suit: string;
}

interface Seat {
  empty: boolean;
  socketId?: string;
  name?: string;
  photo?: string;
  chips?: number;
  currentBet?: number;
  ready?: boolean;
  card?: Card;
  connected?: boolean;
}

interface WarGameState {
  roomId: string;
  seats: Seat[];
  houseCard: Card | null;
  pot: number;
  minBet: number;
  bettingPhase: boolean;
  status: string;
  observerCount: number;
  deck: Card[];
}

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
 * War Game Engine - Modular implementation
 */
export class WarEngine extends GameEngine {
  private seats: Seat[] = [];
  private houseCard: Card | null = null;
  private deck: Card[] = [];
  private bettingPhase: boolean = true;
  private observers: Set<string> = new Set();
  private gameSessionId: string | null = null;

  constructor(
    roomId: string,
    prisma: PrismaClient,
    redis: Redis,
    engagement: EngagementService
  ) {
    super(
      {
        roomId,
        minBet: WarEngine.getMinBet(),
        maxBet: 10000,
        maxPlayers: 5
      },
      prisma,
      redis,
      engagement
    );

    // Initialize 5 empty seats
    this.seats = Array(5).fill(null).map(() => ({ empty: true }));
    this.deck = this.createDeck();
  }

  getGameType(): 'WAR' | 'BLACKJACK' {
    return 'WAR';
  }

  // ==========================================================================
  // DECK MANAGEMENT
  // ==========================================================================

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank: rank.rank, value: rank.value, suit });
      }
    }
    return this.shuffleDeck(deck);
  }

  private shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private drawCard(): Card | null {
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
  public sitAtSeat(socketId: string, seatIndex: number, name: string, photo: string | null, chips: number): { success: boolean; error?: string } {
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
      photo,
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
  public leaveSeat(socketId: string, seatIndex?: number): { success: boolean; seatIndex?: number } {
    if (seatIndex !== null && seatIndex !== undefined) {
      // Leave specific seat
      if (this.seats[seatIndex] && this.seats[seatIndex].socketId === socketId) {
        this.seats[seatIndex] = { empty: true };
        return { success: true, seatIndex };
      }
    } else {
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

  async placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean> {
    if (!this.bettingPhase) return false;
    if (!this.validateBet(amount)) return false;

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
   */
  public allSeatedReady(): boolean {
    const seatedPlayers = this.seats.filter(s => !s.empty);
    if (seatedPlayers.length === 0) return false;
    return seatedPlayers.every(s => s.ready);
  }

  // ==========================================================================
  // GAME FLOW
  // ==========================================================================

  async startNewHand(): Promise<void> {
    if (!this.bettingPhase) return;

    this.bettingPhase = false;
    this.handNumber++;
    this.state = GameState.DEALING;

    // Deal cards to all seated and ready players
    for (const seat of this.seats) {
      if (!seat.empty && seat.ready) {
        seat.card = this.drawCard();
      }
    }

    // Deal house card
    this.houseCard = this.drawCard();

    this.state = GameState.RESOLVING;
    await this.saveStateToRedis();
  }

  async resolveHand(): Promise<any> {
    if (!this.houseCard) return null;

    const houseValue = this.houseCard.value;
    const results: any = { winners: [], pot: this.pot, type: 'win' };

    // Compare each player's card to house
    const playerCards = this.seats
      .map((seat, index) => ({ seat, index, card: seat.card }))
      .filter(p => p.card !== undefined);

    if (playerCards.length === 0) {
      return null;
    }

    // Find highest player card
    const maxPlayerValue = Math.max(...playerCards.map(p => p.card!.value));

    if (maxPlayerValue > houseValue) {
      // Players win
      const winners = playerCards.filter(p => p.card!.value === maxPlayerValue);
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
    } else if (maxPlayerValue === houseValue) {
      // Tie - split pot
      const tiedPlayers = playerCards.filter(p => p.card!.value === maxPlayerValue);
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
    } else {
      // House wins
      results.winners.push({ name: 'House', isHouse: true });
    }

    this.state = GameState.COMPLETE;
    await this.saveStateToRedis();

    return results;
  }

  /**
   * Reset for next round
   */
  public async resetForNextRound(): Promise<void> {
    this.pot = 0;
    this.houseCard = null;
    this.bettingPhase = true;
    this.state = GameState.PLACING_BETS;

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

  getGameState(): WarGameState {
    return {
      roomId: this.config.roomId,
      seats: this.seats,
      houseCard: this.houseCard,
      pot: this.pot,
      minBet: this.config.minBet,
      bettingPhase: this.bettingPhase,
      status: this.getStatusMessage(),
      observerCount: this.observers.size,
      deck: [] // Don't expose deck
    };
  }

  private getStatusMessage(): string {
    if (this.bettingPhase) {
      return 'Place your bets!';
    }
    if (this.state === GameState.DEALING) {
      return 'Dealing cards...';
    }
    if (this.state === GameState.RESOLVING) {
      return 'Revealing cards...';
    }
    return '';
  }

  public addObserver(socketId: string): void {
    this.observers.add(socketId);
  }

  public removeObserver(socketId: string): void {
    this.observers.delete(socketId);
  }

  public getSeatedCount(): number {
    return this.seats.filter(s => !s.empty).length;
  }

  public getPlayerBySeat(seatIndex: number): Seat | null {
    if (seatIndex < 0 || seatIndex >= 5) return null;
    return this.seats[seatIndex].empty ? null : this.seats[seatIndex];
  }

  public getPlayerBySocket(socketId: string): { seat: Seat; seatIndex: number } | null {
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

  static getMinBet(): number {
    const hour = new Date().getHours();
    return hour >= 20 ? 50 : 10; // High Stakes Night after 8 PM
  }
}
