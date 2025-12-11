import { WarEngine } from '../src/engines/WarEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../src/services/EngagementService';
import * as assert from 'assert';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: async (query: any) => ({
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
  $transaction: async (fn: (arg0: { user: { findUnique: (query: any) => Promise<{ id: any; chipBalance: bigint; totalWagered: bigint; totalWon: bigint; totalHandsPlayed: number; } | null>; update: () => Promise<{}>; }; transaction: { create: () => Promise<{}>; }; gameSession: { create: () => Promise<{}>; }; }) => any) => fn({
    user: { 
        findUnique: async (query: any) => ({
            id: query.where.id || 'test-user',
            chipBalance: BigInt(1000),
            totalWagered: BigInt(0),
            totalWon: BigInt(0),
            totalHandsPlayed: 0
        }),
        update: async () => ({}) 
    },
    transaction: { create: async () => ({}) },
    gameSession: { create: async () => ({}) }
  })
} as unknown as PrismaClient;

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
} as unknown as EngagementService;

// Test runner
let tests: any[] = [];
let passed = 0;
let failed = 0;

function describe(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

async function runTests() {
    console.log('\n🧪 Running WarEngine v5 Tests\n');
    console.log('='.repeat(70));
  
    for (const t of tests) {
      try {
        await t.fn();
        console.log(`  ✅ ${t.name}`);
        passed++;
      } catch (error: any) {
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
// WAR ENGINE V5 TESTS
// ==============================================================================

describe('WarEngine v5', () => {
    const createWarEngine = () => {
        return new WarEngine('test-room', mockPrisma, mockRedis, mockEngagement);
    };

    test('should instantiate correctly', () => {
        const engine = createWarEngine();
        assert.ok(engine, 'Engine should be created');
        assert.strictEqual(engine.getGameType(), 'WAR', 'Game type should be WAR');
    });

    test('should have 25 empty spots on initialization', () => {
        const engine = createWarEngine();
        const state = engine.getGameState();
        assert.strictEqual(state.spots.length, 25, 'Should have 25 spots');
        assert.ok(state.spots.every((s: any) => s.bet === 0), 'All spots should be empty');
    });

    describe('Player Connection', () => {
        test('should connect a new player and assign a color', async () => {
            const engine = createWarEngine();
            const result = await engine.connectPlayer('user1', 'Player One');
            assert.strictEqual(result.success, true, 'Connection should be successful');
            assert.ok(result.color, 'Player should be assigned a color');
            assert.strictEqual(result.chips, 1000, 'Player should have initial chips');
            
            const player = engine.getPlayer('user1');
            assert.strictEqual(player?.name, 'Player One');
        });

        test('should reconnect an existing player with the same color', async () => {
            const engine = createWarEngine();
            const firstConnection = await engine.connectPlayer('user1', 'Player One');
            const secondConnection = await engine.connectPlayer('user1', 'Player One');

            assert.strictEqual(secondConnection.success, true);
            assert.strictEqual(firstConnection.color, secondConnection.color, 'Color should be persistent');
        });
    });

    describe('Betting', () => {
        test('should allow a player to place a valid bet', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player One');
            const result = await engine.placeBet('user1', 100, 5);

            assert.strictEqual(result, true, 'Bet placement should be successful');
            const state = engine.getGameState();
            assert.strictEqual(state.spots[5].bet, 100);
            assert.strictEqual(state.spots[5].playerId, 'user1');
            assert.strictEqual(state.pot, 100);

            const player = engine.getPlayer('user1');
            assert.strictEqual(player?.chipBalance, 900, 'Chips should be deducted');
        });

        test('should prevent betting on an occupied spot', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player One');
            await engine.connectPlayer('user2', 'Player Two');
            
            await engine.placeBet('user1', 100, 10);
            const result = await engine.placeBet('user2', 50, 10);

            assert.strictEqual(result, false, 'Should not bet on occupied spot');
            const state = engine.getGameState();
            assert.strictEqual(state.spots[10].bet, 100);
            assert.strictEqual(state.spots[10].playerId, 'user1');
        });

        test('should allow a player to remove their bet', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player One');
            await engine.placeBet('user1', 100, 7);

            const result = engine.removeBet('user1', 7, 'main');
            assert.strictEqual(result, true, 'Bet removal should be successful');

            const state = engine.getGameState();
            assert.strictEqual(state.spots[7].bet, 0);
            assert.strictEqual(state.pot, 0);

            const player = engine.getPlayer('user1');
            assert.strictEqual(player?.chipBalance, 1000, 'Chips should be refunded');
        });
    });
    
describe('Chip Balance Audit', () => {
        test('should track exact chip movement for a single bet', async () => {
            const engine = createWarEngine();
            const initialChips = 1000;
            const betAmount = 100;

            await engine.connectPlayer('user1', 'Player One');
            
            const playerBefore = engine.getPlayer('user1');
            assert.strictEqual(playerBefore?.chipBalance, initialChips, 'Pre-bet chips');

            await engine.placeBet('user1', betAmount, 0);

            const playerAfter = engine.getPlayer('user1');
            const state = engine.getGameState();
            
            assert.strictEqual(playerAfter?.chipBalance, initialChips - betAmount, 'Post-bet chips');
            assert.strictEqual(state.pot, betAmount, 'Pot equals bet');
            
            // Conservation law
            assert.strictEqual(
                playerAfter!.chipBalance + state.pot,
                initialChips,
                'Total chips conserved'
            );
        });

        test('should track chip movements for multiple sequential bets', async () => {
            const engine = createWarEngine();
            
            await engine.connectPlayer('user1', 'Player 1');
            await engine.connectPlayer('user2', 'Player 2');
            await engine.connectPlayer('user3', 'Player 3');

            const bet1 = 50, bet2 = 100, bet3 = 50;
            const totalInitial = 3000;
            
            const result1 = await engine.placeBet('user1', bet1, 0);
            const result2 = await engine.placeBet('user2', bet2, 1);
            const result3 = await engine.placeBet('user3', bet3, 2);
            
            assert.strictEqual(result1, true, 'Bet 1 should succeed');
            assert.strictEqual(result2, true, 'Bet 2 should succeed');
            assert.strictEqual(result3, true, 'Bet 3 should succeed');
            
            const state = engine.getGameState();
            const p1 = engine.getPlayer('user1');
            const p2 = engine.getPlayer('user2');
            const p3 = engine.getPlayer('user3');
            
            assert.strictEqual(p1?.chipBalance, 1000 - bet1);
            assert.strictEqual(p2?.chipBalance, 1000 - bet2);
            assert.strictEqual(p3?.chipBalance, 1000 - bet3);
            
            assert.strictEqual(state.pot, bet1 + bet2 + bet3);
            
            const totalAfter = p1!.chipBalance + p2!.chipBalance + p3!.chipBalance + state.pot;
            assert.strictEqual(totalAfter, totalInitial, 'Total chips conserved with 3 players');
        });

        test('should reject bet that would result in negative balance', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player One');

            const player = engine.getPlayer('user1');
            const initialChips = player!.chipBalance;
            
            const result = await engine.placeBet('user1', initialChips + 1, 0);
            
            assert.strictEqual(result, false, 'Overdraft bet should fail');
            
            const playerAfter = engine.getPlayer('user1');
            assert.strictEqual(playerAfter?.chipBalance, initialChips, 'Chips unchanged after failed bet');
            
            const state = engine.getGameState();
            assert.strictEqual(state.pot, 0, 'Pot remains 0');
        });
    });

    describe('Edge Case Tests', () => {
        test('should handle zero chips player', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Broke');
            const player = engine.getPlayer('user1');
            player!.chipBalance = 0;

            const result = await engine.placeBet('user1', 10, 0);
            assert.strictEqual(result, false, 'Zero chip player cannot bet');
            
            assert.strictEqual(player?.chipBalance, 0, 'Chips remain at 0');
        });

        test('should handle boundary spot indices', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player');
            
            const resultFirst = await engine.placeBet('user1', 10, 0);
            assert.strictEqual(resultFirst, true, 'Bet on first spot should be ok');

            // Player only has 1000 chips, so we need to reset the balance
            const player = engine.getPlayer('user1');
            player!.chipBalance = 1000;

            const resultLast = await engine.placeBet('user1', 10, 24);
            assert.strictEqual(resultLast, true, 'Bet on last spot should be ok');

            const resultInvalid = await engine.placeBet('user1', 10, 25);
            assert.strictEqual(resultInvalid, false, 'Bet on invalid spot should fail');
        });
    });

    describe('State Transition Tests', () => {
        test('should transition through game phases correctly', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player');
            await engine.initializeWithQRNG('test-seed');

            let state = engine.getGameState();
            assert.strictEqual(state.bettingPhase, true, 'Starts in betting phase');

            await engine.placeBet('user1', 100, 0);
            state = engine.getGameState();
            assert.strictEqual(state.pot, 100, 'Pot updated after bet');
            
            await engine.startNewHand();
            state = engine.getGameState();
            assert.strictEqual(state.bettingPhase, false, 'No longer betting phase');
            assert.ok(state.spots[0].card, 'Card dealt to player');
            assert.ok(state.houseCard, 'House card dealt');
        });

        test('should reset state correctly for next round', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player');
            await engine.initializeWithQRNG('test-seed');

            await engine.placeBet('user1', 100, 0);
            await engine.startNewHand();
            
            await engine.resetForNextRound();
            
            const state = engine.getGameState();
            assert.strictEqual(state.pot, 0, 'Pot reset to 0');
            assert.strictEqual(state.bettingPhase, true, 'Back to betting phase');
            assert.strictEqual(state.spots[0].card, undefined, 'Card should be cleared');
        });
    });

    describe('Payout Verification', () => {
        test('should correctly calculate pot before resolution', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'P1');
            await engine.connectPlayer('user2', 'P2');
            await engine.connectPlayer('user3', 'P3');

            await engine.placeBet('user1', 100, 0);
            await engine.placeBet('user2', 150, 1);
            await engine.placeBet('user3', 200, 2);

            const state = engine.getGameState();
            assert.strictEqual(state.pot, 450, 'Pot is sum of all bets');

            assert.strictEqual(engine.getPlayer('user1')?.chipBalance, 900);
            assert.strictEqual(engine.getPlayer('user2')?.chipBalance, 850);
            assert.strictEqual(engine.getPlayer('user3')?.chipBalance, 800);
        });

        test('should deal cards and have house card after startNewHand', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'P1');
            await engine.connectPlayer('user2', 'P2');
            await engine.initializeWithQRNG('test-seed');

            await engine.placeBet('user1', 100, 0);
            await engine.placeBet('user2', 100, 1);
            await engine.startNewHand();
            
            const state = engine.getGameState();
            const spot1 = state.spots[0];
            const spot2 = state.spots[1];
            
            assert.ok(spot1.card, 'Player 1 has card');
            assert.ok(spot2.card, 'Player 2 has card');
            assert.ok(state.houseCard, 'House has card');
            
            assert.ok(spot1.card.rank, 'Card has rank');
            assert.ok(spot1.card.value, 'Card has value');
            assert.ok(spot1.card.suit, 'Card has suit');
        });
    });

    describe('Tie Bets', () => {
        test('should allow a player to place a tie bet', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player One');
            const result = await engine.placeBet('user1', 50, 5, 'tie');

            assert.strictEqual(result, true, 'Tie bet placement should be successful');
            const state = engine.getGameState();
            assert.strictEqual(state.spots[5].tieBet, 50);
            assert.strictEqual(state.spots[5].bet, 0); // Main bet should be 0
            assert.strictEqual(state.spots[5].playerId, 'user1');
            assert.strictEqual(state.pot, 50);

            const player = engine.getPlayer('user1');
            assert.strictEqual(player?.chipBalance, 950, 'Chips should be deducted for tie bet');
        });

        test('should allow placing both main and tie bets on the same spot', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Player One');
            await engine.placeBet('user1', 100, 8, 'main');
            await engine.placeBet('user1', 20, 8, 'tie');

            const state = engine.getGameState();
            assert.strictEqual(state.spots[8].bet, 100);
            assert.strictEqual(state.spots[8].tieBet, 20);
            assert.strictEqual(state.pot, 120);
            
            const player = engine.getPlayer('user1');
            assert.strictEqual(player?.chipBalance, 880);
        });

        test('should payout 10:1 on a winning tie bet', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Tie Bettor');
            await engine.initializeWithQRNG('test-seed');

            // Force a tie by controlling the deck
            const controlledDeck = [
                { rank: 'K', value: 13, suit: '♠' }, // House card
                { rank: 'K', value: 13, suit: '♥' }, // Player card
            ];
            engine.setDeckForTesting(controlledDeck);

            await engine.placeBet('user1', 10, 0, 'tie');
            const playerPreHand = engine.getPlayer('user1');
            assert.strictEqual(playerPreHand?.chipBalance, 990);

            await engine.startNewHand(); // This will deal the cards
            await engine.resolveHand(); // This should resolve the tie bet

            const playerPostHand = engine.getPlayer('user1');
            // 10 * 11 = 110 (10:1 win + original bet)
            // 990 + 110 = 1100
            assert.strictEqual(playerPostHand?.chipBalance, 1100, 'Player should win 10x the tie bet');
        });

        test('should lose the tie bet on a non-tie result', async () => {
            const engine = createWarEngine();
            await engine.connectPlayer('user1', 'Tie Bettor');
            await engine.initializeWithQRNG('test-seed');

            // Force a non-tie
            engine.setDeckForTesting([
                { rank: 'K', value: 13, suit: '♠' }, // House card
                { rank: 'Q', value: 12, suit: '♥' }, // Player card
            ]);

            await engine.placeBet('user1', 10, 0, 'tie'); // 990 chips
            await engine.startNewHand();
            await engine.resolveHand();

            const player = engine.getPlayer('user1');
            // Tie bet is lost, no refund
            assert.strictEqual(player?.chipBalance, 990, 'Player should lose the tie bet amount');
        });
    });
});

runTests();