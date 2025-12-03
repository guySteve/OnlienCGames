import React, { useState } from 'react';

const BettingControls = ({ onBet, minBet, balance, disabled }) => {
  const [amount, setAmount] = useState(minBet || 10);

  const handleBet = () => {
    if (amount > balance) {
      alert("Insufficient funds");
      return;
    }
    onBet(amount);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 border-t border-white/10 p-4 backdrop-blur-md z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        
        {/* Chip Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {[10, 50, 100, 500, 1000].map(val => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`
                w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-lg transition-transform hover:scale-110
                ${amount === val ? 'ring-2 ring-white scale-110' : ''}
                ${val === 10 ? 'bg-red-600 border-white/20' : ''}
                ${val === 50 ? 'bg-blue-600 border-white/20' : ''}
                ${val === 100 ? 'bg-black border-white/20' : ''}
                ${val === 500 ? 'bg-purple-600 border-white/20' : ''}
                ${val === 1000 ? 'bg-yellow-500 border-white/20 text-black' : ''}
              `}
            >
              {val}
            </button>
          ))}
        </div>

        {/* Action Area */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-xs text-slate-400">BET AMOUNT</span>
            <span className="text-xl font-mono font-bold text-white">${amount}</span>
          </div>
          
          <button
            onClick={handleBet}
            disabled={disabled}
            className={`
              px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-all
              ${disabled 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-400 hover:shadow-yellow-500/20'
              }
            `}
          >
            PLACE BET
          </button>
        </div>
      </div>
    </div>
  );
};

export default BettingControls;
