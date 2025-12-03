/**
 * War Game Engine
 *
 * Implements the Casino War card game logic following the GameEngine architecture.
 * Supports multi-seat play where one player can occupy multiple seats.
 */
import { GameEngine } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EngagementService } from '../services/EngagementService';
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
/**
 * War Game Engine - Modular implementation
 */
export declare class WarEngine extends GameEngine {
    private seats;
    private houseCard;
    private deck;
    private bettingPhase;
    private observers;
    private gameSessionId;
    private playerSeed;
    private serverSeed;
    constructor(roomId: string, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    getGameType(): 'WAR' | 'BLACKJACK';
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
     * Sit player at specific seat
     */
    sitAtSeat(socketId: string, seatIndex: number, name: string, photo: string | null, chips: number): {
        success: boolean;
        error?: string;
    };
    /**
     * Leave seat
     */
    leaveSeat(socketId: string, seatIndex?: number): {
        success: boolean;
        seatIndex?: number;
    };
    placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean>;
    /**
     * Check if all seated players have placed bets
     */
    allSeatedReady(): boolean;
    startNewHand(): Promise<void>;
    resolveHand(): Promise<any>;
    /**
     * Reset for next round
     */
    resetForNextRound(): Promise<void>;
    getGameState(): WarGameState;
    private getStatusMessage;
    addObserver(socketId: string): void;
    removeObserver(socketId: string): void;
    getSeatedCount(): number;
    getPlayerBySeat(seatIndex: number): Seat | null;
    getPlayerBySocket(socketId: string): {
        seat: Seat;
        seatIndex: number;
    } | null;
    static getMinBet(): number;
}
export {};
//# sourceMappingURL=WarEngine.d.ts.map