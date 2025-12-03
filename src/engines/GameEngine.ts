/**
 * Abstract Game Engine Base Class
 * 
 * All game implementations (War, Blackjack) extend this to ensure
 * consistent state management and hook into engagement mechanics
 */

import { PrismaClient } from '@prisma/client';
// import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';

// Use any for Redis to support both node-redis and upstash/redis without strict type dependency
type Redis = any;

export enum GameState {
  WAITING = 'WAITING',
  PLACING_BETS = 'PLACING_BETS',
  DEALING = 'DEALING',
  PLAYING = 'PLAYING',
  PLAYER_TURN = 'PLAYER_TURN',
  DEALER_TURN = 'DEALER_TURN',
  RESOLVING = 'RESOLVING',
  COMPLETE = 'COMPLETE'
}

export interface Player {
  userId: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  connected: boolean;
}

export interface GameConfig {
  roomId: string;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
}

/**
 * Base class for all casino games
 */
export abstract class GameEngine {
  protected state: GameState = GameState.WAITING;
  protected players: Map<string, Player> = new Map();
  protected pot: number = 0;
  protected handNumber: number = 0;
  
  constructor(
    protected config: GameConfig,
    protected prisma: PrismaClient,
    protected redis: Redis,
    protected engagement: EngagementService
  ) {}

  // ==========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ==========================================================================

  abstract getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO';
  abstract startNewHand(): Promise<void>;
  abstract placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean>;
  abstract resolveHand(): Promise<void>;
  abstract getGameState(): any;

  // ==========================================================================
  // COMMON METHODS - Shared across all games
  // ==========================================================================

  /**
   * Add player to game
   */
  async addPlayer(userId: string, seatIndex: number): Promise<boolean> {
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
  removePlayer(userId: string, seatIndex: number): void {
    this.players.delete(`${userId}:${seatIndex}`);
  }

  /**
   * Validate bet amount
   */
  protected validateBet(amount: number): boolean {
    return amount >= this.config.minBet && amount <= this.config.maxBet;
  }

  /**
   * Deduct chips from player (in-game state)
   * Persists to database at end of hand
   */
  protected async deductChips(userId: string, seatIndex: number, amount: number): Promise<boolean> {
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
  protected awardChips(userId: string, seatIndex: number, amount: number): void {
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
  protected async persistChipChanges(sessionId: string): Promise<void> {
    for (const [key, player] of this.players.entries()) {
      const user = await this.prisma.user.findUnique({ where: { id: player.userId } });
      if (!user) continue;

      const chipDelta = player.chips - Number(user.chipBalance);
      
      if (chipDelta !== 0) {
        await this.prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({
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
          await this.redis.publish(
            `room:${this.config.roomId}:mystery-drop`,
            JSON.stringify({ userId: player.userId, amount: drop.amount })
          );
        }
      }
    }
  }

  /**
   * Save game state to Redis (hot storage)
   */
  protected async saveStateToRedis(): Promise<void> {
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

    await this.redis.setex(
      `game:${this.config.roomId}:state`,
      3600, // 1 hour TTL
      JSON.stringify(state)
    );
  }

  /**
   * Restore game state from Redis (for crash recovery)
   */
  protected async restoreStateFromRedis(): Promise<boolean> {
    const stored = await this.redis.get(`game:${this.config.roomId}:state`);
    if (!stored) return false;

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
  getPot(): number {
    return this.pot;
  }

  /**
   * Get all players
   */
  getPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Mark player as disconnected
   */
  setPlayerDisconnected(userId: string, seatIndex: number): void {
    const key = `${userId}:${seatIndex}`;
    const player = this.players.get(key);
    if (player) {
      player.connected = false;
    }
  }
}
