// @/components/DealerAvatar.jsx
import React from 'react';
import { motion } from 'framer-motion';
import './DealerAvatar.css';

/**
 * DealerAvatar - Animated casino dealer character
 *
 * States:
 * - idle: Subtle breathing animation
 * - thinking: Hand gesture, contemplative
 * - dealing: Active dealing motion
 * - celebrating: Win animation
 * - sympathetic: Lose animation
 */
const DealerAvatar = ({ state = 'idle', name = 'Dealer', mood = 'neutral' }) => {
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

  return (
    <div className="dealer-avatar-container">
      <motion.div
        className={`dealer-avatar dealer-${state}`}
        animate={animations[state] || animations.idle}
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
