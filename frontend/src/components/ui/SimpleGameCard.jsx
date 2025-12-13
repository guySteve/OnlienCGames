// Simplified game card - more inviting, clickable
import React from 'react';
import { motion } from 'framer-motion';

export function SimpleGameCard({ game, onClick }) {
  const handleClick = () => {
    console.log('🎯 [SimpleGameCard] CLICKED:', game.name, game.id);
    if (!game.disabled) {
      onClick(game.id);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={game.disabled}
      className="group relative w-full max-w-xs"
      whileHover={{ scale: game.disabled ? 1 : 1.02 }}
      whileTap={{ scale: game.disabled ? 1 : 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Card Container */}
      <div
        className={`
          relative overflow-hidden rounded-2xl border-2
          ${game.disabled
            ? 'border-slate-700 bg-slate-900/50 cursor-not-allowed opacity-50'
            : 'border-emerald-500/30 bg-gradient-to-br from-slate-800 to-slate-900 cursor-pointer hover:border-emerald-400/60'
          }
          transition-all duration-300 shadow-lg hover:shadow-emerald-500/20
        `}
      >
        {/* Glow effect on hover */}
        {!game.disabled && (
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}

        {/* Content */}
        <div className="relative p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-4">
            {game.type === 'WAR' ? '⚔️' : game.type === 'BLACKJACK' ? '🃏' : '🎲'}
          </div>

          {/* Title */}
          <h3 className={`text-2xl font-bold mb-2 ${game.disabled ? 'text-slate-500' : 'text-white'}`}>
            {game.name}
          </h3>

          {/* Description */}
          <p className="text-slate-400 text-sm mb-4">
            {game.description}
          </p>

          {/* Status Badge */}
          {game.disabled ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <span className="text-amber-400 text-sm font-semibold">Coming Soon</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-400 text-sm font-semibold">Enter Room</span>
            </div>
          )}

          {/* Min Bet */}
          {!game.disabled && (
            <div className="mt-3 text-slate-500 text-xs">
              Min bet: ${game.minBet}
            </div>
          )}
        </div>

        {/* Door frame effect */}
        {!game.disabled && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
          </div>
        )}
      </div>
    </motion.button>
  );
}
