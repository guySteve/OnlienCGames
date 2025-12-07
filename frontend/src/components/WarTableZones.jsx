/**
 * WarTableSimple.jsx - Simplified Casino War Table
 *
 * Layout: 4 Hands × 4 Spots = 16 Total Betting Positions
 * - Hand 0: Spots 0-3
 * - Hand 1: Spots 4-7
 * - Hand 2: Spots 8-11
 * - Hand 3: Spots 12-15
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BettingControls from './BettingControls';

const WarTableZones = ({ socket, roomId, user, onExit }) => {
  const [spots, setSpots] = useState(Array(16).fill(null).map((_, i) => ({
    index: i,
    bet: 0,
    playerName: null,
    playerColor: null,
    card: null
  })));
  const [dealerCard, setDealerCard] = useState(null);
  const [betAmount, setBetAmount] = useState(10);
  const [phase, setPhase] = useState('BETTING'); // BETTING, DEALING, RESULT
  const [message, setMessage] = useState('Place your bets!');
  const [mySpots, setMySpots] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('war:state', handleStateUpdate);
    socket.on('war:dealt', handleDealt);
    socket.on('war:result', handleResult);
    socket.emit('war:joinTable', { roomId });

    return () => {
      socket.off('war:state');
      socket.off('war:dealt');
      socket.off('war:result');
    };
  }, [socket, roomId]);

  const handleStateUpdate = (state) => {
    if (state.spots) {
      setSpots(state.spots);
    }
    if (state.phase) {
      setPhase(state.phase);
    }
  };

  const handleDealt = ({ houseCard, spots: newSpots }) => {
    setDealerCard(houseCard);
    setSpots(newSpots);
    setPhase('RESULT');
    setMessage('Cards dealt!');
  };

  const handleResult = ({ spots: resultSpots, winners }) => {
    setSpots(resultSpots);
    const myWins = winners.filter(w => w.userId === user.id);
    if (myWins.length > 0) {
      setMessage(`You won ${myWins.length} hand(s)!`);
    } else {
      setMessage('Better luck next time!');
    }
  };

  const placeBet = (spotIndex) => {
    if (phase !== 'BETTING') return;
    socket.emit('war:placeBet', { roomId, spotIndex, amount: betAmount });
  };

  // Group spots into hands (4 spots per hand)
  const hands = [
    spots.slice(0, 4),   // Hand 0
    spots.slice(4, 8),   // Hand 1
    spots.slice(8, 12),  // Hand 2
    spots.slice(12, 16)  // Hand 3
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-yellow-400">Casino War</h1>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          Exit
        </button>
      </div>

      {/* Message */}
      <div className="text-center mb-6">
        <p className="text-xl text-white font-semibold">{message}</p>
      </div>

      {/* Dealer Card */}
      <div className="flex justify-center mb-8">
        <div className="text-center">
          <p className="text-white mb-2">Dealer</p>
          {dealerCard ? (
            <div className="w-20 h-28 bg-white rounded-lg shadow-lg flex flex-col items-center justify-center">
              <div className="text-4xl">{dealerCard.suit}</div>
              <div className="text-2xl font-bold">{dealerCard.rank}</div>
            </div>
          ) : (
            <div className="w-20 h-28 bg-gray-700 rounded-lg shadow-lg" />
          )}
        </div>
      </div>

      {/* 4 Hands Layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-4 gap-4 mb-8">
        {hands.map((hand, handIndex) => (
          <div key={handIndex} className="space-y-2">
            <p className="text-center text-yellow-400 font-semibold mb-2">
              Hand {handIndex + 1}
            </p>

            {/* 4 Spots per Hand */}
            <div className="space-y-2">
              {hand.map((spot) => (
                <motion.div
                  key={spot.index}
                  onClick={() => placeBet(spot.index)}
                  whileHover={{ scale: 1.05 }}
                  className={`
                    relative h-24 rounded-lg cursor-pointer
                    transition-all duration-200
                    ${spot.bet > 0
                      ? 'bg-blue-600 border-2 border-blue-400'
                      : 'bg-emerald-800 border-2 border-dashed border-emerald-600'
                    }
                    hover:border-yellow-400
                  `}
                >
                  {/* Spot Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {spot.card ? (
                      <div className="text-center">
                        <div className="text-3xl">{spot.card.suit}</div>
                        <div className="text-xl font-bold text-white">{spot.card.rank}</div>
                      </div>
                    ) : spot.bet > 0 ? (
                      <div className="text-center">
                        <div className="text-sm text-white opacity-75">{spot.playerName}</div>
                        <div className="text-xl font-bold text-yellow-400">${spot.bet}</div>
                      </div>
                    ) : (
                      <div className="text-emerald-400 text-sm">
                        Spot {spot.index + 1}
                      </div>
                    )}
                  </div>

                  {/* "YOU" indicator */}
                  {spot.playerId === user.id && (
                    <div className="absolute top-1 right-1 bg-yellow-400 text-black text-xs px-2 py-1 rounded font-bold">
                      YOU
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Betting Controls */}
      {phase === 'BETTING' && (
        <BettingControls
          betAmount={betAmount}
          onBetChange={setBetAmount}
          onBet={() => {}}
          minBet={10}
          maxBet={1000}
        />
      )}
    </div>
  );
};

export default WarTableZones;
