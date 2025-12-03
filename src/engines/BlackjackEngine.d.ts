/**
 * Professional Blackjack Engine
 *
 * Rules:
 * - 6-deck shoe with 75% penetration
 * - Dealer stands on soft 17
 * - Blackjack pays 3:2
 * - Insurance pays 2:1
 * - Double down on any two cards
 * - Split pairs (up to 3 hands)
 */
import { GameEngine, GameConfig } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
type Redis = any;
interface Card {
    rank: string;
    suit: string;
    value: number;
}
export declare class BlackjackEngine extends GameEngine {
    private shoe;
    private cutCardPosition;
    private currentShoePosition;
    private dealerHand;
    private bjPlayers;
    private currentPlayerIndex;
    private readonly DECKS;
    private readonly PENETRATION;
    private readonly BLACKJACK_PAYOUT;
    private readonly INSURANCE_PAYOUT;
    private playerSeed;
    private serverSeed;
    constructor(config: GameConfig, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    getGameType(): 'WAR' | 'BLACKJACK';
    private initializeShoe;
    private shuffleShoe;
    /**
     * Fetch external entropy from Cloudflare's QRNG service
     */
    private fetchQRNGEntropy;
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
    private dealCard;
    private calculateHandValue;
    private isBlackjack;
    private isSoftHand;
    placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean>;
    startNewHand(): Promise<void>;
    /**
     * Player actions: HIT, STAND, DOUBLE, SPLIT, INSURANCE
     */
    playerAction(userId: string, seatIndex: number, action: 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'INSURANCE', insuranceAmount?: number): Promise<{
        success: boolean;
        newCard?: Card;
        handValue?: number;
        busted?: boolean;
    }>;
    private moveToNextPlayer;
    private dealerPlay;
    private resolveDealerBlackjack;
    resolveHand(): Promise<void>;
    private completeHand;
    getGameState(): any;
}
export {};
//# sourceMappingURL=BlackjackEngine.d.ts.map