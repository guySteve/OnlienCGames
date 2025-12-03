import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ rank, suit, hidden, index, compact, micro, large }) => {
  const isRed = suit === '♥' || suit === '♦';
  
  // Size classes based on variant
  const sizeClasses = micro 
    ? 'w-8 h-11' 
    : compact 
      ? 'w-10 h-14 sm:w-12 sm:h-16' 
      : large 
        ? 'w-20 h-28 sm:w-24 sm:h-36' 
        : 'w-14 h-20 sm:w-16 sm:h-24';
  
  const textSizeClasses = micro
    ? 'text-[8px]'
    : compact
      ? 'text-xs sm:text-sm'
      : large
        ? 'text-xl sm:text-2xl'
        : 'text-base sm:text-lg';
  
  const suitSizeClasses = micro
    ? 'text-[10px]'
    : compact
      ? 'text-sm sm:text-base'
      : large
        ? 'text-2xl sm:text-3xl'
        : 'text-lg sm:text-xl';
  
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: -30 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`
        relative ${sizeClasses} rounded-lg shadow-xl border-2 border-white/10
        flex items-center justify-center select-none
        ${hidden 
          ? 'bg-gradient-to-br from-blue-800 to-blue-950' 
          : 'bg-gradient-to-br from-white to-gray-100'
        }
      `}
    >
      {hidden ? (
        <div className="w-full h-full rounded-md border border-dashed border-blue-400/30 flex items-center justify-center p-1">
          <div className="w-full h-full rounded bg-blue-900/50 flex items-center justify-center">
            <span className={`${micro ? 'text-xs' : compact ? 'text-base' : large ? 'text-3xl' : 'text-xl'} text-blue-300/50`}>♠</span>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col items-center ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
          <span className={`${textSizeClasses} font-bold leading-none`}>{rank}</span>
          <span className={`${suitSizeClasses} leading-none`}>{suit}</span>
        </div>
      )}
    </motion.div>
  );
};

export default Card;
