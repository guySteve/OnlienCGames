/**
 * WarTable.jsx - High-Velocity Community Casino War Table
 *
 * Features:
 * - Multi-spot betting system
 * - War (tie) handling with surrender option
 * - Animated card reveals
 * - Real-time multiplayer support
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DealerAvatar from './DealerAvatar';
import GameInstructions from './common/GameInstructions';

const WarTable = ({ socket, roomId, userId, playerColor, playerChips, onBet }) => {
  const [gameState, setGameState] = useState(null);
  const [playerCard, setPlayerCard] = useState(null);
  const [dealerCard, setDealerCard] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [currentBet, setCurrentBet] = useState(0);
  const [phase, setPhase] = useState('BETTING'); // BETTING, DEALING, COMPARING, WAR_DECISION, WAR_BATTLE, RESULT
  const [isWar, setIsWar] = useState(false);
  const [warBet, setWarBet] = useState(0);
  const [dealerState, setDealerState] = useState('idle');
  const [message, setMessage] = useState('Place your bet to start');
  const [showInstructions, setShowInstructions] = useState(false);
  const [burnCards, setBurnCards] = useState([]);
  const [history, setHistory] = useState([]);

  const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const CARD_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', handleGameState);
    socket.on('war:dealt', handleDealt);
    socket.on('war:result', handleResult);
    socket.on('war:warStarted', handleWarStarted);
    socket.on('war:warResult', handleWarResult);

    return () => {
      socket.off('gameState', handleGameState);
      socket.off('war:dealt', handleDealt);
      socket.off('war:result', handleResult);
      socket.off('war:warStarted', handleWarStarted);
      socket.off('war:warResult', handleWarResult);
    };
  }, [socket]);

  const handleGameState = (state) => {
    setGameState(state);
  };

  const handleDealt = ({ playerCard: pCard, dealerCard: dCard }) => {
    setPlayerCard(pCard);
    setDealerCard(dCard);
    setPhase('COMPARING');
    setDealerState('thinking');

    setTimeout(() => {
      compareCards(pCard, dCard);
    }, 1500);
  };

  const compareCards = (pCard, dCard) => {
    const playerValue = CARD_VALUES[pCard.rank];
    const dealerValue = CARD_VALUES[dCard.rank];

    if (playerValue > dealerValue) {
      setMessage(`You win! ${pCard.rank} beats ${dCard.rank}`);
      setDealerState('sympathetic');
      addToHistory('win', currentBet);
    } else if (playerValue < dealerValue) {
      setMessage(`Dealer wins. ${dCard.rank} beats ${pCard.rank}`);
      setDealerState('celebrating');
      addToHistory('loss', -currentBet);
    } else {
      setMessage('WAR! Cards are equal');
      setIsWar(true);
      setPhase('WAR_DECISION');
      setDealerState('idle');
      return;
    }

    setPhase('RESULT');
    setTimeout(resetRound, 2500);
  };

  const handleResult = ({ result, payout }) => {
    if (result === 'win') {
      setMessage(`You won $${payout}!`);
    } else if (result === 'loss') {
      setMessage('Better luck next time');
    }
  };

  const handleWarStarted = ({ burnedCards }) => {
    setBurnCards(burnedCards);
    setMessage('Burning 3 cards...');
    setDealerState('dealing');

    setTimeout(() => {
      setMessage('Drawing war cards...');
    }, 1500);
  };

  const handleWarResult = ({ playerCard: pCard, dealerCard: dCard, result, payout }) => {
    setPlayerCard(pCard);
    setDealerCard(dCard);

    const playerValue = CARD_VALUES[pCard.rank];
    const dealerValue = CARD_VALUES[dCard.rank];

    if (result === 'win') {
      setMessage(`You win the war! ${pCard.rank} beats ${dCard.rank}`);
      setDealerState('sympathetic');
      addToHistory('war_win', payout);
    } else if (result === 'tie') {
      setMessage(`War tie! ${pCard.rank} equals ${dCard.rank} - You win!`);
      setDealerState('sympathetic');
      addToHistory('war_tie', payout);
    } else {
      setMessage(`Dealer wins the war. ${dCard.rank} beats ${pCard.rank}`);
      setDealerState('celebrating');
      addToHistory('war_loss', -(currentBet + warBet));
    }

    setPhase('RESULT');
    setTimeout(resetRound, 3000);
  };

  const placeBet = () => {
    if (betAmount < 10 || betAmount > playerChips) return;

    setCurrentBet(betAmount);
    socket?.emit('war:placeBet', {
      roomId,
      userId,
      amount: betAmount
    });

    setPhase('DEALING');
    setDealerState('dealing');
    setMessage('Dealing cards...');

    if (onBet) onBet(betAmount);
  };

  const goToWar = () => {
    const warAmount = currentBet;
    setWarBet(warAmount);

    socket?.emit('war:goToWar', {
      roomId,
      userId,
      warBet: warAmount
    });

    setPhase('WAR_BATTLE');
    if (onBet) onBet(warAmount);
  };

  const surrender = () => {
    const returnAmount = Math.floor(currentBet / 2);

    socket?.emit('war:surrender', {
      roomId,
      userId
    });

    setMessage(`Surrendered. Returned $${returnAmount}`);
    setDealerState('idle');
    addToHistory('surrender', -Math.floor(currentBet / 2));

    setTimeout(resetRound, 2000);
  };

  const resetRound = () => {
    setPlayerCard(null);
    setDealerCard(null);
    setCurrentBet(0);
    setWarBet(0);
    setIsWar(false);
    setBurnCards([]);
    setPhase('BETTING');
    setDealerState('idle');
    setMessage('Place your bet to start');
  };

  const addToHistory = (type, amount) => {
    setHistory(prev => [{ type, amount, timestamp: Date.now() }, ...prev.slice(0, 9)]);
  };

  const renderCard = (card, hidden = false) => {
    if (!card) {
      return (
        <div className="w-24 h-32 bg-slate-700/50 border-2 border-dashed border-slate-500 rounded-lg flex items-center justify-center">
          <span className="text-slate-500 text-3xl">?</span>
        </div>
      );
    }

    if (hidden) {
      return (
        <div className="w-24 h-32 bg-gradient-to-br from-red-900 to-red-950 border-2 border-red-700 rounded-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.03)_10px,rgba(255,255,255,0.03)_20px)]"></div>
          <div className="absolute inset-0 flex items-center justify-center text-white text-6xl opacity-20">⚔️</div>
        </div>
      );
    }

    const suitColors = { '♥': 'text-red-500', '♦': 'text-red-500', '♠': 'text-slate-900', '♣': 'text-slate-900' };

    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-24 h-32 bg-white border-2 border-slate-300 rounded-lg shadow-2xl flex flex-col items-center justify-center relative"
      >
        <span className={`text-4xl font-bold ${suitColors[card.suit]}`}>
          {card.rank}
        </span>
        <span className={`text-5xl ${suitColors[card.suit]}`}>
          {card.suit}
        </span>
        <div className="absolute top-2 left-2 flex flex-col items-center">
          <span className={`text-sm font-bold ${suitColors[card.suit]}`}>{card.rank}</span>
          <span className={`text-xs ${suitColors[card.suit]}`}>{card.suit}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-slate-900 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <span>⚔️</span> Casino War <span>⚔️</span>
          </h1>
          <p className="text-red-300">Highest card wins. Go to war on ties!</p>
        </div>
        <button
          onClick={() => setShowInstructions(true)}
          className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
        >
          How to Play
        </button>
      </div>

      {/* Main Game Area */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* History Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/80 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-amber-400 mb-4">History</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {history.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">No history yet</p>
              )}
              {history.map((entry, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                    entry.amount > 0 ? 'bg-green-900/30' : 'bg-red-900/30'
                  }`}
                >
                  <span className="text-white text-sm capitalize">{entry.type.replace('_', ' ')}</span>
                  <span className={`font-bold ${entry.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.amount > 0 ? '+' : ''}${entry.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Game Table */}
        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-red-800 to-red-900 rounded-3xl p-8 border-8 border-amber-900 shadow-2xl relative overflow-hidden">
            {/* Felt Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>

            {/* Dealer */}
            <div className="relative z-10 flex justify-center mb-8">
              <DealerAvatar state={dealerState} name="War Dealer" mood={dealerState === 'celebrating' ? 'happy' : 'neutral'} />
            </div>

            {/* Message */}
            <div className="relative z-10 text-center mb-8">
              <p className="text-2xl font-bold text-white drop-shadow-lg">{message}</p>
              {isWar && phase === 'WAR_DECISION' && (
                <p className="text-red-300 mt-2">Choose: Surrender for half your bet, or go to WAR!</p>
              )}
            </div>

            {/* Cards */}
            <div className="relative z-10 flex justify-center items-center gap-12 mb-8">
              {/* Dealer Card */}
              <div className="text-center">
                <p className="text-white font-bold mb-3">Dealer</p>
                {renderCard(dealerCard, phase === 'BETTING')}
              </div>

              {/* VS */}
              <div className="text-6xl text-white/50 font-bold">VS</div>

              {/* Player Card */}
              <div className="text-center">
                <p className="text-white font-bold mb-3">You</p>
                {renderCard(playerCard, phase === 'BETTING')}
              </div>
            </div>

            {/* Burn Cards (during war) */}
            {burnCards.length > 0 && (
              <div className="relative z-10 flex justify-center gap-2 mb-6">
                <p className="text-white mr-4">Burned:</p>
                {burnCards.map((_, index) => (
                  <div key={index} className="w-12 h-16 bg-slate-800 border border-slate-600 rounded"></div>
                ))}
              </div>
            )}

            {/* Betting Area */}
            <div className="relative z-10 flex justify-center mb-6">
              <div
                className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center ${
                  currentBet > 0
                    ? 'border-amber-400 bg-amber-400/20'
                    : 'border-white/30 bg-white/5'
                }`}
              >
                <p className="text-white font-bold">Main Bet</p>
                {currentBet > 0 && <p className="text-amber-300 font-bold text-xl">${currentBet}</p>}
                {warBet > 0 && <p className="text-red-300 font-bold text-sm">War: ${warBet}</p>}
              </div>
            </div>

            {/* Controls */}
            <div className="relative z-10">
              {phase === 'BETTING' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setBetAmount(Math.max(10, betAmount - 10))}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg"
                    >
                      -$10
                    </button>
                    <div className="px-6 py-3 bg-slate-800 text-white font-bold text-xl rounded-lg min-w-[120px] text-center">
                      ${betAmount}
                    </div>
                    <button
                      onClick={() => setBetAmount(Math.min(playerChips, betAmount + 10))}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg"
                    >
                      +$10
                    </button>
                  </div>
                  <button
                    onClick={placeBet}
                    disabled={betAmount > playerChips}
                    className="px-8 py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg transition-colors"
                  >
                    Place Bet
                  </button>
                </div>
              )}

              {phase === 'WAR_DECISION' && (
                <div className="flex justify-center gap-6">
                  <button
                    onClick={surrender}
                    className="px-8 py-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-xl rounded-lg transition-colors"
                  >
                    Surrender (Get ${Math.floor(currentBet / 2)} Back)
                  </button>
                  <button
                    onClick={goToWar}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>⚔️</span> GO TO WAR! <span>⚔️</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      <GameInstructions
        gameType="WAR"
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  );
};

export default WarTable;
