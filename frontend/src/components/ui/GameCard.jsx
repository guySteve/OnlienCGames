// @/components/ui/GameCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import { SoundManager } from '../../lib/SoundManager';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const gameStyles = {
  WAR: {
    gradient: 'from-red-500/30 via-red-500/10 to-transparent',
    borderColor: 'hover:border-red-500/80',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.5)]',
    titleColor: 'text-red-400',
  },
  BLACKJACK: {
    gradient: 'from-emerald-500/30 via-emerald-500/10 to-transparent',
    borderColor: 'hover:border-emerald-400/80',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(52,211,153,0.5)]',
    titleColor: 'text-emerald-300',
  },
  BINGO: {
    gradient: 'from-purple-500/30 via-purple-500/10 to-transparent',
    borderColor: 'hover:border-purple-400/80',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]',
    titleColor: 'text-purple-300',
  },
  'LET IT RIDE': {
    gradient: 'from-cyan-500/30 via-cyan-500/10 to-transparent',
    borderColor: 'hover:border-cyan-400/80',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)]',
    titleColor: 'text-cyan-300',
  },
  DEFAULT: {
    gradient: 'from-slate-500/30 via-slate-500/10 to-transparent',
    borderColor: 'hover:border-slate-400/80',
    shadow: 'hover:shadow-[0_0_30px_-5px_rgba(156,163,175,0.5)]',
    titleColor: 'text-slate-300',
  }
};

export function GameCard({ game, onClick }) {
  const styles = gameStyles[game.type] || gameStyles.DEFAULT;

  const cardVariants = {
    initial: { opacity: 0, y: 30, scale: 0.95 },
    in: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -30, scale: 0.95 },
  };

  const handleClick = () => {
    if (!game.disabled) {
      onClick(game.id);
    }
  };

  return (
    <Tilt
      tiltMaxAngleX={game.disabled ? 0 : 8}
      tiltMaxAngleY={game.disabled ? 0 : 8}
      scale={game.disabled ? 1 : 1.02}
      transitionSpeed={300}
      perspective={1000}
      glareEnable={!game.disabled}
      glareMaxOpacity={0.1}
      glareColor="white"
      glarePosition="all"
      className="relative aspect-[3/4] max-w-[240px]"
    >
      <motion.div
        variants={cardVariants}
        layout
        className={twMerge(
          "w-full h-full rounded-squircle-lg border border-white/10 bg-slate-900/50 p-6 flex flex-col justify-end overflow-hidden transition-all duration-300",
          game.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        )}
        onHoverStart={() => !game.disabled && SoundManager.play('UI_HOVER')}
        onClick={handleClick}
      >
        {/* 3D-transformed content */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={twMerge(
            'w-full h-full absolute inset-0 rounded-squircle-lg bg-gradient-to-t transition-shadow duration-300 animate-pulse-resting',
            styles.gradient,
            styles.borderColor,
            styles.shadow
          )}
        >
          {/* Placeholder for game image */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="text-7xl">
              {game.type === 'WAR' ? '⚔️' : game.type === 'BLACKJACK' ? '🃏' : game.type === 'BINGO' ? '🎱' : '🎲'}
            </div>
          </div>

          {/* Glossy overlay */}
          <div
            className="absolute inset-0 w-full h-full opacity-0 hover:opacity-10 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 60%)',
              transform: 'rotate(-45deg) scale(1.5)',
            }}
          />
        </motion.div>

        {/* Text content (remains flat) */}
        <div className="relative z-10" style={{ textShadow: '0px 1px 10px rgba(0,0,0,0.5)'}}>
          <p className={twMerge("font-black text-2xl", styles.titleColor)}>{game.name}</p>
          <p className="text-slate-400 text-xs mt-1">{game.description}</p>
          <div className="mt-4 flex items-center justify-between text-xs">
            {!game.disabled ? (
              <>
                <div className="flex items-center gap-1.5 bg-black/30 text-emerald-400/80 px-2 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Available</span>
                </div>
                <div className="bg-black/30 text-white/60 px-2 py-1 rounded-full">
                  Min: ${game.minBet}
                </div>
              </>
            ) : (
              <div className="bg-black/30 text-amber-400/80 px-2 py-1 rounded-full">
                Coming Soon
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Tilt>
  );
}
