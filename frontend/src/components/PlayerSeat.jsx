import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from './Card';

const PlayerSeat = ({ seatIndex, seatData, isMySeat, onSit, onLeave }) => {
  const { empty, name, photo, chips, currentBet, card, hands } = seatData || {};

  // Position logic based on seat index (0-4)
  // 0: Left Bottom, 1: Left Top, 2: Center Top, 3: Right Top, 4: Right Bottom
  // This is handled by the parent container's absolute positioning, 
  // but we can add specific internal layouts if needed.

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full opacity-50 hover:opacity-100 transition-opacity">
        <button
          onClick={() => onSit(seatIndex)}
          className="w-16 h-16 rounded-full border-2 border-dashed border-yellow-500/50 flex items-center justify-center text-yellow-500 hover:bg-yellow-500/10 transition-colors"
        >
          <span className="text-2xl">+</span>
        </button>
        <span className="mt-2 text-xs text-yellow-500/70 font-mono">SIT HERE</span>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center ${isMySeat ? 'z-20' : 'z-10'}`}>
      {/* Avatar & Info */}
      <div className={`
        relative w-16 h-16 rounded-full border-2 overflow-hidden shadow-lg mb-2
        ${isMySeat ? 'border-yellow-400 ring-2 ring-yellow-400/30' : 'border-slate-500'}
      `}>
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-400">
            {name?.charAt(0)}
          </div>
        )}
      </div>

      {/* Name & Chips */}
      <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 text-center min-w-[100px]">
        <div className="text-xs font-bold text-white truncate max-w-[80px] mx-auto">{name}</div>
        <div className="text-xs text-yellow-400 font-mono">${chips}</div>
      </div>

      {/* Bet Display */}
      <AnimatePresence>
        {currentBet > 0 && (
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 20 }}
            className="absolute -top-12 flex flex-col items-center"
          >
            <div className="flex -space-x-1 mb-1">
              {/* Simplified Chip Stack Visualization */}
              <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-dashed border-white/20 shadow-sm" />
              {currentBet > 50 && <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-dashed border-white/20 shadow-sm" />}
              {currentBet > 100 && <div className="w-6 h-6 rounded-full bg-black border-2 border-dashed border-white/20 shadow-sm" />}
            </div>
            <span className="bg-black/50 px-2 rounded text-[10px] text-white font-mono">${currentBet}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards Area */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex space-x-[-20px]">
        <AnimatePresence>
          {/* Handle War (single card) or Blackjack (hands) */}
          {card && <Card key="war-card" {...card} index={0} />}
          {hands && hands.map((hand, hIdx) => (
             hand.cards.map((c, cIdx) => (
               <Card key={`${hIdx}-${cIdx}`} {...c} index={cIdx} />
             ))
          ))}
        </AnimatePresence>
      </div>
      
      {isMySeat && (
        <button 
          onClick={() => onLeave(seatIndex)}
          className="absolute -bottom-8 text-[10px] text-red-400 hover:text-red-300 underline"
        >
          Leave
        </button>
      )}
    </div>
  );
};

export default PlayerSeat;
