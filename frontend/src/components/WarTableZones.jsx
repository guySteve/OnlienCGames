/**
 * WarTableZones.jsx - Multi-Spot Community Casino War
 *
 * Layout: 5 Zones × 5 Spots = 25 Total Betting Positions
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BettingControls from './BettingControls';

const WarTableZones = ({ socket, roomId, user, onExit }) => {
  const [spots, setSpots] = useState(Array(25).fill(null).map((_, i) => ({
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

    // New event listeners based on server.js
    const handleGameState = (data) => {
      if (data.gameState) {
        setSpots(data.gameState.spots || Array(25).fill(null).map((_, i) => ({ index: i, bet: 0 })));
        setDealerCard(data.gameState.houseCard);
        setPhase(data.gameState.bettingPhase ? 'BETTING' : 'RESULT');
        setMessage(data.gameState.status || 'Place your bets!');
      }
    };

    socket.on('private_war_joined', handleGameState);
    socket.on('opponent_joined', handleGameState);
    socket.on('war_bet_placed', handleGameState);
    socket.on('war_bet_removed', handleGameState);
    socket.on('war_hand_started', handleGameState);
    socket.on('war_hand_resolved', (data) => {
        handleGameState(data);
        const myWins = data.results.filter(r => r.userId === user.id && r.payout > r.bet);
        if (myWins.length > 0) {
            setMessage(`You won ${myWins.reduce((acc, w) => acc + w.payout, 0)} chips!`);
        }
    });
    socket.on('war_round_reset', handleGameState);

    // Initial join event
    socket.emit('join_private_war', { tableCode: roomId }); // Assuming roomId from props is the tableCode

    return () => {
      socket.off('private_war_joined', handleGameState);
      socket.off('opponent_joined', handleGameState);
      socket.off('war_bet_placed', handleGameState);
      socket.off('war_bet_removed', handleGameState);
      socket.off('war_hand_started', handleGameState);
      socket.off('war_hand_resolved');
      socket.off('war_round_reset', handleGameState);
    };
  }, [socket, roomId, user]);

  const placeBet = (spotIndex) => {
    if (phase !== 'BETTING') return;
    // Emit the correct event with the right payload
    socket.emit('place_war_bet', { spotIndex, betAmount: betAmount });
  };

  // Group spots into 5 zones (5 spots per zone)
  const zones = [
    spots.slice(0, 5),
    spots.slice(5, 10),
    spots.slice(10, 15),
    spots.slice(15, 20),
    spots.slice(20, 25)
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 p-2 md:p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-yellow-400">War</h1>
        <button
          onClick={onExit}
          className="px-3 py-1.5 md:px-4 md:py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm md:text-base"
        >
          Exit
        </button>
      </div>

      {/* Message */}
      <div className="text-center mb-4 md:mb-6">
        <p className="text-lg md:text-xl text-white font-semibold">{message}</p>
      </div>

      {/* Dealer Card */}
      <div className="flex justify-center mb-4 md:mb-8">
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

      {/* 5 Zones Layout - Responsive Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-4 mb-8">
        {zones.map((zone, zoneIndex) => (
          <div key={zoneIndex} className="space-y-2">
            <p className="text-center text-yellow-400 font-semibold mb-2 text-sm md:text-base">
              Zone {zoneIndex + 1}
            </p>

            {/* 5 Spots per Zone */}
            <div className="space-y-2">
              {zone.map((spot) => (
                <motion.div
                  key={spot.index}
                  onClick={() => placeBet(spot.index)}
                  whileHover={{ scale: 1.05 }}
                  className={`
                    relative h-20 md:h-24 rounded-lg cursor-pointer transition-all duration-200
                    ${spot.bet > 0
                      ? 'bg-blue-600 border-2 border-blue-400'
                      : 'bg-emerald-800 border-2 border-dashed border-emerald-600'
                    }
                    hover:border-yellow-400
                  `}
                  style={{ backgroundColor: spot.playerColor || (spot.bet > 0 ? '#2563EB' : '#064e3b') }}
                >
                  {/* Spot Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {spot.card ? (
                      <div className="text-center text-white">
                        <div className="text-2xl md:text-3xl">{spot.card.suit}</div>
                        <div className="text-lg md:text-xl font-bold">{spot.card.rank}</div>
                      </div>
                    ) : spot.bet > 0 ? (
                      <div className="text-center">
                        <div className="text-xs text-white opacity-75 truncate">{spot.playerName}</div>
                        <div className="text-base md:text-xl font-bold text-yellow-400">${spot.bet}</div>
                      </div>
                    ) : (
                      <div className="text-emerald-400 text-xs md:text-sm">
                        Spot {spot.index + 1}
                      </div>
                    )}
                  </div>

                  {/* "YOU" indicator */}
                  {spot.playerId === user.id && (
                    <div className="absolute top-1 right-1 bg-yellow-400 text-black text-xs px-1.5 py-0.5 rounded font-bold">
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
          onBet={() => {
            // This button might not be needed if clicking spots is the primary action
          }}
          onClear={() => {
             // Find all spots belonging to the current user and emit remove_war_bet for each
             spots.forEach(spot => {
               if(spot.playerId === user.id) {
                 socket.emit('remove_war_bet', { spotIndex: spot.index });
               }
             });
          }}
          minBet={10}
          maxBet={1000}
        />
      )}
    </div>
  );
};

export default WarTableZones;
