import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const LETTER_COLORS = {
  B: 'from-blue-500 to-blue-700',
  I: 'from-red-500 to-red-700',
  N: 'from-yellow-500 to-yellow-700',
  G: 'from-green-500 to-green-700',
  O: 'from-purple-500 to-purple-700'
};

function getBingoLetter(num) {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  if (num >= 61 && num <= 75) return 'O';
  return '';
}

const BingoCard = ({ card, drawnNumbers, onClaim }) => {
  if (!card) return null;
  
  const isMarked = (num) => {
    if (num === 0) return true; // FREE SPACE
    return drawnNumbers.includes(num);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-3 sm:p-4 shadow-2xl border border-yellow-500/20 w-full max-w-sm mx-auto">
      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-2 sm:mb-3">
        {BINGO_LETTERS.map((letter) => (
          <div 
            key={letter} 
            className={`text-center text-lg sm:text-2xl font-bold py-1 sm:py-2 rounded-lg bg-gradient-to-b ${LETTER_COLORS[letter]} text-white shadow-lg`}
          >
            {letter}
          </div>
        ))}
      </div>
      
      {/* Card Grid - 5x5 */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
        {card.grid.map((col, colIdx) => (
          col.map((num, rowIdx) => {
            const marked = isMarked(num);
            const isFreeSpace = num === 0;
            
            return (
              <motion.div
                key={`${colIdx}-${rowIdx}`}
                initial={marked ? { scale: 0.8 } : {}}
                animate={marked ? { scale: 1 } : {}}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-sm sm:text-lg font-bold
                  transition-all duration-300 relative overflow-hidden
                  ${marked 
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg ring-2 ring-yellow-300' 
                    : 'bg-slate-700/50 text-white border border-slate-600'
                  }
                  ${isFreeSpace ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : ''}
                `}
              >
                {marked && !isFreeSpace && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full bg-yellow-400/20 animate-pulse" />
                  </div>
                )}
                <span className="relative z-10">
                  {isFreeSpace ? '★' : num}
                </span>
              </motion.div>
            );
          })
        ))}
      </div>
      
      {/* Claim Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onClaim(card.id)}
        className="mt-3 sm:mt-4 w-full py-2 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base sm:text-lg rounded-xl shadow-lg hover:from-green-400 hover:to-emerald-500 transition-all"
      >
        CLAIM BINGO! 🎉
      </motion.button>
    </div>
  );
};

const BallRoller = ({ drawnNumbers, currentBall }) => {
  return (
    <div className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-xl border border-white/10">
      {/* Current Ball Display */}
      <div className="flex items-center justify-center mb-3 sm:mb-4">
        <AnimatePresence mode="wait">
          {currentBall ? (
            <motion.div
              key={currentBall}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`
                w-16 h-16 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center
                bg-gradient-to-br ${LETTER_COLORS[getBingoLetter(currentBall)]}
                text-white shadow-2xl border-4 border-white/30
              `}
            >
              <span className="text-xs sm:text-sm font-bold opacity-80">{getBingoLetter(currentBall)}</span>
              <span className="text-2xl sm:text-4xl font-black">{currentBall}</span>
            </motion.div>
          ) : (
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-slate-700 text-slate-400 border-4 border-dashed border-slate-600">
              <span className="text-xs sm:text-sm">Waiting...</span>
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Called Balls History */}
      <div className="max-h-24 sm:max-h-32 overflow-y-auto">
        <div className="flex flex-wrap gap-1 justify-center">
          {drawnNumbers.slice().reverse().slice(0, 20).map((num, idx) => (
            <motion.div
              key={`${num}-${idx}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: idx === 0 ? 1 : 0.7, scale: 1 }}
              className={`
                w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold
                bg-gradient-to-br ${LETTER_COLORS[getBingoLetter(num)]} text-white
                ${idx === 0 ? 'ring-2 ring-white shadow-lg' : ''}
              `}
            >
              {num}
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Balls Called Count */}
      <div className="mt-2 sm:mt-3 text-center text-xs sm:text-sm text-slate-400">
        {drawnNumbers.length} / 75 balls called
      </div>
    </div>
  );
};

const BingoGame = ({ gameState, playerCard, onBuyCard, onClaimBingo, onExit }) => {
  const [showWinner, setShowWinner] = useState(false);
  
  useEffect(() => {
    if (gameState?.winner) {
      setShowWinner(true);
      const timer = setTimeout(() => setShowWinner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.winner]);

  // Demo state for preview mode
  const demoState = {
    phase: 'PLAYING',
    drawnNumbers: [12, 45, 23, 67, 8, 34, 71, 19, 55, 3],
    currentBall: 55,
    pot: 25,
    houseBankroll: 1000000,
    winner: null
  };
  
  const demoCard = [{
    id: 'demo-card',
    grid: [
      [5, 22, 38, 51, 68],
      [12, 19, 34, 55, 71],
      [8, 28, 0, 46, 63],
      [3, 23, 45, 59, 75],
      [14, 30, 41, 60, 67]
    ],
    marked: [
      [false, false, false, false, false],
      [true, true, true, true, true],
      [true, false, false, false, false],
      [true, true, true, false, false],
      [false, false, false, false, true]
    ]
  }];

  const state = gameState || demoState;
  const cards = (playerCard && playerCard.length > 0) ? playerCard : demoCard;

  const { phase, drawnNumbers = [], currentBall, pot, houseBankroll, winner } = state;
  const hasCard = cards && cards.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-yellow-500/20 p-3 sm:p-4 safe-area-top">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={onExit}
            className="text-slate-400 hover:text-white flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
          >
            <span>←</span>
            <span className="hidden sm:inline">Lobby</span>
          </button>
          
          <div className="text-center">
            <h1 className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              🎱 BINGO
            </h1>
            <div className="text-xs sm:text-sm text-slate-400">
              {phase === 'BUYING' && '🎫 Buy Cards Now!'}
              {phase === 'PLAYING' && '🔴 GAME IN PROGRESS'}
              {phase === 'COMPLETE' && '🏆 GAME OVER'}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-slate-400">House Bank</div>
            <div className="text-yellow-400 font-mono text-sm sm:text-base">
              ${houseBankroll?.toLocaleString() || '1,000,000'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        {/* Ball Roller - Top Section */}
        <div className="flex-shrink-0">
          <BallRoller drawnNumbers={drawnNumbers} currentBall={currentBall} />
        </div>

        {/* Card Display - Main Section */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center py-2">
          {hasCard ? (
            <BingoCard 
              card={cards[0]} 
              drawnNumbers={drawnNumbers}
              onClaim={onClaimBingo}
            />
          ) : (
            <div className="text-center space-y-4 sm:space-y-6 p-4 sm:p-8">
              <div className="text-4xl sm:text-6xl">🎱</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Get Your Card!</h2>
              <p className="text-slate-400 text-sm sm:text-base max-w-sm mx-auto">
                {phase === 'BUYING' 
                  ? 'Purchase a bingo card to join the game. Game starts automatically when cards are sold!'
                  : 'Game in progress. Wait for the next round to buy a card.'
                }
              </p>
              {phase === 'BUYING' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onBuyCard}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-base sm:text-lg rounded-2xl shadow-lg hover:shadow-yellow-500/30 transition-all"
                >
                  Buy Card - 1 Chip 🎫
                </motion.button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Info Bar */}
        <div className="flex-shrink-0 bg-slate-800/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/5">
          <div className="flex justify-around text-center">
            <div>
              <div className="text-xs sm:text-sm text-slate-400">Pot</div>
              <div className="text-base sm:text-xl font-bold text-yellow-400">${pot || 0}</div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-slate-400">Phase</div>
              <div className={`text-base sm:text-xl font-bold ${
                phase === 'PLAYING' ? 'text-green-400' : 
                phase === 'COMPLETE' ? 'text-purple-400' : 'text-blue-400'
              }`}>
                {phase}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-slate-400">Balls</div>
              <div className="text-base sm:text-xl font-bold text-white">{drawnNumbers.length}</div>
            </div>
          </div>
        </div>
      </main>

      {/* Winner Overlay */}
      <AnimatePresence>
        {showWinner && winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, rotate: 10 }}
              className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-3xl p-6 sm:p-8 text-center shadow-2xl max-w-sm w-full"
            >
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🎉</div>
              <h2 className="text-2xl sm:text-3xl font-black text-black mb-2">BINGO!</h2>
              <p className="text-base sm:text-lg text-black/80 mb-3 sm:mb-4">
                Winner: {winner.pattern}
              </p>
              <div className="text-xl sm:text-2xl font-bold text-black">
                Prize: ${pot}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BingoGame;
