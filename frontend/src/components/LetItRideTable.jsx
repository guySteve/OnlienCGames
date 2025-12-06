/**
 * LetItRideTable.jsx - Let It Ride Poker Table
 *
 * Professional casino-style Let It Ride implementation
 * - Three betting circles (1, 2, $)
 * - Pull back bets or let them ride
 * - Community card reveal system
 * - Payout table display
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DealerAvatar from './DealerAvatar';
import GameInstructions from './common/GameInstructions';

const LetItRideTable = ({ socket, roomId, userId, playerChips, onBet }) => {
  const [gameState, setGameState] = useState(null);
  const [playerHand, setPlayerHand] = useState([]);
  const [communityCards, setCommunityCards] = useState([null, null]);
  const [bets, setBets] = useState({ bet1: 0, bet2: 0, bet3: 0 });
  const [activeBets, setActiveBets] = useState({ bet1: true, bet2: true, bet3: true });
  const [betAmount, setBetAmount] = useState(10);
  const [phase, setPhase] = useState('BETTING'); // BETTING, DEAL, DECISION1, REVEAL1, DECISION2, REVEAL2, SHOWDOWN
  const [showInstructions, setShowInstructions] = useState(false);
  const [dealerState, setDealerState] = useState('idle');
  const [message, setMessage] = useState('Place your bets');

  const PAYOUT_TABLE = [
    { hand: 'Royal Flush', payout: '1000:1', color: 'text-purple-400' },
    { hand: 'Straight Flush', payout: '200:1', color: 'text-blue-400' },
    { hand: 'Four of a Kind', payout: '50:1', color: 'text-green-400' },
    { hand: 'Full House', payout: '11:1', color: 'text-yellow-400' },
    { hand: 'Flush', payout: '8:1', color: 'text-cyan-400' },
    { hand: 'Straight', payout: '5:1', color: 'text-orange-400' },
    { hand: 'Three of a Kind', payout: '3:1', color: 'text-red-400' },
    { hand: 'Two Pair', payout: '2:1', color: 'text-pink-400' },
    { hand: 'Pair 10s+', payout: '1:1', color: 'text-emerald-400' },
  ];

  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', handleGameState);
    socket.on('letItRide:dealt', handleDealt);
    socket.on('letItRide:communityRevealed', handleCommunityRevealed);
    socket.on('letItRide:result', handleResult);

    return () => {
      socket.off('gameState', handleGameState);
      socket.off('letItRide:dealt', handleDealt);
      socket.off('letItRide:communityRevealed', handleCommunityRevealed);
      socket.off('letItRide:result', handleResult);
    };
  }, [socket]);

  const handleGameState = (state) => {
    setGameState(state);
  };

  const handleDealt = ({ hand }) => {
    setPlayerHand(hand);
    setPhase('DECISION1');
    setDealerState('idle');
    setMessage('Decision 1: Pull back bet #1 or Let It Ride?');
  };

  const handleCommunityRevealed = ({ cardIndex, card }) => {
    setCommunityCards(prev => {
      const newCards = [...prev];
      newCards[cardIndex] = card;
      return newCards;
    });

    if (cardIndex === 0) {
      setPhase('DECISION2');
      setMessage('Decision 2: Pull back bet #2 or Let It Ride?');
    } else {
      setPhase('SHOWDOWN');
      setDealerState('thinking');
    }
  };

  const handleResult = ({ result, payout, finalHand }) => {
    setMessage(result === 'win' ? `You won $${payout}!` : 'Better luck next time');
    setDealerState(result === 'win' ? 'celebrating' : 'sympathetic');

    setTimeout(() => {
      resetGame();
    }, 3000);
  };

  const placeBets = () => {
    if (betAmount < 10 || betAmount > playerChips / 3) return;

    const totalBet = betAmount * 3;
    setBets({ bet1: betAmount, bet2: betAmount, bet3: betAmount });
    setActiveBets({ bet1: true, bet2: true, bet3: true });

    socket?.emit('letItRide:placeBet', {
      roomId,
      userId,
      amount: betAmount
    });

    setPhase('DEAL');
    setDealerState('dealing');
    setMessage('Dealing cards...');

    if (onBet) onBet(totalBet);
  };

  const makeDecision = (decision) => {
    const currentBet = phase === 'DECISION1' ? 'bet1' : 'bet2';

    if (decision === 'PULL_BACK') {
      setActiveBets(prev => ({ ...prev, [currentBet]: false }));
      setMessage(`Pulled back bet #${phase === 'DECISION1' ? '1' : '2'}`);
    } else {
      setMessage(`Let it ride on bet #${phase === 'DECISION1' ? '1' : '2'}!`);
    }

    socket?.emit('letItRide:decision', {
      roomId,
      userId,
      decision,
      betNumber: phase === 'DECISION1' ? 1 : 2
    });

    setDealerState('dealing');

    setTimeout(() => {
      if (phase === 'DECISION1') {
        setPhase('REVEAL1');
      } else {
        setPhase('REVEAL2');
      }
    }, 500);
  };

  const resetGame = () => {
    setPlayerHand([]);
    setCommunityCards([null, null]);
    setBets({ bet1: 0, bet2: 0, bet3: 0 });
    setActiveBets({ bet1: true, bet2: true, bet3: true });
    setPhase('BETTING');
    setDealerState('idle');
    setMessage('Place your bets');
  };

  const renderCard = (card, hidden = false) => {
    if (!card) {
      return (
        <div className="w-20 h-28 bg-slate-700/50 border-2 border-dashed border-slate-500 rounded-lg flex items-center justify-center">
          <span className="text-slate-500 text-2xl">?</span>
        </div>
      );
    }

    if (hidden) {
      return (
        <div className="w-20 h-28 bg-gradient-to-br from-blue-900 to-blue-950 border-2 border-blue-700 rounded-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.03)_10px,rgba(255,255,255,0.03)_20px)]"></div>
        </div>
      );
    }

    const suitColors = { '♥': 'text-red-500', '♦': 'text-red-500', '♠': 'text-slate-900', '♣': 'text-slate-900' };

    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-20 h-28 bg-white border-2 border-slate-300 rounded-lg shadow-lg flex flex-col items-center justify-center relative"
      >
        <span className={`text-3xl font-bold ${suitColors[card.suit]}`}>
          {card.rank}
        </span>
        <span className={`text-4xl ${suitColors[card.suit]}`}>
          {card.suit}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 via-emerald-800 to-slate-900 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Let It Ride Poker</h1>
          <p className="text-emerald-300">Get a pair of 10s or better to win!</p>
        </div>
        <button
          onClick={() => setShowInstructions(true)}
          className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
        >
          How to Play
        </button>
      </div>

      {/* Main Game Area */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Payout Table */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/80 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-amber-400 mb-4">Payout Table</h3>
            <div className="space-y-2">
              {PAYOUT_TABLE.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 px-3 bg-slate-900/50 rounded-lg"
                >
                  <span className={`font-semibold ${item.color}`}>{item.hand}</span>
                  <span className="text-white font-bold">{item.payout}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Game Table */}
        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-3xl p-8 border-8 border-amber-900 shadow-2xl relative overflow-hidden">
            {/* Felt Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"></div>

            {/* Dealer */}
            <div className="relative z-10 flex justify-center mb-8">
              <DealerAvatar state={dealerState} name="Let It Ride Dealer" />
            </div>

            {/* Message */}
            <div className="relative z-10 text-center mb-6">
              <p className="text-2xl font-bold text-white drop-shadow-lg">{message}</p>
            </div>

            {/* Community Cards */}
            <div className="relative z-10 flex justify-center gap-4 mb-8">
              <div className="text-center">
                <p className="text-sm text-white mb-2">Community 1</p>
                {renderCard(communityCards[0], phase === 'BETTING' || phase === 'DEAL' || phase === 'DECISION1')}
              </div>
              <div className="text-center">
                <p className="text-sm text-white mb-2">Community 2</p>
                {renderCard(communityCards[1], phase !== 'REVEAL2' && phase !== 'SHOWDOWN')}
              </div>
            </div>

            {/* Player Hand */}
            <div className="relative z-10 flex justify-center gap-4 mb-8">
              {playerHand.map((card, index) => (
                <div key={index}>
                  {renderCard(card)}
                </div>
              ))}
              {playerHand.length === 0 && (
                <>
                  {renderCard(null)}
                  {renderCard(null)}
                  {renderCard(null)}
                </>
              )}
            </div>

            {/* Betting Circles */}
            <div className="relative z-10 flex justify-center gap-8 mb-6">
              {['bet1', 'bet2', 'bet3'].map((betKey, index) => (
                <div key={betKey} className="text-center">
                  <div
                    className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${
                      activeBets[betKey] && bets[betKey] > 0
                        ? 'border-amber-400 bg-amber-400/20'
                        : 'border-white/30 bg-white/5'
                    }`}
                  >
                    <div>
                      <p className="text-white font-bold text-lg">{index === 2 ? '$' : index + 1}</p>
                      {bets[betKey] > 0 && (
                        <p className={`text-sm font-bold ${activeBets[betKey] ? 'text-amber-300' : 'text-gray-400 line-through'}`}>
                          ${bets[betKey]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                      onClick={() => setBetAmount(Math.min(Math.floor(playerChips / 3), betAmount + 10))}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg"
                    >
                      +$10
                    </button>
                  </div>
                  <button
                    onClick={placeBets}
                    disabled={betAmount * 3 > playerChips}
                    className="px-8 py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg transition-colors"
                  >
                    Place Bets (${betAmount * 3})
                  </button>
                </div>
              )}

              {(phase === 'DECISION1' || phase === 'DECISION2') && (
                <div className="flex justify-center gap-6">
                  <button
                    onClick={() => makeDecision('PULL_BACK')}
                    className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-lg transition-colors"
                  >
                    Pull Back Bet #{phase === 'DECISION1' ? '1' : '2'}
                  </button>
                  <button
                    onClick={() => makeDecision('LET_IT_RIDE')}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xl rounded-lg transition-colors"
                  >
                    Let It Ride!
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      <GameInstructions
        gameType="LET_IT_RIDE"
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  );
};

export default LetItRideTable;
