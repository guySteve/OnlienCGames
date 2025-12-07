/**
 * GameInstructions.jsx - Universal "How to Play" Modal
 *
 * USAGE:
 * <GameInstructions
 *   gameType="LET_IT_RIDE" | "WAR" | "BLACKJACK" | "BINGO"
 *   isOpen={true}
 *   onClose={() => {}}
 * />
 *
 * FEATURES:
 * - Reusable modal component for all games
 * - Pre-filled instruction content
 * - Responsive overlay design
 * - Animation support
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// GAME INSTRUCTIONS DATABASE
// ============================================================================

const GAME_INSTRUCTIONS = {
  LET_IT_RIDE: {
    title: "How to Play Let It Ride",
    icon: "🎰",
    sections: [
      {
        heading: "Objective",
        content: "Get a poker hand of a pair of 10s or better to win."
      },
      {
        heading: "How to Play",
        content: "1. Place three equal bets in circles 1, 2, and $\n2. Receive three cards, two community cards dealt face down\n3. After seeing your first 3 cards, decide to 'Let It Ride' or pull back bet #1\n4. Dealer reveals first community card\n5. Decide to 'Let It Ride' or pull back bet #2\n6. Dealer reveals final community card\n7. Bet #3 (marked $) must stay - cannot be pulled back"
      },
      {
        heading: "Winning Hands",
        content: "• Royal Flush: 1000:1\n• Straight Flush: 200:1\n• Four of a Kind: 50:1\n• Full House: 11:1\n• Flush: 8:1\n• Straight: 5:1\n• Three of a Kind: 3:1\n• Two Pair: 2:1\n• Pair of 10s or Better: 1:1"
      },
      {
        heading: "Strategy Tip",
        content: "Pull back your first bet unless you have a paying hand, three to a royal flush, or three suited cards in sequence."
      }
    ]
  },
  WAR: {
    title: "How to Play Casino War",
    icon: "⚔️",
    sections: [
      {
        heading: "Objective",
        content: "Draw a higher card than the dealer to win."
      },
      {
        heading: "How to Play",
        content: "1. Place your bet in the betting circle\n2. Dealer deals one card face-up to you and one to themselves\n3. Higher card wins (Ace is highest)\n4. If you win, you get paid 1:1\n5. If dealer wins, you lose your bet"
      },
      {
        heading: "War (Tie)",
        content: "If cards tie:\n• Option 1: Surrender and lose half your bet\n• Option 2: Go to WAR - place additional bet equal to original\n• Dealer burns 3 cards, then deals one card to each\n• If you win or tie the war, you win 1:1 on the war bet\n• If dealer wins the war, you lose both bets"
      },
      {
        heading: "Strategy Tip",
        content: "Always go to War on ties. Surrendering gives the house a higher edge."
      }
    ]
  },
  BLACKJACK: {
    title: "How to Play Blackjack",
    icon: "🃏",
    sections: [
      {
        heading: "Objective",
        content: "Get a hand value closer to 21 than the dealer without going over."
      },
      {
        heading: "Card Values",
        content: "• Number cards (2-10): Face value\n• Face cards (J, Q, K): 10\n• Ace: 1 or 11 (your choice)"
      },
      {
        heading: "How to Play",
        content: "1. Place your bet\n2. Receive two cards face-up\n3. Dealer gets one card face-up, one face-down\n4. Choose your action: Hit, Stand, Double, or Split\n5. Dealer reveals hole card and plays (hits on soft 17)\n6. Compare hands - closest to 21 wins"
      },
      {
        heading: "Actions",
        content: "• HIT: Take another card\n• STAND: Keep your current hand\n• DOUBLE: Double your bet, receive exactly one more card\n• SPLIT: If you have a pair, split into two hands (requires additional bet)"
      },
      {
        heading: "Blackjack",
        content: "Ace + 10-value card on first two cards = Blackjack!\nPays 3:2 (unless dealer also has blackjack = push)"
      },
      {
        heading: "Insurance",
        content: "If dealer shows an Ace, you can buy insurance (side bet up to half your original bet). Pays 2:1 if dealer has blackjack."
      }
    ]
  },
  BINGO: {
    title: "How to Play Bingo",
    icon: "🎱",
    sections: [
      {
        heading: "Objective",
        content: "Complete a pattern on your bingo card before other players."
      },
      {
        heading: "How to Play",
        content: "1. Purchase one or more bingo cards\n2. Numbers are called randomly\n3. Mark matching numbers on your card(s)\n4. First player to complete the pattern wins\n5. Call BINGO to claim your win"
      },
      {
        heading: "Patterns",
        content: "• Line: Complete any horizontal, vertical, or diagonal line\n• Four Corners: Mark all four corner squares\n• Blackout: Mark every square on the card\n• Custom: Pattern shown at game start"
      },
      {
        heading: "Tips",
        content: "• Play multiple cards to increase winning chances\n• Stay focused - missing a number could cost you\n• Free space in center is automatically marked"
      }
    ]
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const GameInstructions = ({ gameType, isOpen, onClose }) => {
  const instructions = GAME_INSTRUCTIONS[gameType];

  if (!instructions) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />

          {/* Modal - SAFE-ZONE ENFORCED */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ pointerEvents: 'none' }}
          >
            <div 
              className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full border border-white/10 flex flex-col"
              style={{
                maxWidth: '600px',
                maxHeight: '85vh',
                pointerEvents: 'auto'
              }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{instructions.icon}</span>
                  <h2 className="text-2xl font-bold text-white">
                    {instructions.title}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-amber-200 transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              {/* Content - SCROLL ENABLED */}
              <div 
                className="p-6 overflow-y-auto custom-scrollbar flex-1"
                style={{
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                {instructions.sections.map((section, index) => (
                  <div key={index} className="mb-6 last:mb-0">
                    <h3 className="text-xl font-bold text-amber-400 mb-2">
                      {section.heading}
                    </h3>
                    <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="bg-slate-800/50 px-6 py-4 flex justify-end border-t border-white/10">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GameInstructions;
