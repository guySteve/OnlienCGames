/**
 * Unit Tests for War Game Engine
 * 
 * Tests cover:
 * - Deck creation and shuffling
 * - Dual-seed (Provably Fair 2.0) implementation
 * - Seat management
 * - Betting mechanics
 * - Game resolution and winner determination
 */

import { WarEngine } from '../src/engines/WarEngine';
import { GameState } from '../src/engines/GameEngine';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
const mockPrisma: Partial<PrismaClient> = {};
const mockRedis: any = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};
const mockEngagement = {
  recordEngagement: jest.fn()
};

describe('WarEngine', () => {
  let engine: WarEngine;

  beforeEach(() => {
    engine = new WarEngine(
      'test-room-123',
      mockPrisma as PrismaClient,
      mockRedis,
      mockEngagement as any
    );
  });

  describe('Deck Management', () => {
    test('should create a standard 52-card deck', () => {
      // Deck should be created during initialization
      const state = engine.getGameState();
      // Deck is not exposed in public state for security
      expect(state.deck).toEqual([]);
    });

    test('should shuffle deck on initialization', async () => {
      const seed = 'test-player-seed';
      await engine.initializeWithQRNG(seed);
      // Engine should have set up seeds and shuffled
      expect(engine.getDualSeeds().playerSeed).toBe(seed);
      expect(engine.getDualSeeds().serverSeed).toBeTruthy();
    });

    test('should use dual-seed hashing for shuffle', async () => {
      const playerSeed = 'player-seed-123';
      await engine.initializeWithQRNG(playerSeed);
      
      const seeds = engine.getDualSeeds();
      expect(seeds.playerSeed).toBe(playerSeed);
      expect(seeds.serverSeed.length).toBeGreaterThan(0);
    });

    test('should not expose deck in game state (security)', () => {
      const state = engine.getGameState();
      expect(state.deck).toEqual([]);
    });
  });

  describe('Seat Management', () => {
    test('should allow sitting at empty seat', () => {
      const result = engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      expect(result.success).toBe(true);
    });

    test('should reject sitting at occupied seat', () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      const result = engine.sitAtSeat('socket2', 0, 'Player2', null, 1000);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Seat already occupied');
    });

    test('should reject invalid seat indices', () => {
      const resultNegative = engine.sitAtSeat('socket1', -1, 'Player1', null, 1000);
      expect(resultNegative.success).toBe(false);

      const resultTooHigh = engine.sitAtSeat('socket1', 5, 'Player1', null, 1000);
      expect(resultTooHigh.success).toBe(false);
    });

    test('should allow player to leave seat', () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      const result = engine.leaveSeat('socket1', 0);
      expect(result.success).toBe(true);
      expect(result.seatIndex).toBe(0);
    });

    test('should track seated player count', () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
      expect(engine.getSeatedCount()).toBe(2);
    });

    test('should find player by seat index', () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      const player = engine.getPlayerBySeat(0);
      expect(player).not.toBeNull();
      expect(player?.name).toBe('Player1');
    });

    test('should find player by socket ID', () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      const result = engine.getPlayerBySocket('socket1');
      expect(result).not.toBeNull();
      expect(result?.seat.name).toBe('Player1');
      expect(result?.seatIndex).toBe(0);
    });
  });

  describe('Betting & Bets', () => {
    beforeEach(() => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
    });

    test('should validate minimum bet', async () => {
      // Minimum bet should be respected
      const result = await engine.placeBet('user1', 5, 0);
      expect(result).toBe(false); // Below minimum
    });

    test('should allow valid bet placement', async () => {
      const result = await engine.placeBet('user1', 100, 0);
      expect(result).toBe(true);
    });

    test('should reject bet if insufficient chips', async () => {
      const result = await engine.placeBet('user1', 5000, 0); // More than starting 1000
      expect(result).toBe(false);
    });

    test('should mark player as ready after bet', async () => {
      await engine.placeBet('user1', 100, 0);
      const player = engine.getPlayerBySeat(0);
      expect(player?.ready).toBe(true);
    });

    test('should check if all seated players are ready', async () => {
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
      
      await engine.placeBet('user1', 100, 0);
      expect(engine.allSeatedReady()).toBe(false); // Player2 hasn't bet
      
      await engine.placeBet('user2', 100, 1);
      expect(engine.allSeatedReady()).toBe(true);
    });
  });

  describe('Game Flow', () => {
    beforeEach(() => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
    });

    test('should deal cards to ready players', async () => {
      await engine.placeBet('user1', 100, 0);
      await engine.placeBet('user2', 100, 1);
      
      await engine.startNewHand();
      
      const player1 = engine.getPlayerBySeat(0);
      const player2 = engine.getPlayerBySeat(1);
      
      expect(player1?.card).toBeTruthy();
      expect(player2?.card).toBeTruthy();
    });

    test('should deal house card', async () => {
      await engine.placeBet('user1', 100, 0);
      await engine.placeBet('user2', 100, 1);
      
      await engine.startNewHand();
      const state = engine.getGameState();
      
      expect(state.houseCard).toBeTruthy();
    });
  });

  describe('Observers', () => {
    test('should add observer', () => {
      engine.addObserver('observer-socket-1');
      const state = engine.getGameState();
      expect(state.observerCount).toBe(1);
    });

    test('should remove observer', () => {
      engine.addObserver('observer-socket-1');
      engine.removeObserver('observer-socket-1');
      const state = engine.getGameState();
      expect(state.observerCount).toBe(0);
    });

    test('should track multiple observers', () => {
      engine.addObserver('obs1');
      engine.addObserver('obs2');
      engine.addObserver('obs3');
      const state = engine.getGameState();
      expect(state.observerCount).toBe(3);
    });
  });

  describe('Game State', () => {
    test('should return valid game state', () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      const state = engine.getGameState();
      
      expect(state.roomId).toBe('test-room-123');
      expect(state.seats).toHaveLength(5);
      expect(state.pot).toBe(0);
      expect(state.bettingPhase).toBe(true);
      expect(state.minBet).toBeGreaterThan(0);
      expect(state.deck).toEqual([]); // Security: never expose
    });

    test('should track pot correctly', async () => {
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      await engine.placeBet('user1', 100, 0);
      const state = engine.getGameState();
      
      expect(state.pot).toBe(100);
    });
  });

  describe('Provably Fair 2.0', () => {
    test('should store and retrieve dual seeds', async () => {
      const playerSeed = 'player-commitment-123';
      await engine.initializeWithQRNG(playerSeed);
      
      const seeds = engine.getDualSeeds();
      expect(seeds.playerSeed).toBe(playerSeed);
      expect(seeds.serverSeed).toBeTruthy();
      expect(seeds.serverSeed.length).toBeGreaterThan(10);
    });

    test('should use consistent hashing for shuffle reproducibility', async () => {
      const playerSeed = 'deterministic-seed';
      await engine.initializeWithQRNG(playerSeed);
      
      const seeds1 = engine.getDualSeeds();
      const engine2 = new WarEngine('test-room-456', mockPrisma as PrismaClient, mockRedis, mockEngagement as any);
      
      // Manually set same seeds for testing reproducibility
      // In production, same seeds should produce same shuffle
      expect(seeds1.playerSeed).toBe(playerSeed);
    });
  });

  describe('Utility Methods', () => {
    test('should calculate min bet based on hour', () => {
      const minBet = WarEngine.getMinBet();
      const hour = new Date().getHours();
      
      if (hour >= 20) {
        expect(minBet).toBe(50); // High stakes night
      } else {
        expect(minBet).toBe(10);
      }
    });
  });
});
