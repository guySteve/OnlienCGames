import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ rank, suit, hidden, index }) => {
  const isRed = suit === '♥' || suit === '♦';
  
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: -50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`
        relative w-16 h-24 rounded-lg shadow-xl border-2 border-white/10
        flex items-center justify-center select-none
        ${hidden 
          ? 'bg-blue-900 bg-opacity-90' 
          : 'bg-white'
        }
      `}
    >
      {hidden ? (
        <div className="w-full h-full rounded-md border-2 border-dashed border-blue-400/30 flex items-center justify-center">
          <span className="text-2xl">♠</span>
        </div>
      ) : (
        <div className={`flex flex-col items-center ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
          <span className="text-xl font-bold">{rank}</span>
          <span className="text-2xl">{suit}</span>
        </div>
      )}
    </motion.div>
  );
};

export default Card;
