/**
 * LetItRideEngine.ts - Let It Ride Poker Game Engine
 *
 * Rules:
 * - Players make three equal bets
 * - Receive 3 cards, 2 community cards dealt face down
 * - Can pull back first two bets, final bet ($) must stay
 * - Minimum winning hand: Pair of 10s or better
 * - Payouts based on poker hand rankings
 */
import { GameEngine, GameConfig } from './GameEngine';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import { EventEmitter } from 'events';
type Redis = any;
export declare class LetItRideEngine extends GameEngine {
    private deck;
    private communityCards;
    private lirPlayers;
    private currentDecisionPhase;
    private readonly PAYOUT_TABLE;
    events: EventEmitter;
    constructor(config: GameConfig, prisma: PrismaClient, redis: Redis, engagement: EngagementService);
    getGameType(): 'WAR' | 'BLACKJACK' | 'BINGO';
    private initializeDeck;
    private shuffleDeck;
    private dealCard;
    placeBet(userId: string, amount: number, seatIndex?: number): Promise<boolean>;
    startNewHand(): Promise<void>;
    playerDecision(userId: string, seatIndex: number, decision: 'PULL_BACK' | 'LET_IT_RIDE', betNumber: 1 | 2): Promise<boolean>;
    resolveHand(): Promise<void>;
    private evaluateHand;
    private calculatePayout;
    private completeHand;
    getGameState(): any;
}
export {};
//# sourceMappingURL=LetItRideEngine.d.ts.map