/**
 * BlackjackEngine v5.0.0 - Example Refactor
 *
 * This demonstrates how to refactor playerAction() from v4.0.0 to v5.0.0
 * using Redis-First architecture and distributed locking.
 *
 * BEFORE (v4.0.0 - VULNERABLE):
 * ```typescript
 * async playerAction(userId, action) {
 *   if (this.state !== GameState.PLAYER_TURN) return false; // ❌ Race condition
 *   const player = this.players.get(userId);                // ❌ Memory state
 *   await this.deductChips(userId, 10);                     // ❌ No lock
 *   this.state = GameState.DEALER_TURN;                     // ❌ Lost on crash
 * }
 * ```
 *
 * AFTER (v5.0.0 - PRODUCTION-READY):
 * See implementation below ✅
 *
 * KEY IMPROVEMENTS:
 * 1. Distributed lock prevents concurrent modifications
 * 2. State fetched from Redis (not memory)
 * 3. Atomic database transactions for money
 * 4. Graceful error handling with typed responses
 * 5. Container crash = zero data loss
 *
 * @author VegasCore Architecture Team
 * @version 5.0.0
 */
import { BaseGameEngine } from './BaseGameEngine.v5';
/**
 * Blackjack-specific action types
 */
type BlackjackAction = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'SURRENDER' | 'INSURANCE';
/**
 * Strongly-typed action result
 */
interface ActionResult {
    success: boolean;
    error?: string;
    errorCode?: 'INVALID_STATE' | 'INSUFFICIENT_FUNDS' | 'SYSTEM_BUSY' | 'INVALID_ACTION';
    newHandValue?: number;
    busted?: boolean;
    nextPlayer?: string;
}
/**
 * Blackjack Engine v5.0.0
 */
export declare class BlackjackEngineV5 extends BaseGameEngine {
    getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO';
    /**
     * Handle player action (HIT, STAND, DOUBLE, etc.)
     *
     * LOCKING STRATEGY:
     * - Use table-level lock (only one action at a time per table)
     * - Prevents race conditions with concurrent players
     * - Ensures state consistency across distributed containers
     *
     * ERROR HANDLING:
     * - Lock timeout → 429 Too Many Requests (client retries)
     * - Invalid action → 400 Bad Request (client error)
     * - Insufficient funds → 402 Payment Required (add chips)
     *
     * @param userId - User ID from session
     * @param seatIndex - Seat position (0-6)
     * @param action - Action type
     * @param metadata - Optional action metadata (insurance amount, etc.)
     * @returns Strongly-typed result
     */
    playerAction(userId: string, seatIndex: number, action: BlackjackAction, metadata?: {
        insuranceAmount?: number;
    }): Promise<ActionResult>;
    /**
     * Handle HIT action
     *
     * LOGIC:
     * 1. Deal card from shoe
     * 2. Add to hand
     * 3. Check for bust
     * 4. Update state
     */
    private handleHit;
    /**
     * Handle STAND action
     */
    private handleStand;
    /**
     * Handle DOUBLE action (double bet + take one card)
     *
     * CRITICAL: Money operation - uses deductChips (atomic transaction)
     */
    private handleDouble;
    /**
     * Handle SPLIT action (split pairs into two hands)
     *
     * CRITICAL: Money operation - deducts bet for second hand
     */
    private handleSplit;
    /**
     * Handle SURRENDER action (forfeit half bet)
     *
     * CRITICAL: Money operation - awards half bet back
     */
    private handleSurrender;
    /**
     * Handle INSURANCE action (side bet against dealer blackjack)
     *
     * CRITICAL: Money operation - deducts insurance bet
     */
    private handleInsurance;
    /**
     * Deal card from shoe
     */
    private dealCard;
    /**
     * Calculate hand value (with Ace soft/hard logic)
     */
    private calculateHandValue;
    /**
     * Move to next player (or dealer turn if all done)
     */
    private moveToNextPlayer;
    startHand(): Promise<void>;
    resolveHand(): Promise<void>;
}
export {};
/**
 * SPLIT-BRAIN SCENARIO - HOW THIS SOLVES IT
 * ==========================================
 *
 * PROBLEM (v4.0.0):
 * - Container A: User hits, deducts chips, sets state to DEALER_TURN
 * - Container B (simultaneously): User hits, deducts chips, sets state to DEALER_TURN
 * - Result: User charged twice, state corrupted
 *
 * SOLUTION (v5.0.0):
 * 1. Container A acquires lock "table:123:action"
 * 2. Container A fetches state from Redis
 * 3. Container A processes hit
 * 4. Container A saves state to Redis
 * 5. Container A releases lock
 * 6. Container B tries to acquire lock → WAITS
 * 7. Container B acquires lock after A releases
 * 8. Container B fetches UPDATED state from Redis
 * 9. Container B processes hit (or rejects if invalid state)
 *
 * RESULT: No race condition, no double-charge, full audit trail
 *
 * CONTAINER CRASH RECOVERY:
 * - If Container A crashes during step 4, lock TTL expires (5 seconds)
 * - Container B acquires lock automatically
 * - State in Redis is consistent (last committed state)
 * - Zero data loss
 */
//# sourceMappingURL=BlackjackEngine.v5.example.d.ts.map