/**
 * DealerBrain.ts - AI-Powered Dealer Decision System
 *
 * Features:
 * - Optimal strategy calculations
 * - Personality-driven reactions
 * - Dynamic difficulty adjustment
 * - Engagement optimization
 *
 * Used by: Blackjack, War, Let It Ride
 */
import { EventEmitter } from 'events';
interface Card {
    rank: string;
    suit: string;
    value: number;
}
interface DealerPersonality {
    name: string;
    chattiness: number;
    empathy: number;
    competitiveness: number;
    riskTolerance: number;
}
interface GameContext {
    gameType: 'BLACKJACK' | 'WAR' | 'LET_IT_RIDE';
    dealerHand: Card[];
    playerHands: Card[][];
    pot: number;
    playerBankroll: number;
    handNumber: number;
    playerWinStreak: number;
}
export declare class DealerBrain extends EventEmitter {
    private personality;
    private emotionalState;
    private difficultyLevel;
    constructor(personalityPreset?: 'PROFESSIONAL' | 'FRIENDLY' | 'COMPETITIVE' | 'CASUAL');
    private loadPersonality;
    /**
     * Blackjack: Decide whether to hit or stand
     */
    blackjackDecision(context: GameContext): 'HIT' | 'STAND';
    /**
     * Calculate hand value for blackjack
     */
    private calculateHandValue;
    /**
     * Check if hand is soft (has usable ace)
     */
    private isSoftHand;
    /**
     * Generate dealer commentary based on context
     */
    generateCommentary(_context: GameContext, event: string): string | null;
    /**
     * Update emotional state based on game events
     */
    updateEmotion(context: GameContext): void;
    /**
     * Adjust difficulty dynamically based on player performance
     */
    adjustDifficulty(playerWinRate: number): void;
    /**
     * Recommend optimal player action (for hints/tutorial)
     */
    recommendAction(playerHand: Card[], dealerUpCard: Card, gameType: 'BLACKJACK'): {
        action: string;
        reasoning: string;
    };
    private recommendBlackjackAction;
    /**
     * Get current dealer state for UI
     */
    getState(): {
        personality: DealerPersonality;
        emotionalState: "neutral" | "happy" | "concerned" | "excited" | "sympathetic";
        difficultyLevel: number;
    };
    /**
     * Generate dealer avatar animation state
     */
    getAvatarState(): 'idle' | 'thinking' | 'dealing' | 'celebrating' | 'sympathetic';
}
export {};
//# sourceMappingURL=DealerBrain.d.ts.map