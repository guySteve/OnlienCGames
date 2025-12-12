// @/components/DealerAvatar.jsx
import React from 'react';
import { motion } from 'framer-motion';
import './DealerAvatar.css';

/**
 * DealerAvatar - Simple animated casino dealer
 *
 * Three gesture states:
 * - salute: Welcome gesture for new users
 * - dealing: Card dealing animation
 * - loser: L gesture when player loses
 */
const DealerAvatar = ({
  state = 'idle',
  name = 'Dealer'
}) => {
  const animations = {
    idle: {
      y: [0, -5, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      }
    },
    salute: {
      rotate: [-5, 0, -5],
      transition: {
        duration: 1.5,
        repeat: 2,
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
    loser: {
      rotate: [0, -15, 15, 0],
      scale: [1, 0.95, 1],
      transition: {
        duration: 1,
        repeat: 1
      }
    }
  };

  const moodEmojis = {
    idle: '😐',
    salute: '🫡',
    dealing: '😊',
    loser: '😬'
  };

  return (
    <div className="dealer-avatar-container">
      <motion.div
        className={`dealer-avatar dealer-${state}`}
        animate={animations[state] || animations.idle}
      >
        <div className="dealer-face">
          <span className="dealer-emoji">{moodEmojis[state] || moodEmojis.idle}</span>
        </div>
        <div className="dealer-body">
          <div className="dealer-suit"></div>
          <div className="dealer-hands"></div>
        </div>
      </motion.div>
      <div className="dealer-name">{name}</div>
    </div>
  );
};

export default DealerAvatar;
