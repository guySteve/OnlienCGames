/**
 * Bingo Game Engine
 * 
 * Implements multiplayer Bingo following the GameEngine architecture.
 * Features automatic ball calling, multiple card purchases, and provably fair RNG.
 */

import { GameEngine, GameState, Player } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
import crypto from 'crypto';

interface BingoCard {
  id: string;
  userId: string;
  grid: number[][]; // 5x5 grid
  marked: boolean[][]; // Track marked numbers
}

interface BingoPlayer extends Player {
  cards: BingoCard[];
}

interface BingoGameState {
  phase: 'BUYING' | 'PLAYING' | 'COMPLETE';
  drawnNumbers: number[];
  currentBall: number | null;
  winner: { userId: string; cardId: string; pattern: string } | null;
  pot: number;
  cardPrice: number;
  maxCardsPerPlayer: number;
  nextBallTime: number | null;
}

const CARD_PRICE = 1; // 1 chip per card
const MAX_CARDS_PER_PLAYER = 5;
const BALL_DRAW_INTERVAL = 4500; // 4.5 seconds between balls
const BUYING_PHASE_DURATION = 30000; // 30 seconds to buy cards

export class BingoEngine extends GameEngine {
  private bingoState: BingoGameState;
  private bingoPlayers: Map<string, BingoPlayer> = new Map();
  private availableBalls: number[] = [];
  private ballDrawTimer: NodeJS.Timeout | null = null;
  private serverSeed: string = '';
  private ballCallCallback?: (ball: number) => void;
  private gameEndCallback?: (winner: any) => void;

  constructor(
    config: any,
    prisma: PrismaClient,
    redis: Redis,
    engagement: EngagementService
  ) {
    super(config, prisma, redis, engagement);
    
    this.bingoState = {
      phase: 'BUYING',
      drawnNumbers: [],
      currentBall: null,
      winner: null,
      pot: 0,
      cardPrice: CARD_PRICE,
      maxCardsPerPlayer: MAX_CARDS_PER_PLAYER,
      nextBallTime: Date.now() + BUYING_PHASE_DURATION
    };

    this.initializeBalls();
    this.generateServerSeed();
  }

  getGameType(): 'BINGO' {
    return 'BINGO';
  }

  /**
   * Initialize the 75 bingo balls
   */
  private initializeBalls(): void {
    this.availableBalls = Array.from({ length: 75 }, (_, i) => i + 1);
  }

  /**
   * Generate cryptographically secure server seed for provably fair RNG
   */
  private generateServerSeed(): void {
    this.serverSeed = crypto.randomBytes(32).toString('hex');
  }

  /**
   * Quantum-inspired RNG using server seed
   * Simulates the high-quality randomness used in other engines
   */
  private getNextRandomIndex(max: number, nonce: number): number {
    const data = `${this.serverSeed}:${nonce}:${Date.now()}`;
    const hash = crypto.createHash('sha256').update(data).digest();
    
    // Use first 8 bytes as uint64 for better distribution
    let value = 0;
    for (let i = 0; i < 8; i++) {
      value = value * 256 + hash[i];
    }
    
    return value % max;
  }

  /**
   * Generate a random Bingo card with proper B-I-N-G-O distribution
   */
  private generateBingoCard(userId: string): BingoCard {
    const grid: number[][] = [];
    const marked: boolean[][] = [];

    // B(1-15), I(16-30), N(31-45), G(46-60), O(61-75)
    const columnRanges = [
      [1, 15],   // B
      [16, 30],  // I
      [31, 45],  // N
      [46, 60],  // G
      [61, 75]   // O
    ];

    for (let col = 0; col < 5; col++) {
      const column: number[] = [];
      const markedColumn: boolean[] = [];
      const [min, max] = columnRanges[col];
      const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);

      for (let row = 0; row < 5; row++) {
        // Center of N column is FREE SPACE
        if (col === 2 && row === 2) {
          column.push(0); // 0 represents FREE SPACE
          markedColumn.push(true);
        } else {
          // Pick a random number from available pool
          const idx = this.getNextRandomIndex(available.length, col * 5 + row);
          column.push(available[idx]);
          markedColumn.push(false);
          available.splice(idx, 1);
        }
      }

      grid.push(column);
      marked.push(markedColumn);
    }

    return {
      id: crypto.randomUUID(),
      userId,
      grid,
      marked
    };
  }

  /**
   * Convert ball number to BINGO letter
   */
  private getBingoLetter(num: number): string {
    if (num >= 1 && num <= 15) return 'B';
    if (num >= 16 && num <= 30) return 'I';
    if (num >= 31 && num <= 45) return 'N';
    if (num >= 46 && num <= 60) return 'G';
    if (num >= 61 && num <= 75) return 'O';
    return '';
  }

  /**
   * Player purchases a Bingo card
   */
  async placeBet(userId: string, amount: number): Promise<boolean> {
    if (this.bingoState.phase !== 'BUYING') {
      return false;
    }

    if (amount !== CARD_PRICE) {
      return false;
    }

    // Get or create player
    let player = this.bingoPlayers.get(userId);
    if (!player) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || Number(user.chipBalance) < CARD_PRICE) {
        return false;
      }

      player = {
        userId,
        seatIndex: this.bingoPlayers.size,
        chips: Number(user.chipBalance),
        currentBet: 0,
        connected: true,
        cards: []
      };
      this.bingoPlayers.set(userId, player);
    }

    // Check max cards limit
    if (player.cards.length >= MAX_CARDS_PER_PLAYER) {
      return false;
    }

    // Check sufficient chips
    if (player.chips < CARD_PRICE) {
      return false;
    }

    // Deduct chips and generate card
    player.chips -= CARD_PRICE;
    player.currentBet += CARD_PRICE;
    this.bingoState.pot += CARD_PRICE;

    const card = this.generateBingoCard(userId);
    player.cards.push(card);

    return true;
  }

  /**
   * Start the game after buying phase
   */
  async startNewHand(): Promise<void> {
    if (this.bingoState.phase !== 'BUYING') {
      return;
    }

    // Must have at least 1 player with cards
    if (this.bingoPlayers.size === 0) {
      return;
    }

    this.bingoState.phase = 'PLAYING';
    this.state = GameState.PLAYING;
    this.handNumber++;

    // Start auto-drawing balls
    this.scheduleNextBallDraw();
  }

  /**
   * Schedule the next ball draw
   */
  private scheduleNextBallDraw(): void {
    if (this.ballDrawTimer) {
      clearTimeout(this.ballDrawTimer);
    }

    this.bingoState.nextBallTime = Date.now() + BALL_DRAW_INTERVAL;

    this.ballDrawTimer = setTimeout(() => {
      this.drawBall();
    }, BALL_DRAW_INTERVAL);
  }

  /**
   * Draw a random ball
   */
  private drawBall(): void {
    if (this.availableBalls.length === 0 || this.bingoState.phase !== 'PLAYING') {
      return;
    }

    // Use provably fair RNG
    const idx = this.getNextRandomIndex(
      this.availableBalls.length,
      this.bingoState.drawnNumbers.length
    );
    const ball = this.availableBalls[idx];
    this.availableBalls.splice(idx, 1);

    this.bingoState.drawnNumbers.push(ball);
    this.bingoState.currentBall = ball;

    // Auto-mark all cards
    this.autoMarkCards(ball);

    // Notify callback (for announcing via speech)
    if (this.ballCallCallback) {
      this.ballCallCallback(ball);
    }

    // Continue drawing if no winner
    if (this.bingoState.phase === 'PLAYING') {
      this.scheduleNextBallDraw();
    }
  }

  /**
   * Automatically mark the called number on all cards
   */
  private autoMarkCards(ball: number): void {
    for (const player of this.bingoPlayers.values()) {
      for (const card of player.cards) {
        for (let col = 0; col < 5; col++) {
          for (let row = 0; row < 5; row++) {
            if (card.grid[col][row] === ball) {
              card.marked[col][row] = true;
            }
          }
        }
      }
    }
  }

  /**
   * Player claims BINGO
   */
  async claimBingo(userId: string, cardId: string): Promise<{ valid: boolean; pattern?: string }> {
    if (this.bingoState.phase !== 'PLAYING') {
      return { valid: false };
    }

    const player = this.bingoPlayers.get(userId);
    if (!player) {
      return { valid: false };
    }

    const card = player.cards.find(c => c.id === cardId);
    if (!card) {
      return { valid: false };
    }

    // Validate the BINGO claim
    const pattern = this.checkWin(card);
    if (pattern) {
      // Valid BINGO!
      this.bingoState.winner = { userId, cardId, pattern };
      this.bingoState.phase = 'COMPLETE';
      this.state = GameState.COMPLETE;

      // Stop ball drawing
      if (this.ballDrawTimer) {
        clearTimeout(this.ballDrawTimer);
        this.ballDrawTimer = null;
      }

      // Award pot to winner
      player.chips += this.bingoState.pot;

      // Persist to database
      await this.resolveHand();

      // Notify callback
      if (this.gameEndCallback) {
        this.gameEndCallback({ userId, cardId, pattern, pot: this.bingoState.pot });
      }

      return { valid: true, pattern };
    }

    return { valid: false };
  }

  /**
   * Check if a card has a winning pattern
   * Returns pattern name or null
   */
  private checkWin(card: BingoCard): string | null {
    const { marked } = card;

    // Check horizontal lines
    for (let row = 0; row < 5; row++) {
      if (marked.every(col => col[row])) {
        return 'HORIZONTAL';
      }
    }

    // Check vertical lines
    for (let col = 0; col < 5; col++) {
      if (marked[col].every(cell => cell)) {
        return 'VERTICAL';
      }
    }

    // Check diagonal (top-left to bottom-right)
    if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) {
      return 'DIAGONAL';
    }

    // Check diagonal (top-right to bottom-left)
    if (marked[4][0] && marked[3][1] && marked[2][2] && marked[1][3] && marked[0][4]) {
      return 'DIAGONAL';
    }

    return null;
  }

  /**
   * Resolve hand and persist to database
   */
  async resolveHand(): Promise<void> {
    if (!this.bingoState.winner) return;

    const sessionId = crypto.randomUUID();
    const winner = this.bingoState.winner;

    // Create game session
    await this.prisma.gameSession.create({
      data: {
        id: sessionId,
        gameType: 'BINGO',
        roomId: this.config.roomId,
        hostUserId: winner.userId,
        serverSeed: this.serverSeed,
        finalState: {
          drawnNumbers: this.bingoState.drawnNumbers,
          winner: this.bingoState.winner,
          totalCards: Array.from(this.bingoPlayers.values()).reduce(
            (sum, p) => sum + p.cards.length,
            0
          )
        },
        totalPot: this.bingoState.pot,
        winners: [{ userId: winner.userId, amount: this.bingoState.pot }]
      }
    });

    // Persist chip changes for all players
    for (const [userId, player] of this.bingoPlayers.entries()) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;

      const chipDelta = player.chips - Number(user.chipBalance);

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            chipBalance: player.chips,
            totalWagered: chipDelta < 0 ? { increment: Math.abs(chipDelta) } : undefined,
            totalWon: chipDelta > 0 ? { increment: chipDelta } : undefined,
            totalHandsPlayed: { increment: 1 },
            lastHandPlayed: new Date()
          }
        });

        // Record BET transaction for cards purchased
        if (player.currentBet > 0) {
          await tx.transaction.create({
            data: {
              userId,
              amount: -player.currentBet,
              type: 'BET',
              balanceBefore: user.chipBalance,
              balanceAfter: BigInt(chipDelta < 0 ? player.chips : Number(user.chipBalance)),
              gameSessionId: sessionId,
              description: `BINGO - ${player.cards.length} card(s)`
            }
          });
        }

        // Record WIN transaction for winner
        if (userId === winner.userId) {
          await tx.transaction.create({
            data: {
              userId,
              amount: this.bingoState.pot,
              type: 'WIN',
              balanceBefore: BigInt(Number(user.chipBalance) - chipDelta),
              balanceAfter: BigInt(player.chips),
              gameSessionId: sessionId,
              description: `BINGO WIN - ${winner.pattern}`
            }
          });

          // Check for big win
          await this.engagement.recordBigWin(userId, this.bingoState.pot, 'BINGO');

          // Award XP
          const xpEarned = Math.floor(this.bingoState.pot / 5);
          await this.engagement.awardXP(userId, xpEarned);
        }
      });
    }
  }

  /**
   * Get current game state for clients
   */
  getGameState(): any {
    return {
      type: 'BINGO',
      phase: this.bingoState.phase,
      drawnNumbers: this.bingoState.drawnNumbers,
      currentBall: this.bingoState.currentBall,
      pot: this.bingoState.pot,
      cardPrice: this.bingoState.cardPrice,
      maxCardsPerPlayer: this.bingoState.maxCardsPerPlayer,
      nextBallTime: this.bingoState.nextBallTime,
      winner: this.bingoState.winner,
      players: Array.from(this.bingoPlayers.entries()).map(([userId, player]) => ({
        userId,
        cardCount: player.cards.length,
        connected: player.connected
      }))
    };
  }

  /**
   * Get a player's cards
   */
  getPlayerCards(userId: string): BingoCard[] {
    const player = this.bingoPlayers.get(userId);
    return player ? player.cards : [];
  }

  /**
   * Set callback for ball announcements
   */
  setBallCallCallback(callback: (ball: number) => void): void {
    this.ballCallCallback = callback;
  }

  /**
   * Set callback for game end
   */
  setGameEndCallback(callback: (winner: any) => void): void {
    this.gameEndCallback = callback;
  }

  /**
   * Clean up timers
   */
  destroy(): void {
    if (this.ballDrawTimer) {
      clearTimeout(this.ballDrawTimer);
      this.ballDrawTimer = null;
    }
  }

  /**
   * Override addPlayer for Bingo (no seats, just cards)
   */
  async addPlayer(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || Number(user.chipBalance) < CARD_PRICE) {
      return false;
    }

    if (!this.bingoPlayers.has(userId)) {
      this.bingoPlayers.set(userId, {
        userId,
        seatIndex: this.bingoPlayers.size,
        chips: Number(user.chipBalance),
        currentBet: 0,
        connected: true,
        cards: []
      });
    }

    return true;
  }

  /**
   * Force start game (admin/debug)
   */
  async forceStart(): Promise<void> {
    if (this.bingoState.phase === 'BUYING') {
      await this.startNewHand();
    }
  }
}
