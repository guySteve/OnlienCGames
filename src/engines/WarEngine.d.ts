/**
 * War Game Engine - High-Velocity Community Table
 *
 * FREE-TIER OPTIMIZED ARCHITECTURE
 * =================================
 * - In-Memory Game Loop: All round logic happens in class instance
 * - Batched DB Writes: Single write per round during payout phase only
 * - Lightweight State Broadcasting: Minimal JSON over sockets
 * - No Seat Ownership: Players bet on any of 16 spots, first-come-first-served
 *
 * TOPOLOGY
 * ========
 * - 4 Hands (betting positions)
 * - 4 Spots per Hand
 * - Total: 16 playable betting spots (indices 0-15)
 *
 * HARD ROCK CASINO WAR RULES
 * ===========================
 * - Dealer draws ONE house card
 * - Each active spot gets ONE player card
 * - Win: Player card > Dealer card (pays 1:1)
 * - Lose: Player card < Dealer card (lose bet)
 * - Tie: Player must choose:
 *   - Surrender: Forfeit 50% of bet
 *   - War: Match original bet
 *     - War Win: Player wins (+1 unit on war bet)
 *     - War Tie: Player wins (+2 units total)
 */
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import { EventEmitter } from 'events';
type Redis = any;
interface PlayerInfo {
    userId: string;
    name: string;
    color: string;
    chipBalance: number;
}
/**
 * War Game Engine - Community Table (Free-Tier Optimized)
 */
export declare class WarEngine extends GameEngine {
    private spots;
    private playerColors;
    private playerInfo;
    private houseCard;
    private deck;
    private bettingPhase;
    private warPhase;
    private pendingPayouts;
    private playerSeed;
    private serverSeed;
    events: EventEmitter;
    private colorIndex;
    constructor(roomId: string, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO';
    private createDeck;
    private shuffleDeck;
    initializeWithQRNG(playerSeed: string): Promise<void>;
    getDualSeeds(): {
        playerSeed: string;
        serverSeed: string;
    };
    private drawCard;
    /**
     * Connect player to table and assign persistent neon color
     */
    connectPlayer(userId: string, name: string): Promise<{
        success: boolean;
        color: string;
        chips: number;
    }>;
    /**
     * Disconnect player (optional cleanup)
     */
    disconnectPlayer(userId: string): void;
    /**
     * Get player info
     */
    getPlayer(userId: string): PlayerInfo | null;
    /**
     * Place bet on any spot (0-24)
     * NO database write - all in-memory
     */
    placeBet(userId: string, amount: number, spotIndex?: number): Promise<boolean>;
    /**
     * Remove bet (only during betting phase)
     */
    removeBet(userId: string, spotIndex: number): boolean;
    /**
     * Get all active spots
     */
    private getActiveSpots;
    startNewHand(): Promise<void>;
    /**
     * Handle war decision (Surrender or War)
     */
    makeWarDecision(userId: string, spotIndex: number, decision: 'surrender' | 'war'): Promise<boolean>;
    /**
     * Resolve hand and execute BATCHED DATABASE WRITE
     */
    resolveHand(): Promise<void>;
    /**
     * Track payout for batched write
     */
    private trackPayout;
    /**
     * BATCHED DATABASE WRITE - Free-Tier Optimization
     * Single transaction per round
     */
    private executeBatchedPayouts;
    /**
     * Reset for next round
     */
    resetForNextRound(): Promise<void>;
    getGameState(): any;
    /**
     * Get player-specific state (includes personal chip balance)
     */
    getPlayerState(userId: string): any;
    private getStatusMessage;
    getActiveSpotsCount(): number;
    getPlayerCount(): number;
    getConnectedPlayers(): PlayerInfo[];
}
export {};
//# sourceMappingURL=WarEngine.d.ts.map