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

  return (
    <Tilt
      tiltMaxAngleX={8}
      tiltMaxAngleY={8}
      scale={1.02}
      transitionSpeed={300}
      perspective={1000}
      glareEnable={true}
      glareMaxOpacity={0.1}
      glareColor="white"
      glarePosition="all"
      className="relative aspect-[3/4] max-w-sm"
    >
      <motion.div
        variants={cardVariants}
        layout
        className="w-full h-full rounded-3xl border border-white/10 bg-slate-900/50 p-6 flex flex-col justify-end overflow-hidden transition-all duration-300"
        onHoverStart={() => SoundManager.play('UI_HOVER')}
        onClick={() => onClick(game.id)}
      >
        {/* 3D-transformed content */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={twMerge(
            'w-full h-full absolute inset-0 rounded-3xl bg-gradient-to-t transition-shadow duration-300',
            styles.gradient,
            styles.borderColor,
            styles.shadow
          )}
        >
          {/* Placeholder for game image */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="text-9xl">
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
          <p className={twMerge("font-black text-4xl", styles.titleColor)}>{game.name}</p>
          <p className="text-slate-400 text-sm mt-1">{game.description}</p>
          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 bg-black/30 text-white/60 px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{game.players} playing</span>
            </div>
            <div className="bg-black/30 text-white/60 px-2 py-1 rounded-full">
              Min Bet: ${game.minBet}
            </div>
          </div>
        </div>
      </motion.div>
    </Tilt>
  );
}
