/**
 * BettingControls.jsx - VegasCore 2.0 Fitts's Law Optimized
 * 
 * Cognitive Ergonomics:
 * - Primary actions (Hit/Deal/Bet) positioned in bottom-right "Thumb Zone"
 * - Secondary/destructive actions (Fold/Surrender) positioned top-left (harder to reach = safety)
 * - Quick bet buttons replace sliders for faster input
 * - Custom numpad overlay for precise amounts
 * - Safe area inset support for notched devices
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BettingControls = ({ 
  onBet, 
  onHit, 
  onStand, 
  onDouble, 
  onFold, 
  onSurrender,
  minBet = 10, 
  balance = 1000, 
  pot = 0,
  disabled = false,
  phase = 'betting', // 'betting' | 'playing' | 'waiting'
  gameType = 'blackjack',
  armedCursorMode = false, // NEW: Enable "tap on spot to place" mode
  onCursorValueChange = null // NEW: Callback when cursor value changes
}) => {
  const [amount, setAmount] = useState(minBet || 10);
  const [showNumpad, setShowNumpad] = useState(false);
  
  // Notify parent when cursor value changes (for "Armed Cursor" mode)
  const updateCursorValue = useCallback((newValue) => {
    setAmount(newValue);
    if (armedCursorMode && onCursorValueChange) {
      onCursorValueChange(newValue);
    }
  }, [armedCursorMode, onCursorValueChange]);

  // Quick bet calculations
  const quickBets = [
    { label: 'MIN', value: minBet },
    { label: '½ POT', value: Math.floor(pot / 2) || minBet },
    { label: 'POT', value: pot || minBet * 2 },
    { label: 'ALL IN', value: balance }
  ].filter(bet => bet.value <= balance && bet.value >= minBet);

  const chipValues = [10, 25, 50, 100, 500, 1000];
  const chipColors = {
    10: 'bg-gradient-to-br from-red-500 to-red-700',
    25: 'bg-gradient-to-br from-green-500 to-green-700',
    50: 'bg-gradient-to-br from-blue-500 to-blue-700',
    100: 'bg-gradient-to-br from-slate-800 to-slate-900 text-white',
    500: 'bg-gradient-to-br from-purple-500 to-purple-700',
    1000: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black'
  };

  const handleBet = useCallback(() => {
    if (amount > balance) {
      // Could trigger a shake animation instead of alert
      return;
    }
    onBet?.(amount);
  }, [amount, balance, onBet]);

  const handleNumpadInput = useCallback((digit) => {
    if (digit === 'clear') {
      setAmount(minBet);
    } else if (digit === 'back') {
      setAmount(prev => {
        const newVal = Math.floor(prev / 10);
        return newVal >= minBet ? newVal : minBet;
      });
    } else {
      setAmount(prev => {
        const newVal = prev * 10 + digit;
        return newVal <= balance ? newVal : prev;
      });
    }
  }, [minBet, balance]);

  const handleChipAdd = useCallback((chipValue) => {
    const newVal = Math.min(amount + chipValue, balance);
    updateCursorValue(newVal);
  }, [amount, balance, updateCursorValue]);
  
  // NEW: Value modifiers for "Armed Cursor" mode
  const handleHalve = useCallback(() => {
    const newVal = Math.max(Math.floor(amount / 2), minBet);
    updateCursorValue(newVal);
  }, [amount, minBet, updateCursorValue]);
  
  const handleDouble = useCallback(() => {
    const newVal = Math.min(amount * 2, balance);
    updateCursorValue(newVal);
  }, [amount, balance, updateCursorValue]);
  
  const handleAdd5 = useCallback(() => {
    const newVal = Math.min(amount + 5, balance);
    updateCursorValue(newVal);
  }, [amount, balance, updateCursorValue]);
  
  const handleSubtract5 = useCallback(() => {
    const newVal = Math.max(amount - 5, minBet);
    updateCursorValue(newVal);
  }, [amount, minBet, updateCursorValue]);

  // Numpad Overlay Component
  const NumpadOverlay = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl"
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
          <button
            key={digit}
            onClick={() => handleNumpadInput(digit)}
            className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg transition-colors"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={() => handleNumpadInput('clear')}
          className="h-12 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-bold text-sm transition-colors"
        >
          CLR
        </button>
        <button
          onClick={() => handleNumpadInput(0)}
          className="h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg transition-colors"
        >
          0
        </button>
        <button
          onClick={() => handleNumpadInput('back')}
          className="h-12 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors"
        >
          ←
        </button>
      </div>
      <button
        onClick={() => setShowNumpad(false)}
        className="w-full py-2 rounded-xl bg-[#2980B9] hover:bg-[#3498db] text-white font-medium transition-colors"
      >
        Done
      </button>
    </motion.div>
  );

  // Betting Phase UI
  if (phase === 'betting') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
        <div className="bg-gradient-to-t from-slate-900 via-slate-900/98 to-slate-900/95 border-t border-white/10 backdrop-blur-md">
          <div className="max-w-2xl mx-auto p-3 sm:p-4">
            
            {/* ARMED CURSOR MODE: Value Modifiers (NEW) */}
            {armedCursorMode && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  onClick={handleHalve}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
                >
                  ÷2
                </button>
                <button
                  onClick={handleSubtract5}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
                >
                  -5
                </button>
                <div className="px-6 py-2 bg-yellow-500/20 border border-yellow-500 rounded-lg">
                  <div className="text-xs text-yellow-400">Cursor Value</div>
                  <div className="text-lg font-bold text-yellow-300">${amount}</div>
                </div>
                <button
                  onClick={handleAdd5}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
                >
                  +5
                </button>
                <button
                  onClick={handleDouble}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
                >
                  ×2
                </button>
              </div>
            )}
            
            {/* Quick Bet Buttons - Top Row (ONLY if NOT in armed cursor mode) */}
            {!armedCursorMode && (
              <div className="flex items-center justify-center gap-2 mb-3">
                {quickBets.map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => updateCursorValue(value)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all
                      ${amount === value 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                      }
                    `}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Chip Selector */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 overflow-x-auto pb-1">
              {chipValues.filter(v => v <= balance).map(val => (
                <motion.button
                  key={val}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleChipAdd(val)}
                  className={`
                    w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center 
                    font-bold text-xs shadow-lg transition-all flex-shrink-0
                    border-2 border-white/30 chip-shadow
                    ${chipColors[val] || 'bg-slate-600'}
                  `}
                >
                  {val >= 1000 ? '1K' : val}
                </motion.button>
              ))}
            </div>

            {/* Fitts's Law Layout: Actions positioned for thumb accessibility */}
            <div className="flex items-center gap-3">
              {/* LEFT SIDE: Secondary/Destructive Actions (harder to reach = safety) */}
              <button
                onClick={() => setAmount(minBet)}
                className="px-4 py-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white text-sm font-medium transition-all"
              >
                Reset
              </button>

              {/* CENTER: Bet Amount Display (tappable for numpad) */}
              <div className="relative flex-1">
                <AnimatePresence>
                  {showNumpad && <NumpadOverlay />}
                </AnimatePresence>
                <button
                  onClick={() => setShowNumpad(!showNumpad)}
                  className="w-full bg-black/40 rounded-xl px-4 py-2 border border-white/10 text-left hover:bg-black/50 transition-colors"
                >
                  <div className="text-xs text-slate-400">Bet Amount</div>
                  <div className="text-xl sm:text-2xl font-mono font-bold text-white">${amount.toLocaleString()}</div>
                </button>
              </div>

              {/* RIGHT SIDE: Primary Action (Thumb Zone - easy reach) */}
              <motion.button
                whileHover={{ scale: disabled ? 1 : 1.02 }}
                whileTap={{ scale: disabled ? 1 : 0.95 }}
                onClick={handleBet}
                disabled={disabled || amount > balance}
                className={`
                  px-6 sm:px-8 py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all
                  ${disabled || amount > balance
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400 shadow-yellow-500/30'
                  }
                `}
              >
                BET
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing Phase UI (Hit/Stand/Double/Fold)
  if (phase === 'playing') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
        <div className="bg-gradient-to-t from-slate-900 via-slate-900/98 to-slate-900/95 border-t border-white/10 backdrop-blur-md">
          <div className="max-w-2xl mx-auto p-3 sm:p-4">
            {/* Fitts's Law Optimized Layout */}
            <div className="flex items-center gap-3">
              
              {/* LEFT SIDE: Destructive Actions (top-left = hardest to reach accidentally) */}
              <div className="flex flex-col gap-2">
                {onSurrender && (
                  <button
                    onClick={onSurrender}
                    disabled={disabled}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-[#C0392B] hover:text-white text-xs font-medium transition-all disabled:opacity-50"
                  >
                    Surrender
                  </button>
                )}
                {onFold && (
                  <button
                    onClick={onFold}
                    disabled={disabled}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-[#C0392B] hover:bg-[#C0392B] hover:text-white text-sm font-medium transition-all border border-[#C0392B]/30 disabled:opacity-50"
                  >
                    Fold
                  </button>
                )}
              </div>

              {/* CENTER: Secondary Positive Actions */}
              <div className="flex-1 flex justify-center gap-2">
                {onDouble && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onDouble}
                    disabled={disabled}
                    className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Double
                  </motion.button>
                )}
                {onStand && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onStand}
                    disabled={disabled}
                    className="px-6 py-3 rounded-xl bg-[#2980B9] hover:bg-[#3498db] text-white font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Stand
                  </motion.button>
                )}
              </div>

              {/* RIGHT SIDE: Primary Action (Thumb Zone - largest, easiest to tap) */}
              {onHit && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onHit}
                  disabled={disabled}
                  className={`
                    px-8 py-4 rounded-xl font-black text-lg shadow-xl transition-all
                    ${disabled 
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/30'
                    }
                  `}
                >
                  HIT
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Phase - minimal UI
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
      <div className="bg-gradient-to-t from-slate-900/90 to-slate-900/80 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-2xl mx-auto p-4 text-center">
          <div className="text-slate-400 animate-pulse">Waiting for other players...</div>
        </div>
      </div>
    </div>
  );
};

export default BettingControls;
