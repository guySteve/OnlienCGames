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
  chattiness: number; // 0-1
  empathy: number; // 0-1
  competitiveness: number; // 0-1
  riskTolerance: number; // 0-1
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

export class DealerBrain extends EventEmitter {
  private personality: DealerPersonality;
  private emotionalState: 'neutral' | 'happy' | 'concerned' | 'excited' | 'sympathetic';
  private difficultyLevel: number; // 0-1, affects strategy variations

  constructor(personalityPreset: 'PROFESSIONAL' | 'FRIENDLY' | 'COMPETITIVE' | 'CASUAL' = 'PROFESSIONAL') {
    super();
    this.personality = this.loadPersonality(personalityPreset);
    this.emotionalState = 'neutral';
    this.difficultyLevel = 0.5;
  }

  private loadPersonality(preset: string): DealerPersonality {
    const personalities: Record<string, DealerPersonality> = {
      PROFESSIONAL: {
        name: 'Professional Dealer',
        chattiness: 0.3,
        empathy: 0.5,
        competitiveness: 0.4,
        riskTolerance: 0.3
      },
      FRIENDLY: {
        name: 'Friendly Dealer',
        chattiness: 0.8,
        empathy: 0.9,
        competitiveness: 0.2,
        riskTolerance: 0.5
      },
      COMPETITIVE: {
        name: 'High Roller Dealer',
        chattiness: 0.4,
        empathy: 0.2,
        competitiveness: 0.9,
        riskTolerance: 0.7
      },
      CASUAL: {
        name: 'Casual Dealer',
        chattiness: 0.6,
        empathy: 0.7,
        competitiveness: 0.3,
        riskTolerance: 0.6
      }
    };

    return personalities[preset] || personalities.PROFESSIONAL;
  }

  /**
   * Blackjack: Decide whether to hit or stand
   */
  public blackjackDecision(context: GameContext): 'HIT' | 'STAND' {
    const dealerValue = this.calculateHandValue(context.dealerHand);
    const isSoft = this.isSoftHand(context.dealerHand);

    // Standard casino rules with personality variations
    if (dealerValue < 17) {
      this.emotionalState = 'neutral';
      this.emit('decision', { action: 'HIT', reason: 'under_17' });
      return 'HIT';
    }

    if (dealerValue === 17 && isSoft) {
      // Standard: Hit on soft 17
      // Competitive dealers might be more aggressive
      const shouldHit = this.personality.competitiveness > 0.7
        ? Math.random() < 0.9 // 90% hit
        : true; // Always hit

      this.emotionalState = 'neutral';
      this.emit('decision', {
        action: shouldHit ? 'HIT' : 'STAND',
        reason: 'soft_17'
      });
      return shouldHit ? 'HIT' : 'STAND';
    }

    this.emotionalState = dealerValue >= 19 ? 'excited' : 'neutral';
    this.emit('decision', { action: 'STAND', reason: 'strong_hand' });
    return 'STAND';
  }

  /**
   * Calculate hand value for blackjack
   */
  private calculateHandValue(cards: Card[]): number {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.rank === 'A') {
        aces++;
        total += 11;
      } else {
        total += card.value;
      }
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  /**
   * Check if hand is soft (has usable ace)
   */
  private isSoftHand(cards: Card[]): boolean {
    const hasAce = cards.some(c => c.rank === 'A');
    if (!hasAce) return false;

    const total = this.calculateHandValue(cards);
    return total <= 21 && cards.some(c => c.rank === 'A');
  }

  /**
   * Generate dealer commentary based on context
   */
  public generateCommentary(context: GameContext, event: string): string | null {
    if (Math.random() > this.personality.chattiness) {
      return null; // Silent dealers talk less
    }

    const comments: Record<string, string[]> = {
      DEALER_BLACKJACK: [
        "Blackjack! House wins.",
        "Twenty-one for the dealer!",
        "That's how it's done."
      ],
      PLAYER_BLACKJACK: [
        "Blackjack! Nice hand.",
        "Twenty-one! Well played.",
        "Excellent hand, congratulations!"
      ],
      DEALER_BUST: [
        "Busted. Players win.",
        "Too much. You win this one.",
        "Congratulations, I went over."
      ],
      PLAYER_BUST: [
        "Busted. Better luck next time.",
        "Too many cards.",
        "Close one, but no cigar."
      ],
      PLAYER_WIN_STREAK: [
        "You're on fire today!",
        "Impressive winning streak.",
        "The cards are with you tonight."
      ],
      PLAYER_BIG_BET: [
        "Now we're talking! High stakes.",
        "Bold move. Let's see how it plays.",
        "Big bet, big risk, big reward!"
      ],
      HAND_START: [
        "Good luck!",
        "Let's play.",
        "Cards coming out."
      ]
    };

    // Adjust based on empathy
    if (event === 'PLAYER_BUST' && this.personality.empathy > 0.7) {
      return "Almost had it! You'll get the next one.";
    }

    if (event === 'DEALER_BUST' && this.personality.competitiveness < 0.3) {
      return "Nice win! The cards were in your favor.";
    }

    const options = comments[event] || [];
    return options.length > 0
      ? options[Math.floor(Math.random() * options.length)]
      : null;
  }

  /**
   * Update emotional state based on game events
   */
  public updateEmotion(context: GameContext): void {
    // Track player success
    if (context.playerWinStreak >= 3) {
      this.emotionalState = this.personality.competitiveness > 0.7
        ? 'concerned'
        : 'happy';
    } else if (context.playerWinStreak < 0) {
      this.emotionalState = this.personality.empathy > 0.7
        ? 'sympathetic'
        : 'neutral';
    } else {
      this.emotionalState = 'neutral';
    }

    // Big pot excitement
    if (context.pot > context.playerBankroll * 0.2) {
      this.emotionalState = 'excited';
    }

    this.emit('emotionChanged', { state: this.emotionalState });
  }

  /**
   * Adjust difficulty dynamically based on player performance
   */
  public adjustDifficulty(playerWinRate: number): void {
    // Keep game engaging - if player winning too much, slightly increase difficulty
    // If losing too much, slightly decrease difficulty
    if (playerWinRate > 0.65) {
      this.difficultyLevel = Math.min(1, this.difficultyLevel + 0.05);
    } else if (playerWinRate < 0.35) {
      this.difficultyLevel = Math.max(0, this.difficultyLevel - 0.05);
    }

    this.emit('difficultyAdjusted', { level: this.difficultyLevel });
  }

  /**
   * Recommend optimal player action (for hints/tutorial)
   */
  public recommendAction(
    playerHand: Card[],
    dealerUpCard: Card,
    gameType: 'BLACKJACK'
  ): { action: string; reasoning: string } {
    if (gameType === 'BLACKJACK') {
      return this.recommendBlackjackAction(playerHand, dealerUpCard);
    }

    return { action: 'STAND', reasoning: 'No recommendation available' };
  }

  private recommendBlackjackAction(
    playerHand: Card[],
    dealerUpCard: Card
  ): { action: string; reasoning: string } {
    const playerValue = this.calculateHandValue(playerHand);
    const dealerValue = dealerUpCard.value;

    // Basic strategy
    if (playerValue >= 17) {
      return { action: 'STAND', reasoning: 'Strong hand, risk of busting' };
    }

    if (playerValue <= 11) {
      return { action: 'HIT', reasoning: 'Cannot bust, safe to hit' };
    }

    if (playerValue >= 12 && playerValue <= 16) {
      if (dealerValue >= 7) {
        return { action: 'HIT', reasoning: 'Dealer showing strong card' };
      } else {
        return { action: 'STAND', reasoning: 'Dealer likely to bust' };
      }
    }

    return { action: 'STAND', reasoning: 'Default safe play' };
  }

  /**
   * Get current dealer state for UI
   */
  public getState() {
    return {
      personality: this.personality,
      emotionalState: this.emotionalState,
      difficultyLevel: this.difficultyLevel
    };
  }

  /**
   * Generate dealer avatar animation state
   */
  public getAvatarState(): 'idle' | 'thinking' | 'dealing' | 'celebrating' | 'sympathetic' {
    switch (this.emotionalState) {
      case 'excited': return 'celebrating';
      case 'sympathetic': return 'sympathetic';
      case 'concerned': return 'thinking';
      default: return 'idle';
    }
  }
}
