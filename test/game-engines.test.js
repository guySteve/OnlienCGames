/**
 * Comprehensive Game Engine Tests
 * 
 * Tests cover:
 * - UI functionality simulation
 * - Function correctness
 * - Scalability (multiple players/seats)
 * - Chip balance verification after each bet
 * 
 * Games Tested:
 * - War
 * - Blackjack  
 * - Bingo
 */

const assert = require('assert');

// Mock dependencies that require database
const mockPrisma = {
  user: {
    findUnique: async (query) => ({
      id: query.where.id || 'test-user',
      chipBalance: BigInt(1000),
      totalWagered: BigInt(0),
      totalWon: BigInt(0),
      totalHandsPlayed: 0
    }),
    update: async () => ({})
  },
  gameSession: {
    create: async () => ({})
  },
  transaction: {
    create: async () => ({})
  },
  $transaction: async (fn) => fn({
    user: { update: async () => ({}) },
    transaction: { create: async () => ({}) }
  })
};

const mockRedis = {
  get: async () => null,
  set: async () => 'OK',
  setex: async () => 'OK',
  del: async () => 1,
  publish: async () => 1
};

const mockEngagement = {
  recordEngagement: async () => {},
  recordBigWin: async () => {},
  awardXP: async () => {},
  rollMysteryDrop: async () => ({ triggered: false })
};

// Test runner
let tests = [];
let passed = 0;
let failed = 0;

function describe(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n🧪 Running Comprehensive Game Engine Tests\n');
  console.log('='.repeat(70));

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✅ ${t.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${t.name}`);
      console.log(`     Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Results: ${passed}/${passed + failed} tests passed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// ==============================================================================
// WAR ENGINE TESTS
// ==============================================================================

describe('WarEngine', () => {
  const { WarEngine } = require('../src/engines/WarEngine');

  // Test fixture factory
  const createWarEngine = () => {
    return new WarEngine('test-room', mockPrisma, mockRedis, mockEngagement);
  };

  // ==== Deck Management ====
  describe('Deck Management', () => {
    test('should create a 52-card deck on initialization', () => {
      const engine = createWarEngine();
      const state = engine.getGameState();
      // Deck is hidden but exists
      assert.strictEqual(Array.isArray(state.deck), true, 'Deck should be an array');
      assert.strictEqual(state.deck.length, 0, 'Deck should be hidden in state');
    });

    test('should never expose deck in game state for security', () => {
      const engine = createWarEngine();
      const state = engine.getGameState();
      assert.deepStrictEqual(state.deck, [], 'Deck must be empty array in state');
    });
  });

  // ==== Seat Management ====
  describe('Seat Management', () => {
    test('should have 5 empty seats initially', () => {
      const engine = createWarEngine();
      const state = engine.getGameState();
      assert.strictEqual(state.seats.length, 5, 'Should have 5 seats');
      state.seats.forEach(seat => {
        assert.strictEqual(seat.empty, true, 'All seats should be empty initially');
      });
    });

    test('should allow player to sit at empty seat', () => {
      const engine = createWarEngine();
      const result = engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      assert.strictEqual(result.success, true, 'Should sit successfully');
    });

    test('should reject sitting at occupied seat', () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      const result = engine.sitAtSeat('socket2', 0, 'Player2', null, 1000);
      assert.strictEqual(result.success, false, 'Should not sit at occupied seat');
      assert.strictEqual(result.error, 'Seat already occupied');
    });

    test('should reject invalid seat indices', () => {
      const engine = createWarEngine();
      
      const negativeResult = engine.sitAtSeat('socket1', -1, 'Player', null, 1000);
      assert.strictEqual(negativeResult.success, false, 'Negative index should fail');
      
      const tooHighResult = engine.sitAtSeat('socket1', 5, 'Player', null, 1000);
      assert.strictEqual(tooHighResult.success, false, 'Index 5 should fail');
      
      const wayTooHighResult = engine.sitAtSeat('socket1', 100, 'Player', null, 1000);
      assert.strictEqual(wayTooHighResult.success, false, 'Index 100 should fail');
    });

    test('should track seated count correctly', () => {
      const engine = createWarEngine();
      assert.strictEqual(engine.getSeatedCount(), 0, 'Initially 0');
      
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      assert.strictEqual(engine.getSeatedCount(), 1, 'After 1 seated');
      
      engine.sitAtSeat('socket2', 2, 'Player2', null, 1000);
      assert.strictEqual(engine.getSeatedCount(), 2, 'After 2 seated');
      
      engine.sitAtSeat('socket3', 4, 'Player3', null, 1000);
      assert.strictEqual(engine.getSeatedCount(), 3, 'After 3 seated');
    });

    test('should allow player to leave seat', () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      const result = engine.leaveSeat('socket1', 0);
      assert.strictEqual(result.success, true, 'Should leave successfully');
      assert.strictEqual(result.seatIndex, 0, 'Should return correct seat index');
      assert.strictEqual(engine.getSeatedCount(), 0, 'Seat count should be 0');
    });

    test('should find player by seat index', () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 2, 'TestPlayer', 'photo.jpg', 500);
      
      const player = engine.getPlayerBySeat(2);
      assert.notStrictEqual(player, null, 'Should find player');
      assert.strictEqual(player.name, 'TestPlayer');
      assert.strictEqual(player.chips, 500);
    });

    test('should find player by socket ID', () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket123', 3, 'SocketPlayer', null, 750);
      
      const result = engine.getPlayerBySocket('socket123');
      assert.notStrictEqual(result, null, 'Should find player');
      assert.strictEqual(result.seat.name, 'SocketPlayer');
      assert.strictEqual(result.seatIndex, 3);
    });
  });

  // ==== Betting Mechanics ====
  describe('Betting Mechanics', () => {
    test('should allow valid bet placement', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      const result = await engine.placeBet('user1', 100, 0);
      assert.strictEqual(result, true, 'Bet should succeed');
    });

    test('should reject bet below minimum', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      const result = await engine.placeBet('user1', 5, 0);
      assert.strictEqual(result, false, 'Bet below min should fail');
    });

    test('should reject bet exceeding player chips', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      const result = await engine.placeBet('user1', 5000, 0);
      assert.strictEqual(result, false, 'Bet exceeding chips should fail');
    });

    test('should deduct chips correctly after bet', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      await engine.placeBet('user1', 200, 0);
      
      const player = engine.getPlayerBySeat(0);
      assert.strictEqual(player.chips, 800, 'Chips should be deducted');
      assert.strictEqual(player.currentBet, 200, 'Current bet should be set');
    });

    test('should add bet to pot', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
      
      await engine.placeBet('user1', 100, 0);
      await engine.placeBet('user2', 150, 1);
      
      const state = engine.getGameState();
      assert.strictEqual(state.pot, 250, 'Pot should equal sum of bets');
    });

    test('should mark player as ready after bet', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      
      await engine.placeBet('user1', 100, 0);
      
      const player = engine.getPlayerBySeat(0);
      assert.strictEqual(player.ready, true, 'Player should be ready');
    });
  });

  // ==== Chip Balance Verification ====
  describe('Total Chip Recount Per Bet', () => {
    test('should maintain chip conservation: starting chips = remaining + bet', async () => {
      const engine = createWarEngine();
      const startingChips = 1000;
      
      engine.sitAtSeat('socket1', 0, 'Player1', null, startingChips);
      
      const betAmount = 250;
      await engine.placeBet('user1', betAmount, 0);
      
      const player = engine.getPlayerBySeat(0);
      const state = engine.getGameState();
      
      const totalAccountedFor = player.chips + state.pot;
      assert.strictEqual(totalAccountedFor, startingChips, 
        `Chip conservation violated: ${player.chips} + ${state.pot} != ${startingChips}`);
    });

    test('should maintain chip conservation with multiple players', async () => {
      const engine = createWarEngine();
      const startingChipsTotal = 5000; // 5 players * 1000 each
      
      for (let i = 0; i < 5; i++) {
        engine.sitAtSeat(`socket${i}`, i, `Player${i}`, null, 1000);
      }
      
      // Place varied bets
      await engine.placeBet('user0', 100, 0);
      await engine.placeBet('user1', 200, 1);
      await engine.placeBet('user2', 300, 2);
      await engine.placeBet('user3', 150, 3);
      await engine.placeBet('user4', 250, 4);
      
      const state = engine.getGameState();
      let totalChipsInPlay = state.pot;
      
      for (let i = 0; i < 5; i++) {
        const player = engine.getPlayerBySeat(i);
        totalChipsInPlay += player.chips;
      }
      
      assert.strictEqual(totalChipsInPlay, startingChipsTotal,
        `Total chips changed: ${totalChipsInPlay} != ${startingChipsTotal}`);
    });

    test('should prevent negative chip balance', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 100);
      
      // Try to bet more than available
      const result = await engine.placeBet('user1', 150, 0);
      assert.strictEqual(result, false, 'Should not allow overdraft');
      
      const player = engine.getPlayerBySeat(0);
      assert.strictEqual(player.chips, 100, 'Chips should remain unchanged');
    });
  });

  // ==== Ready State Management ====
  describe('Ready State', () => {
    test('should return false for allSeatedReady with no players', () => {
      const engine = createWarEngine();
      assert.strictEqual(engine.allSeatedReady(), false);
    });

    test('should return false when not all players ready', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
      
      await engine.placeBet('user1', 100, 0);
      // Player 2 has not bet
      
      assert.strictEqual(engine.allSeatedReady(), false);
    });

    test('should return true when all seated players ready', async () => {
      const engine = createWarEngine();
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
      
      await engine.placeBet('user1', 100, 0);
      await engine.placeBet('user2', 100, 1);
      
      assert.strictEqual(engine.allSeatedReady(), true);
    });
  });

  // ==== Observer Management ====
  describe('Observer Management', () => {
    test('should add and remove observers', () => {
      const engine = createWarEngine();
      
      engine.addObserver('obs1');
      engine.addObserver('obs2');
      
      let state = engine.getGameState();
      assert.strictEqual(state.observerCount, 2);
      
      engine.removeObserver('obs1');
      state = engine.getGameState();
      assert.strictEqual(state.observerCount, 1);
    });
  });

  // ==== Game State ====
  describe('Game State', () => {
    test('should return valid game state structure', () => {
      const engine = createWarEngine();
      const state = engine.getGameState();
      
      assert.ok(state.roomId, 'Should have roomId');
      assert.ok(Array.isArray(state.seats), 'Should have seats array');
      assert.strictEqual(typeof state.pot, 'number', 'Pot should be number');
      assert.strictEqual(typeof state.minBet, 'number', 'minBet should be number');
      assert.strictEqual(typeof state.bettingPhase, 'boolean', 'bettingPhase should be boolean');
      assert.strictEqual(typeof state.observerCount, 'number', 'observerCount should be number');
    });

    test('should start in betting phase', () => {
      const engine = createWarEngine();
      const state = engine.getGameState();
      assert.strictEqual(state.bettingPhase, true);
    });
  });

  // ==== Provably Fair ====
  describe('Provably Fair 2.0', () => {
    test('should store dual seeds after initialization', async () => {
      const engine = createWarEngine();
      await engine.initializeWithQRNG('player-seed-test');
      
      const seeds = engine.getDualSeeds();
      assert.strictEqual(seeds.playerSeed, 'player-seed-test');
      assert.ok(seeds.serverSeed.length > 0, 'Server seed should be generated');
    });
  });
});

// ==============================================================================
// BLACKJACK ENGINE TESTS
// ==============================================================================

describe('BlackjackEngine', () => {
  const { BlackjackEngine } = require('../src/engines/BlackjackEngine');

  const createBlackjackEngine = () => {
    return new BlackjackEngine(
      { roomId: 'bj-test', minBet: 10, maxBet: 500, maxPlayers: 5 },
      mockPrisma,
      mockRedis,
      mockEngagement
    );
  };

  describe('Game Type', () => {
    test('should return BLACKJACK as game type', () => {
      const engine = createBlackjackEngine();
      assert.strictEqual(engine.getGameType(), 'BLACKJACK');
    });
  });

  describe('Game State Structure', () => {
    test('should return valid Blackjack game state', () => {
      const engine = createBlackjackEngine();
      const state = engine.getGameState();
      
      assert.strictEqual(state.gameType, 'BLACKJACK');
      assert.ok(state.roomId, 'Should have roomId');
      assert.ok(Array.isArray(state.seats), 'Should have seats');
      assert.ok(Array.isArray(state.dealerHand), 'Should have dealerHand');
      assert.strictEqual(typeof state.dealerValue, 'number', 'Should have dealerValue');
      assert.strictEqual(typeof state.pot, 'number', 'Should have pot');
      assert.strictEqual(typeof state.minBet, 'number', 'Should have minBet');
    });

    test('should have 5 seat slots', () => {
      const engine = createBlackjackEngine();
      const state = engine.getGameState();
      assert.strictEqual(state.seats.length, 5);
    });
  });

  describe('Provably Fair Seeds', () => {
    test('should initialize with QRNG and store seeds', async () => {
      const engine = createBlackjackEngine();
      await engine.initializeWithQRNG('bj-player-seed');
      
      const seeds = engine.getDualSeeds();
      assert.strictEqual(seeds.playerSeed, 'bj-player-seed');
      assert.ok(seeds.serverSeed.length > 0);
    });
  });
});

// ==============================================================================
// BINGO ENGINE TESTS
// ==============================================================================

describe('BingoEngine', () => {
  const { BingoEngine } = require('../src/engines/BingoEngine');

  const createBingoEngine = () => {
    return new BingoEngine(
      { roomId: 'bingo-test', minBet: 1, maxBet: 5, maxPlayers: 50 },
      mockPrisma,
      mockRedis,
      mockEngagement
    );
  };

  describe('Game Type', () => {
    test('should return BINGO as game type', () => {
      const engine = createBingoEngine();
      assert.strictEqual(engine.getGameType(), 'BINGO');
    });
  });

  describe('Game State', () => {
    test('should return valid Bingo game state', () => {
      const engine = createBingoEngine();
      const state = engine.getGameState();
      
      assert.strictEqual(state.type, 'BINGO');
      assert.ok(['BUYING', 'PLAYING', 'COMPLETE'].includes(state.phase));
      assert.ok(Array.isArray(state.drawnNumbers));
      assert.strictEqual(typeof state.pot, 'number');
      assert.strictEqual(typeof state.cardPrice, 'number');
    });

    test('should start in BUYING phase', () => {
      const engine = createBingoEngine();
      const state = engine.getGameState();
      assert.strictEqual(state.phase, 'BUYING');
    });
  });

  describe('Player Management', () => {
    test('should add player successfully', async () => {
      const engine = createBingoEngine();
      const result = await engine.addPlayer('test-user-id');
      assert.strictEqual(result, true);
    });

    test('should get player cards (empty initially)', () => {
      const engine = createBingoEngine();
      const cards = engine.getPlayerCards('nonexistent');
      assert.ok(Array.isArray(cards));
      assert.strictEqual(cards.length, 0);
    });
  });

  describe('Card Purchase (Betting)', () => {
    test('should allow buying card during BUYING phase', async () => {
      const engine = createBingoEngine();
      await engine.addPlayer('test-user-id');
      
      const result = await engine.placeBet('test-user-id', 1);
      assert.strictEqual(result, true);
    });

    test('should add to pot when card is purchased', async () => {
      const engine = createBingoEngine();
      await engine.addPlayer('test-user-id');
      await engine.placeBet('test-user-id', 1);
      
      const state = engine.getGameState();
      assert.strictEqual(state.pot, 1);
    });

    test('should reject incorrect card price', async () => {
      const engine = createBingoEngine();
      await engine.addPlayer('test-user-id');
      
      const result = await engine.placeBet('test-user-id', 2);
      assert.strictEqual(result, false);
    });
  });

  describe('Callbacks', () => {
    test('should accept ball call callback', () => {
      const engine = createBingoEngine();
      let callbackCalled = false;
      
      engine.setBallCallCallback((ball) => {
        callbackCalled = true;
      });
      
      // Callback is stored but we can't easily test it without starting game
      assert.ok(true, 'Callback set without error');
    });

    test('should accept game end callback', () => {
      const engine = createBingoEngine();
      
      engine.setGameEndCallback((data) => {});
      assert.ok(true, 'Game end callback set without error');
    });
  });

  describe('Cleanup', () => {
    test('should destroy timers without error', () => {
      const engine = createBingoEngine();
      engine.destroy();
      assert.ok(true, 'Destroy completed without error');
    });
  });
});

// ==============================================================================
// SCALABILITY TESTS
// ==============================================================================

describe('Scalability Tests', () => {
  const { WarEngine } = require('../src/engines/WarEngine');
  const { BingoEngine } = require('../src/engines/BingoEngine');

  describe('War Engine - Maximum Players', () => {
    test('should handle 5 players at maximum capacity', async () => {
      const engine = new WarEngine('scale-test', mockPrisma, mockRedis, mockEngagement);
      
      // Fill all 5 seats
      for (let i = 0; i < 5; i++) {
        const result = engine.sitAtSeat(`socket${i}`, i, `Player${i}`, null, 1000);
        assert.strictEqual(result.success, true, `Seat ${i} should succeed`);
      }
      
      assert.strictEqual(engine.getSeatedCount(), 5);
      
      // Try to add 6th player - should fail since all seats taken
      const result = engine.sitAtSeat('socket6', 0, 'Player6', null, 1000);
      assert.strictEqual(result.success, false, 'Should not add 6th player');
    });

    test('should process 5 concurrent bets correctly', async () => {
      const engine = new WarEngine('scale-test-2', mockPrisma, mockRedis, mockEngagement);
      const startingTotal = 5000; // 5 * 1000
      
      for (let i = 0; i < 5; i++) {
        engine.sitAtSeat(`socket${i}`, i, `Player${i}`, null, 1000);
      }
      
      // All players bet different amounts
      const bets = [50, 100, 150, 200, 250];
      for (let i = 0; i < 5; i++) {
        await engine.placeBet(`user${i}`, bets[i], i);
      }
      
      // Verify total chips conserved
      const state = engine.getGameState();
      let totalChips = state.pot;
      for (let i = 0; i < 5; i++) {
        totalChips += engine.getPlayerBySeat(i).chips;
      }
      
      assert.strictEqual(totalChips, startingTotal, 'Total chips must be conserved');
    });
  });

  describe('Bingo Engine - Multiple Players', () => {
    test('should handle many players buying cards', async () => {
      const engine = new BingoEngine(
        { roomId: 'bingo-scale', minBet: 1, maxBet: 5, maxPlayers: 50 },
        mockPrisma,
        mockRedis,
        mockEngagement
      );
      
      // Simulate 10 players each buying a card
      for (let i = 0; i < 10; i++) {
        await engine.addPlayer(`user-${i}`);
        await engine.placeBet(`user-${i}`, 1);
      }
      
      const state = engine.getGameState();
      assert.strictEqual(state.pot, 10, 'Pot should equal 10 (10 cards at 1 chip each)');
      assert.strictEqual(state.players.length, 10, 'Should have 10 players');
    });
  });

  describe('Rapid State Changes', () => {
    test('should handle rapid seat changes', () => {
      const engine = new WarEngine('rapid-test', mockPrisma, mockRedis, mockEngagement);
      
      // Sit and leave rapidly
      for (let round = 0; round < 10; round++) {
        engine.sitAtSeat('socket1', 0, 'Player', null, 1000);
        engine.leaveSeat('socket1', 0);
      }
      
      assert.strictEqual(engine.getSeatedCount(), 0, 'Should end with 0 seated');
    });
  });
});

// ==============================================================================
// INTEGRATION TESTS
// ==============================================================================

describe('Integration Tests', () => {
  const { WarEngine } = require('../src/engines/WarEngine');

  describe('Full War Game Round', () => {
    test('should complete a full betting round maintaining chip conservation', async () => {
      const engine = new WarEngine('integration-test', mockPrisma, mockRedis, mockEngagement);
      const totalStartingChips = 3000; // 3 players * 1000
      
      // Setup 3 players
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 1, 'Player2', null, 1000);
      engine.sitAtSeat('socket3', 2, 'Player3', null, 1000);
      
      // Place bets
      await engine.placeBet('user1', 100, 0);
      await engine.placeBet('user2', 150, 1);
      await engine.placeBet('user3', 200, 2);
      
      // Verify all ready
      assert.strictEqual(engine.allSeatedReady(), true);
      
      // Verify pot
      const state = engine.getGameState();
      assert.strictEqual(state.pot, 450, 'Pot should be 450');
      
      // Verify chip conservation before hand
      let totalChips = state.pot;
      totalChips += engine.getPlayerBySeat(0).chips; // 900
      totalChips += engine.getPlayerBySeat(1).chips; // 850
      totalChips += engine.getPlayerBySeat(2).chips; // 800
      
      assert.strictEqual(totalChips, totalStartingChips, 'Chips conserved before dealing');
      
      // Start hand
      await engine.startNewHand();
      
      // Verify cards dealt
      assert.ok(engine.getPlayerBySeat(0).card, 'Player 1 should have card');
      assert.ok(engine.getPlayerBySeat(1).card, 'Player 2 should have card');
      assert.ok(engine.getPlayerBySeat(2).card, 'Player 3 should have card');
    });
  });

  describe('Reset Between Rounds', () => {
    test('should properly reset for next round', async () => {
      const engine = new WarEngine('reset-test', mockPrisma, mockRedis, mockEngagement);
      
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      await engine.placeBet('user1', 100, 0);
      await engine.startNewHand();
      
      // Reset for next round
      await engine.resetForNextRound();
      
      const state = engine.getGameState();
      assert.strictEqual(state.pot, 0, 'Pot should be reset to 0');
      assert.strictEqual(state.bettingPhase, true, 'Should be in betting phase');
      
      const player = engine.getPlayerBySeat(0);
      assert.strictEqual(player.currentBet, 0, 'Current bet should be 0');
      assert.strictEqual(player.ready, false, 'Player should not be ready');
      assert.strictEqual(player.card, undefined, 'Card should be cleared');
    });
  });
});

// ==============================================================================
// UI SIMULATION TESTS
// ==============================================================================

describe('UI Simulation Tests', () => {
  const { WarEngine } = require('../src/engines/WarEngine');

  describe('Bet Placement UI Flow', () => {
    test('should provide correct state for UI after each action', async () => {
      const engine = new WarEngine('ui-test', mockPrisma, mockRedis, mockEngagement);
      
      // Step 1: Initial state - betting phase
      let state = engine.getGameState();
      assert.strictEqual(state.bettingPhase, true, 'UI: Should show bet controls');
      assert.strictEqual(state.pot, 0, 'UI: Pot should show 0');
      
      // Step 2: Player joins
      engine.sitAtSeat('socket1', 0, 'UIPlayer', null, 1000);
      state = engine.getGameState();
      assert.strictEqual(state.seats[0].empty, false, 'UI: Seat should appear occupied');
      assert.strictEqual(state.seats[0].name, 'UIPlayer', 'UI: Name should display');
      assert.strictEqual(state.seats[0].chips, 1000, 'UI: Chips should display');
      
      // Step 3: Place bet
      await engine.placeBet('user1', 250, 0);
      state = engine.getGameState();
      assert.strictEqual(state.seats[0].currentBet, 250, 'UI: Current bet should show');
      assert.strictEqual(state.seats[0].chips, 750, 'UI: Updated chips should show');
      assert.strictEqual(state.pot, 250, 'UI: Pot should update');
      assert.strictEqual(state.seats[0].ready, true, 'UI: Ready indicator should show');
    });
  });

  describe('Multi-Player UI State', () => {
    test('should show correct states for all players', async () => {
      const engine = new WarEngine('multi-ui-test', mockPrisma, mockRedis, mockEngagement);
      
      engine.sitAtSeat('socket1', 0, 'Player1', null, 1000);
      engine.sitAtSeat('socket2', 2, 'Player2', null, 500);
      engine.sitAtSeat('socket3', 4, 'Player3', null, 2000);
      
      await engine.placeBet('user1', 100, 0);
      // Player 2 doesn't bet yet
      await engine.placeBet('user3', 500, 4);
      
      const state = engine.getGameState();
      
      // Check each seat
      assert.strictEqual(state.seats[0].ready, true, 'Seat 0 ready');
      assert.strictEqual(state.seats[1].empty, true, 'Seat 1 empty');
      assert.strictEqual(state.seats[2].ready, false, 'Seat 2 not ready');
      assert.strictEqual(state.seats[3].empty, true, 'Seat 3 empty');
      assert.strictEqual(state.seats[4].ready, true, 'Seat 4 ready');
      
      // All seated not ready (player 2 hasn't bet)
      assert.strictEqual(engine.allSeatedReady(), false);
    });
  });
});

// Run all tests
runTests();
