import React, { useState } from 'react';
import { motion } from 'framer-motion';

const BettingControls = ({ onBet, minBet, balance, disabled }) => {
  const [amount, setAmount] = useState(minBet || 10);

  const handleBet = () => {
    if (amount > balance) {
      alert("Insufficient funds");
      return;
    }
    onBet(amount);
  };

  const chipValues = [10, 50, 100, 500, 1000];
  const chipColors = {
    10: 'bg-red-500',
    50: 'bg-blue-500',
    100: 'bg-green-600',
    500: 'bg-purple-600',
    1000: 'bg-yellow-500 text-black'
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/98 to-slate-900/95 border-t border-white/10 p-3 sm:p-4 backdrop-blur-md z-50 safe-area-bottom">
      <div className="max-w-2xl mx-auto">
        {/* Chip Selector */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4 overflow-x-auto pb-1">
          {chipValues.map(val => (
            <motion.button
              key={val}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAmount(val)}
              className={`
                w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center 
                font-bold text-xs sm:text-sm shadow-lg transition-all flex-shrink-0
                border-2 border-white/20
                ${chipColors[val] || 'bg-slate-600'}
                ${amount === val ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}
              `}
            >
              {val >= 1000 ? '1K' : val}
            </motion.button>
          ))}
        </div>

        {/* Bet Amount & Action */}
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 bg-black/30 rounded-xl px-4 py-2 border border-white/10">
            <div className="text-xs text-slate-400">Bet Amount</div>
            <div className="text-lg sm:text-2xl font-mono font-bold text-white">${amount}</div>
          </div>
          
          <motion.button
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            onClick={handleBet}
            disabled={disabled}
            className={`
              flex-1 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all
              ${disabled 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400 shadow-yellow-500/20'
              }
            `}
          >
            PLACE BET
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default BettingControls;
