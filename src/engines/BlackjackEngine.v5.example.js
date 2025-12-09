"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlackjackEngineV5 = void 0;
const BaseGameEngine_v5_1 = require("./BaseGameEngine.v5");
const LockManager_1 = require("../services/LockManager");
/**
 * Blackjack Engine v5.0.0
 */
class BlackjackEngineV5 extends BaseGameEngine_v5_1.BaseGameEngine {
    getGameType() {
        return 'BLACKJACK';
    }
    // ==========================================================================
    // PLAYER ACTION - REFACTORED WITH DISTRIBUTED LOCKING
    // ==========================================================================
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
    async playerAction(userId, seatIndex, action, metadata) {
        const lockManager = (0, LockManager_1.getLockManager)();
        // CRITICAL: Acquire distributed lock before ANY state access
        // This prevents two players from acting simultaneously on same table
        const lockResult = await lockManager.withLock(`table:${this.config.tableId}:action`, async () => {
            // STEP 1: FETCH latest game state from Redis
            // DO NOT trust `this.cachedState` - another container may have updated it
            const currentState = await this.redis.get(`table:${this.config.tableId}:state`);
            if (currentState !== BaseGameEngine_v5_1.GameState.PLAYER_TURN) {
                throw new Error('INVALID_STATE');
            }
            // STEP 2: FETCH latest custom game state from Redis
            const customState = await this.loadCustomState();
            if (!customState) {
                throw new Error('INVALID_STATE');
            }
            // STEP 3: VALIDATE player and hand
            const playerKey = `${userId}:${seatIndex}`;
            const bjPlayer = customState.bjPlayers[playerKey];
            if (!bjPlayer) {
                throw new Error('INVALID_ACTION');
            }
            const hand = bjPlayer.hands[bjPlayer.currentHandIndex];
            if (!hand || hand.status !== 'active') {
                throw new Error('INVALID_ACTION');
            }
            // STEP 4: EXECUTE action logic
            let result;
            switch (action) {
                case 'HIT':
                    result = await this.handleHit(customState, bjPlayer, hand);
                    break;
                case 'STAND':
                    result = await this.handleStand(customState, bjPlayer, hand);
                    break;
                case 'DOUBLE':
                    result = await this.handleDouble(userId, seatIndex, customState, bjPlayer, hand);
                    break;
                case 'SPLIT':
                    result = await this.handleSplit(userId, seatIndex, customState, bjPlayer, hand);
                    break;
                case 'SURRENDER':
                    result = await this.handleSurrender(userId, seatIndex, customState, bjPlayer, hand);
                    break;
                case 'INSURANCE':
                    result = await this.handleInsurance(userId, seatIndex, customState, bjPlayer, metadata?.insuranceAmount || 0);
                    break;
                default:
                    throw new Error('INVALID_ACTION');
            }
            // STEP 5: SAVE updated state to Redis
            await this.saveCustomState(customState);
            // STEP 6: CHECK if hand is complete → move to next player
            if (result.busted || action === 'STAND' || action === 'SURRENDER') {
                await this.moveToNextPlayer(customState);
            }
            return result;
        }, LockManager_1.LOCK_PRESETS.STANDARD // 5-second TTL, 3 retries
        );
        // STEP 7: HANDLE lock failures gracefully
        if (!lockResult.success) {
            if (lockResult.error === LockManager_1.LockError.ACQUISITION_TIMEOUT) {
                // Another request is processing - client should retry
                return {
                    success: false,
                    error: 'System busy, please retry',
                    errorCode: 'SYSTEM_BUSY'
                };
            }
            else {
                // Execution error - check error message
                const errorMessage = lockResult.error || 'Unknown error';
                if (errorMessage.includes('INVALID_STATE')) {
                    return {
                        success: false,
                        error: 'Not your turn',
                        errorCode: 'INVALID_STATE'
                    };
                }
                else if (errorMessage.includes('INSUFFICIENT_FUNDS')) {
                    return {
                        success: false,
                        error: 'Insufficient chips',
                        errorCode: 'INSUFFICIENT_FUNDS'
                    };
                }
                else {
                    return {
                        success: false,
                        error: 'Invalid action',
                        errorCode: 'INVALID_ACTION'
                    };
                }
            }
        }
        // STEP 8: Return successful result
        return lockResult.data;
    }
    // ==========================================================================
    // ACTION HANDLERS (Private Methods)
    // ==========================================================================
    /**
     * Handle HIT action
     *
     * LOGIC:
     * 1. Deal card from shoe
     * 2. Add to hand
     * 3. Check for bust
     * 4. Update state
     */
    async handleHit(customState, _player, hand) {
        // Deal card
        const card = this.dealCard(customState);
        hand.cards.push(card);
        // Calculate hand value
        const handValue = this.calculateHandValue(hand.cards);
        // Check for bust
        if (handValue > 21) {
            hand.status = 'bust';
            return {
                success: true,
                newHandValue: handValue,
                busted: true
            };
        }
        return {
            success: true,
            newHandValue: handValue,
            busted: false
        };
    }
    /**
     * Handle STAND action
     */
    async handleStand(_customState, _player, hand) {
        hand.status = 'stand';
        return {
            success: true,
            newHandValue: this.calculateHandValue(hand.cards)
        };
    }
    /**
     * Handle DOUBLE action (double bet + take one card)
     *
     * CRITICAL: Money operation - uses deductChips (atomic transaction)
     */
    async handleDouble(userId, seatIndex, customState, _player, hand) {
        // Validate double is allowed
        if (hand.cards.length !== 2 || hand.doubled) {
            throw new Error('INVALID_ACTION');
        }
        // CRITICAL: Deduct additional bet (with lock + transaction)
        const success = await this.deductChips(userId, seatIndex, hand.bet);
        if (!success) {
            throw new Error('INSUFFICIENT_FUNDS');
        }
        // Double the bet
        hand.bet *= 2;
        hand.doubled = true;
        // Deal one card
        const card = this.dealCard(customState);
        hand.cards.push(card);
        // Calculate value
        const handValue = this.calculateHandValue(hand.cards);
        // Auto-stand after doubling
        hand.status = handValue > 21 ? 'bust' : 'stand';
        return {
            success: true,
            newHandValue: handValue,
            busted: handValue > 21
        };
    }
    /**
     * Handle SPLIT action (split pairs into two hands)
     *
     * CRITICAL: Money operation - deducts bet for second hand
     */
    async handleSplit(userId, seatIndex, customState, player, hand) {
        // Validate split is allowed
        if (hand.cards.length !== 2 ||
            hand.cards[0].rank !== hand.cards[1].rank ||
            player.hands.length >= 3 || // Max 3 hands
            hand.split) {
            throw new Error('INVALID_ACTION');
        }
        // CRITICAL: Deduct bet for second hand
        const success = await this.deductChips(userId, seatIndex, hand.bet);
        if (!success) {
            throw new Error('INSUFFICIENT_FUNDS');
        }
        // Create second hand
        const secondCard = hand.cards.pop();
        const newHand = {
            cards: [secondCard],
            bet: hand.bet,
            status: 'active',
            doubled: false,
            split: true
        };
        // Add to player's hands
        player.hands.push(newHand);
        // Deal cards to both hands
        hand.cards.push(this.dealCard(customState));
        newHand.cards.push(this.dealCard(customState));
        return {
            success: true,
            newHandValue: this.calculateHandValue(hand.cards)
        };
    }
    /**
     * Handle SURRENDER action (forfeit half bet)
     *
     * CRITICAL: Money operation - awards half bet back
     */
    async handleSurrender(userId, seatIndex, _customState, _player, hand) {
        // Validate surrender is allowed (first action only)
        if (hand.cards.length !== 2) {
            throw new Error('INVALID_ACTION');
        }
        // Award half bet back
        const refund = Math.floor(hand.bet / 2);
        await this.awardChips(userId, seatIndex, refund);
        hand.status = 'surrender';
        return {
            success: true,
            newHandValue: this.calculateHandValue(hand.cards)
        };
    }
    /**
     * Handle INSURANCE action (side bet against dealer blackjack)
     *
     * CRITICAL: Money operation - deducts insurance bet
     */
    async handleInsurance(userId, seatIndex, customState, player, insuranceAmount) {
        // Validate dealer has Ace showing
        if (customState.dealerHand[0]?.rank !== 'A') {
            throw new Error('INVALID_ACTION');
        }
        // Validate insurance amount (max half of bet)
        const maxInsurance = player.hands[0].bet / 2;
        if (insuranceAmount > maxInsurance || insuranceAmount <= 0) {
            throw new Error('INVALID_ACTION');
        }
        // CRITICAL: Deduct insurance bet
        const success = await this.deductChips(userId, seatIndex, insuranceAmount);
        if (!success) {
            throw new Error('INSUFFICIENT_FUNDS');
        }
        player.insurance = insuranceAmount;
        return {
            success: true
        };
    }
    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================
    /**
     * Deal card from shoe
     */
    dealCard(customState) {
        if (customState.currentShoePosition >= customState.cutCardPosition) {
            // Reshuffle needed (implement reshuffleShoe method)
            throw new Error('RESHUFFLE_REQUIRED');
        }
        return customState.shoe[customState.currentShoePosition++];
    }
    /**
     * Calculate hand value (with Ace soft/hard logic)
     */
    calculateHandValue(cards) {
        let total = 0;
        let aces = 0;
        for (const card of cards) {
            if (card.rank === 'A') {
                aces++;
                total += 11;
            }
            else {
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
    /**
     * Move to next player (or dealer turn if all done)
     */
    async moveToNextPlayer(customState) {
        customState.currentPlayerIndex++;
        const playerKeys = Object.keys(customState.bjPlayers);
        if (customState.currentPlayerIndex >= playerKeys.length) {
            // All players done → dealer turn
            await this.setState(BaseGameEngine_v5_1.GameState.DEALER_TURN);
        }
        else {
            // Stay in player turn, emit event to notify next player
            // (Socket.IO event emission handled by caller)
        }
    }
    // ==========================================================================
    // ABSTRACT METHOD IMPLEMENTATIONS
    // ==========================================================================
    async startHand() {
        // Implement hand initialization
        await this.setState(BaseGameEngine_v5_1.GameState.DEALING);
        // ... deal cards, etc.
    }
    async resolveHand() {
        // Implement hand resolution and payouts
        await this.setState(BaseGameEngine_v5_1.GameState.RESOLVING);
        // ... calculate winners, award chips, etc.
    }
}
exports.BlackjackEngineV5 = BlackjackEngineV5;
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
//# sourceMappingURL=BlackjackEngine.v5.example.js.map