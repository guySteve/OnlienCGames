// @/components/DealerAvatar.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DealerAvatar.css';

/**
 * DealerAvatar - ENHANCED Animated casino dealer character
 *
 * States:
 * - idle: Subtle breathing animation
 * - thinking: Hand gesture, contemplative
 * - dealing: Active dealing motion
 * - celebrating: Win animation
 * - sympathetic: Lose animation
 * 
 * NEW FEATURES:
 * - Interactive click to hear voice lines
 * - Speech bubbles with dynamic messages
 * - Reactive to game events via dealerEmotion prop
 */
const DealerAvatar = ({ 
  state = 'idle', 
  name = 'Dealer', 
  mood = 'neutral',
  dealerEmotion = null,
  onInteract = null
}) => {
  const [speechBubble, setSpeechBubble] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const animations = {
    idle: {
      y: [0, -5, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    },
    thinking: {
      rotate: [-2, 2, -2],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    },
    dealing: {
      x: [-10, 10, -10],
      transition: {
        duration: 0.6,
        repeat: 3,
        ease: 'easeInOut'
      }
    },
    celebrating: {
      scale: [1, 1.1, 1],
      rotate: [0, -10, 10, 0],
      transition: {
        duration: 0.8,
        repeat: 2
      }
    },
    sympathetic: {
      y: [0, 5, 0],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 1.2,
        repeat: 1
      }
    }
  };

  const moodEmojis = {
    neutral: '😐',
    happy: '😊',
    excited: '🎉',
    sympathetic: '😔',
    focused: '🧐'
  };

  // Voice lines for different game states
  const voiceLines = {
    idle: ["Place your bets!", "Good luck!", "Ready when you are!"],
    dealing: ["Here we go!", "Let's see what happens!", "Cards are flying!"],
    celebrating: ["House wins!", "Better luck next time!", "The house always has an edge!"],
    sympathetic: ["Oh, tough break!", "Don't worry, next hand's yours!", "Happens to the best!"],
    thinking: ["Hmm, interesting...", "Let me check...", "One moment please..."]
  };

  // Handle dealer click - play random voice line
  const handleDealerClick = () => {
    const lines = voiceLines[state] || voiceLines.idle;
    const randomLine = lines[Math.floor(Math.random() * lines.length)];
    setSpeechBubble(randomLine);
    
    // Clear speech bubble after 3 seconds
    setTimeout(() => setSpeechBubble(null), 3000);
    
    // Trigger Web Speech API if available
    if (window.speechSynthesis && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(randomLine);
      utterance.rate = 1.1;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    }
    
    if (onInteract) {
      onInteract(randomLine);
    }
  };

  return (
    <div className="dealer-avatar-container">
      {/* Speech Bubble */}
      <AnimatePresence>
        {speechBubble && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className="dealer-speech-bubble"
          >
            {speechBubble}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={`dealer-avatar dealer-${state} ${isHovered ? 'dealer-hover' : ''}`}
        animate={animations[state] || animations.idle}
        onClick={handleDealerClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.05 }}
        style={{ cursor: 'pointer' }}
      >
        <div className="dealer-face">
          <span className="dealer-emoji">{moodEmojis[mood]}</span>
        </div>
        <div className="dealer-body">
          <div className="dealer-suit"></div>
          <div className="dealer-hands"></div>
        </div>
      </motion.div>
      <div className="dealer-name">{name}</div>
      <div className="dealer-status">
        {state === 'idle' && 'Waiting for bets...'}
        {state === 'thinking' && 'Checking hand...'}
        {state === 'dealing' && 'Dealing cards...'}
        {state === 'celebrating' && 'House wins!'}
        {state === 'sympathetic' && 'Better luck next time!'}
      </div>
    </div>
  );
};

export default DealerAvatar;
