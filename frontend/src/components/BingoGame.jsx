/**
 * BingoGame.jsx - No-Scroll Bingo Game Interface
 *
 * Features:
 * - 100dvh fixed viewport
 * - Anime.js powered ball animations
 * - Real-time ball calling via socket events
 * - Visual feedback for marked numbers
 * - Ball rolling sound effects
 */

import React, { useState, useEffect, useRef } from 'react';
import { useGameAnimations } from '../hooks/useGameAnimations';
import { useSoundEffects } from '../hooks/useSoundEffects';

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];
const LETTER_COLORS = {
  B: { bg: 'from-blue-500 to-blue-700', text: 'text-blue-400' },
  I: { bg: 'from-red-500 to-red-700', text: 'text-red-400' },
  N: { bg: 'from-yellow-500 to-yellow-700', text: 'text-yellow-400' },
  G: { bg: 'from-green-500 to-green-700', text: 'text-green-400' },
  O: { bg: 'from-purple-500 to-purple-700', text: 'text-purple-400' }
};

function getBingoLetter(num) {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  if (num >= 61 && num <= 75) return 'O';
  return '';
}

// Bingo Card Component
const BingoCard = ({ card, drawnNumbers, onClaim, animations }) => {
  const cellRefs = useRef([]);

  if (!card) return null;

  const isMarked = (num) => {
    if (num === 0) return true; // FREE SPACE
    return drawnNumbers.includes(num);
  };

  // Animate newly marked number
  useEffect(() => {
    if (drawnNumbers.length > 0) {
      const lastNumber = drawnNumbers[drawnNumbers.length - 1];
      // Find cell with this number
      card.grid.forEach((col, colIdx) => {
        col.forEach((num, rowIdx) => {
          if (num === lastNumber) {
            const cellIndex = colIdx * 5 + rowIdx;
            const cellEl = cellRefs.current[cellIndex];
            if (cellEl && animations) {
              animations.markBingoNumber(cellEl);
            }
          }
        });
      });
    }
  }, [drawnNumbers, card.grid, animations]);

  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-3 shadow-2xl border border-yellow-500/20 w-full max-w-xs backdrop-blur-md">
      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {BINGO_LETTERS.map((letter) => (
          <div
            key={letter}
            className={`text-center text-lg font-bold py-1.5 rounded-lg bg-gradient-to-b ${LETTER_COLORS[letter].bg} text-white shadow-lg`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Card Grid - 5x5 */}
      <div className="grid grid-cols-5 gap-1">
        {card.grid.map((col, colIdx) =>
          col.map((num, rowIdx) => {
            const marked = isMarked(num);
            const isFreeSpace = num === 0;
            const cellIndex = colIdx * 5 + rowIdx;

            return (
              <div
                key={`${colIdx}-${rowIdx}`}
                ref={(el) => cellRefs.current[cellIndex] = el}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-sm font-bold
                  transition-all duration-300 relative overflow-hidden
                  ${marked
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg ring-2 ring-yellow-300'
                    : 'bg-slate-700/50 text-white border border-slate-600'
                  }
                  ${isFreeSpace ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : ''}
                `}
              >
                {marked && !isFreeSpace && (
                  <div className="absolute inset-0 bg-yellow-400/20 animate-pulse" />
                )}
                <span className="relative z-10">
                  {isFreeSpace ? '★' : num}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Claim Button */}
      <button
        onClick={() => onClaim(card.id)}
        className="mt-3 w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base rounded-xl shadow-lg hover:from-green-400 hover:to-emerald-500 transition-all active:scale-95"
      >
        CLAIM BINGO!
      </button>
    </div>
  );
};

// Ball Display Component
const BallDisplay = ({ currentBall, drawnNumbers, animations, sounds }) => {
  const ballRef = useRef(null);
  const prevBallRef = useRef(null);

  // Animate and play sound for new ball
  useEffect(() => {
    if (currentBall && currentBall !== prevBallRef.current && ballRef.current) {
      // Play ball rolling sound first (cage tumbling)
      if (sounds?.playBallRoll) {
        sounds.playBallRoll();
      }
      
      // After a brief delay, play pop sound and animate (ball emerging)
      setTimeout(() => {
        if (sounds?.playBallPop) {
          sounds.playBallPop();
        }
        if (animations) {
          animations.rollBingoBall(ballRef.current);
        }
      }, 600); // Delay for cage rolling sound
      
      prevBallRef.current = currentBall;
    }
  }, [currentBall, animations, sounds]);

  return (
    <div className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/10">
      {/* Current Ball Display */}
      <div className="flex items-center justify-center mb-4">
        {currentBall ? (
          <div
            ref={ballRef}
            className={`
              w-20 h-20 rounded-full flex flex-col items-center justify-center
              bg-gradient-to-br ${LETTER_COLORS[getBingoLetter(currentBall)].bg}
              text-white shadow-2xl border-4 border-white/30
            `}
          >
            <span className="text-xs font-bold opacity-80">{getBingoLetter(currentBall)}</span>
            <span className="text-3xl font-black">{currentBall}</span>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-slate-700 text-slate-400 border-4 border-dashed border-slate-600">
            <span className="text-xs">Waiting...</span>
          </div>
        )}
      </div>

      {/* Called Balls History */}
      <div className="max-h-20 overflow-hidden">
        <div className="flex flex-wrap gap-1 justify-center">
          {drawnNumbers.slice().reverse().slice(0, 15).map((num, idx) => (
            <div
              key={`${num}-${idx}`}
              className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                bg-gradient-to-br ${LETTER_COLORS[getBingoLetter(num)].bg} text-white
                ${idx === 0 ? 'ring-2 ring-white shadow-lg scale-110' : 'opacity-70'}
              `}
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      {/* Balls Called Count */}
      <div className="mt-3 text-center text-xs text-slate-400">
        {drawnNumbers.length} / 75 balls called
      </div>
    </div>
  );
};

// Main BingoGame Component
const BingoGame = ({ gameState, playerCard, onBuyCard, onClaimBingo, onExit }) => {
  const [showWinner, setShowWinner] = useState(false);
  const animations = useGameAnimations();
  const sounds = useSoundEffects();
  const winnerRef = useRef(null);

  // Initialize audio on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      sounds.initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [sounds]);

  useEffect(() => {
    if (gameState?.winner) {
      setShowWinner(true);
      // Play win sound and confetti for winner
      sounds.playWin();
      if (winnerRef.current) {
        const center = animations.getElementCenter(winnerRef.current);
        animations.confetti(center, 80);
      }
      const timer = setTimeout(() => setShowWinner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.winner, animations, sounds]);

  // Cleanup
  useEffect(() => {
    return () => animations.cleanup();
  }, [animations]);

  const phase = gameState?.phase || 'BUYING';
  const drawnNumbers = gameState?.drawnNumbers || [];
  const currentBall = gameState?.currentBall;
  const pot = gameState?.pot || 0;
  const houseBankroll = gameState?.houseBankroll || 1000000;
  const winner = gameState?.winner;
  const hasCard = playerCard && playerCard.length > 0;

  return (
    <div className="game-container no-select bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-slate-900/90 backdrop-blur-md border-b border-yellow-500/20 flex items-center px-4 z-30 safe-area-top">
        <button
          onClick={onExit}
          className="text-slate-400 hover:text-white flex items-center gap-1"
        >
          <span>←</span>
          <span className="text-sm">Lobby</span>
        </button>

        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            BINGO
          </h1>
          <div className="text-xs text-slate-400">
            {phase === 'BUYING' && 'Buy Cards Now!'}
            {phase === 'PLAYING' && 'GAME IN PROGRESS'}
            {phase === 'COMPLETE' && 'GAME OVER'}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">House</div>
          <div className="text-yellow-400 font-mono text-sm">
            ${houseBankroll?.toLocaleString()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="absolute inset-x-0 top-16 bottom-20 flex flex-col lg:flex-row items-center justify-center gap-4 p-4 overflow-hidden">
        {/* Ball Roller Section */}
        <div className="flex-shrink-0 w-full max-w-xs lg:max-w-sm">
          <BallDisplay
            currentBall={currentBall}
            drawnNumbers={drawnNumbers}
            animations={animations}
            sounds={sounds}
          />
        </div>

        {/* Card Display Section */}
        <div className="flex-1 flex items-center justify-center">
          {hasCard ? (
            <BingoCard
              card={playerCard[0]}
              drawnNumbers={drawnNumbers}
              onClaim={onClaimBingo}
              animations={animations}
            />
          ) : (
            <div className="text-center space-y-4 p-6 bg-slate-800/50 rounded-2xl border border-white/10 max-w-sm">
              <div className="text-5xl">🎱</div>
              <h2 className="text-xl font-bold text-white">Get Your Card!</h2>
              <p className="text-slate-400 text-sm">
                {phase === 'BUYING'
                  ? 'Purchase a bingo card to join the game.'
                  : 'Game in progress. Wait for the next round.'
                }
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-slate-900/90 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-4 z-30 safe-area-bottom">
        <div className="text-center">
          <div className="text-xs text-slate-400">Pot</div>
          <div className="text-lg font-bold text-yellow-400">${pot}</div>
        </div>
        <div className="text-center bingo-controls">
          {phase === 'BUYING' ? (
            <button
              onClick={onBuyCard}
              className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-base rounded-xl shadow-lg hover:shadow-yellow-500/30 transition-all active:scale-95"
            >
              Buy Card (1)
            </button>
          ) : (
            <div>
              <div className="text-xs text-slate-400">Phase</div>
              <div className={`text-lg font-bold ${
                phase === 'PLAYING' ? 'text-green-400' :
                phase === 'COMPLETE' ? 'text-purple-400' : 'text-blue-400'
              }`}>
                {phase}
              </div>
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400">Balls</div>
          <div className="text-lg font-bold text-white">{drawnNumbers.length}</div>
        </div>
      </div>

      {/* Winner Overlay */}
      {showWinner && winner && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            ref={winnerRef}
            className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full"
          >
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-3xl font-black text-black mb-2">BINGO!</h2>
            <p className="text-lg text-black/80 mb-4">
              Winner: {winner.pattern}
            </p>
            <div className="text-2xl font-bold text-black">
              Prize: ${pot}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoGame;
