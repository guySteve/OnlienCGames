/**
 * War Game Engine
 *
 * Implements the Casino War card game logic following the GameEngine architecture.
 * Supports multi-seat play where one player can occupy multiple seats.
 */
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
type Redis = any;
interface PlayerInfo {
    playerId: string;
    name: string;
    photo?: string;
    chips: number;
    color: string;
}
/**
 * War Game Engine - Multi-Spot Betting Implementation
 */
export declare class WarEngine extends GameEngine {
    private seats;
    private players;
    private houseCard;
    private deck;
    private bettingPhase;
    private observers;
    private gameSessionId;
    private playerSeed;
    private serverSeed;
    private tableCode;
    private isPrivate;
    private colorIndex;
    constructor(roomId: string, prisma: PrismaClient, redis: Redis, engagement: EngagementService, options?: {
        isPrivate?: boolean;
    });
    getGameType(): 'WAR' | 'BLACKJACK';
    /**
     * Get table code for private games
     */
    getTableCode(): string;
    /**
     * Check if game is waiting for more players
     */
    isWaitingForOpponent(): boolean;
    private createDeck;
    /**
     * Shuffle deck using dual-seed hashing (Provably Fair 2.0)
     * Combines player seed + server seed for verifiable randomness
     */
    private shuffleDeck;
    /**
     * Initialize game with QRNG entropy and player seed
     */
    initializeWithQRNG(playerSeed: string): Promise<void>;
    /**
     * Get the dual seeds for verification (public audit)
     */
    getDualSeeds(): {
        playerSeed: string;
        serverSeed: string;
    };
    private drawCard;
    /**
     * Join game as a player (assigns color, no seat required)
     */
    joinGame(playerId: string, name: string, photo: string | null, chips: number): {
        success: boolean;
        color: string;
        error?: string;
    };
    /**
     * Leave game - remove all bets and player info
     */
    leaveGame(playerId: string): {
        success: boolean;
    };
    /**
     * Get player info
     */
    getPlayer(playerId: string): PlayerInfo | null;
    /**
     * Update player chips
     */
    updatePlayerChips(playerId: string, chips: number): boolean;
    /**
     * Place bet on a specific spot
     */
    placeBet(playerId: string, amount: number, seatIndex: number, spotIndex: number): Promise<boolean>;
    /**
     * Remove bet from a specific spot
     */
    removeBet(playerId: string, seatIndex: number, spotIndex: number): boolean;
    /**
     * Check if any bets have been placed
     */
    hasActiveBets(): boolean;
    /**
     * Get all active betting spots
     */
    private getActiveSpots;
    startNewHand(): Promise<void>;
    /**
     * Resolve hand - Each betting spot plays against the dealer individually
     * Casino War Rules:
     * - Player wins: Pays 1:1 on bet
     * - Dealer wins: Player loses bet
     * - Tie: Player can surrender (lose half) or go to war (auto-push for simplicity)
     */
    resolveHand(): Promise<any>;
    /**
     * Reset for next round
     */
    resetForNextRound(): Promise<void>;
    getGameState(): any;
    private getStatusMessage;
    addObserver(socketId: string): void;
    removeObserver(socketId: string): void;
    getActiveBetsCount(): number;
    getPlayerCount(): number;
    static getMinBet(): number;
}
export {};
//# sourceMappingURL=WarEngine.d.ts.map