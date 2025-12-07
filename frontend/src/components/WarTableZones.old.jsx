/**
 * WarTableZones.jsx - Community Swarm Topology (Phase III Implementation)
 * 
 * ARCHITECTURE:
 * - 5 Zones arranged in semi-circle
 * - 5 Betting Spots per Zone (25 total)
 * - First-come-first-served spot claiming
 * - Armed Cursor betting mode
 * - Visual player identification via neon colors
 * 
 * TOPOLOGY:
 *     [Zone 0] [Zone 1] [Zone 2] [Zone 3] [Zone 4]
 *     [ o o o] [ o o o] [ o o o] [ o o o] [ o o o]  = 25 spots
 *     [ o o  ] [ o o  ] [ o o  ] [ o o  ] [ o o  ]
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DealerAvatar from './DealerAvatar';
import BettingControls from './BettingControls';
import GameInstructions from './common/GameInstructions';

const WarTableZones = ({ socket, roomId, user, onExit }) => {
  const [gameState, setGameState] = useState(null);
  const [zones, setZones] = useState([]); // Array of 5 zones
  const [houseCard, setHouseCard] = useState(null);
  const [phase, setPhase] = useState('BETTING'); // BETTING, DEALING, RESULT
  const [betCursorValue, setBetCursorValue] = useState(10);
  const [mySpots, setMySpots] = useState([]); // Track which spots I own
  const [dealerState, setDealerState] = useState('idle');
  const [message, setMessage] = useState('Tap a spot to place your bet!');
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Listen for game state updates
    socket.on('war:state', handleStateUpdate);
    socket.on('war:dealt', handleDealt);
    socket.on('war:result', handleResult);

    // Request initial state
    socket.emit('war:joinTable', { roomId });

    return () => {
      socket.off('war:state', handleStateUpdate);
      socket.off('war:dealt', handleDealt);
      socket.off('war:result', handleResult);
    };
  }, [socket, roomId]);

  const handleStateUpdate = (state) => {
    setGameState(state);
    if (state.zones) {
      setZones(state.zones);
    }
    if (state.phase) {
      setPhase(state.phase);
      if (state.phase === 'BETTING') {
        setDealerState('idle');
        setMessage('Tap a spot to place your bet!');
      }
    }
  };

  const handleDealt = ({ houseCard, zones: newZones }) => {
    setHouseCard(houseCard);
    setZones(newZones);
    setPhase('RESULT');
    setDealerState('dealing');
    setMessage('Cards dealt! Checking results...');
  };

  const handleResult = ({ zones: resultZones, winners, houseCard: house }) => {
    setZones(resultZones);
    setHouseCard(house);
    setDealerState(winners.length > 0 ? 'sympathetic' : 'celebrating');
    
    // Check if I won
    const myWins = winners.filter(w => w.userId === user.id);
    if (myWins.length > 0) {
      const totalWon = myWins.reduce((sum, w) => sum + w.payout, 0);
      setMessage(`🎉 You won $${totalWon}!`);
    } else {
      setMessage('Better luck next time!');
    }

    // Reset after 3 seconds
    setTimeout(() => {
      setPhase('BETTING');
      setHouseCard(null);
      setMySpots([]);
      setDealerState('idle');
      setMessage('Tap a spot to place your bet!');
    }, 3000);
  };

  const handleSpotClick = useCallback((zoneIndex, spotIndex) => {
    if (phase !== 'BETTING') return;
    if (betCursorValue < 10 || betCursorValue > user.chipBalance) return;

    const globalSpotIndex = zoneIndex * 5 + spotIndex;

    // Check if spot is already taken
    const zone = zones[zoneIndex];
    if (zone?.slots?.[spotIndex]?.userId) {
      setMessage('Spot already taken!');
      return;
    }

    // Place bet
    socket?.emit('war:placeBet', {
      roomId,
      spotIndex: globalSpotIndex,
      amount: betCursorValue
    });

    // Optimistic update
    setMySpots(prev => [...prev, globalSpotIndex]);
    setMessage(`Bet $${betCursorValue} placed on spot ${globalSpotIndex + 1}`);
  }, [phase, betCursorValue, user.chipBalance, zones, socket, roomId, user.id]);

  const renderCard = (card) => {
    if (!card) return null;

    const suitColors = {
      '♥': 'text-red-500',
      '♦': 'text-red-500',
      '♠': 'text-slate-900',
      '♣': 'text-slate-900'
    };

    return (
      <motion.div
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-20 h-28 bg-white border-2 border-slate-300 rounded-lg shadow-xl flex flex-col items-center justify-center"
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

  const renderBettingSpot = (zoneIndex, spotIndex) => {
    const zone = zones[zoneIndex] || {};
    const spot = zone.slots?.[spotIndex] || {};
    const globalSpotIndex = zoneIndex * 5 + spotIndex;
    const isMySpot = spot.userId === user.id;
    const isOccupied = !!spot.userId;

    return (
      <motion.button
        key={`${zoneIndex}-${spotIndex}`}
        onClick={() => handleSpotClick(zoneIndex, spotIndex)}
        disabled={isOccupied && !isMySpot}
        whileHover={!isOccupied ? { scale: 1.1 } : {}}
        whileTap={!isOccupied ? { scale: 0.95 } : {}}
        className={`
          w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-sm
          transition-all relative
          ${isOccupied
            ? `border-[${spot.userColor || '#888'}] shadow-[0_0_20px_${spot.userColor || '#888'}]`
            : 'border-slate-600 border-dashed hover:border-yellow-500 hover:shadow-[0_0_15px_rgba(234,179,8,0.5)]'
          }
          ${isMySpot ? 'ring-4 ring-white ring-offset-2' : ''}
          ${phase !== 'BETTING' && 'cursor-not-allowed opacity-50'}
        `}
        style={{
          backgroundColor: isOccupied ? (spot.userColor || '#888') + '20' : 'transparent',
          borderColor: isOccupied ? (spot.userColor || '#888') : undefined
        }}
      >
        {isOccupied ? (
          <div className="flex flex-col items-center">
            <span className="text-xs text-white">${spot.amount}</span>
            {isMySpot && <span className="text-[10px] text-white">YOU</span>}
          </div>
        ) : (
          <span className="text-slate-500 text-xl">•</span>
        )}

        {/* Result indicator */}
        {phase === 'RESULT' && spot.result && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`
              absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${spot.result === 'WIN' ? 'bg-green-500' : spot.result === 'LOSS' ? 'bg-red-500' : 'bg-yellow-500'}
            `}
          >
            {spot.result === 'WIN' ? '✓' : spot.result === 'LOSS' ? '✗' : '='}
          </motion.div>
        )}
      </motion.button>
    );
  };

  const renderZone = (zoneIndex) => {
    const zone = zones[zoneIndex] || {};
    const playerCard = zone.playerCard;

    return (
      <div
        key={zoneIndex}
        className="flex flex-col items-center gap-3 bg-slate-800/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10"
      >
        {/* Zone number */}
        <div className="text-xs text-slate-400 font-bold">Zone {zoneIndex + 1}</div>

        {/* Player card for this zone */}
        <div className="min-h-[120px] flex items-center justify-center">
          {playerCard ? renderCard(playerCard) : (
            <div className="w-20 h-28 bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center">
              <span className="text-slate-600 text-2xl">?</span>
            </div>
          )}
        </div>

        {/* 5 betting spots in 2 rows */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {[0, 1, 2].map(spotIndex => renderBettingSpot(zoneIndex, spotIndex))}
          </div>
          <div className="flex gap-2">
            {[3, 4].map(spotIndex => renderBettingSpot(zoneIndex, spotIndex))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-slate-900 pb-32">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>⚔️</span> Casino War - Community Table
            </h1>
            <p className="text-sm text-red-300">25 spots • Tap to bet • Highest card wins</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 px-4 py-2 rounded-lg">
              <div className="text-xs text-slate-400">Your Chips</div>
              <div className="text-xl font-bold text-yellow-400">${user.chipBalance?.toLocaleString()}</div>
            </div>
            <button
              onClick={() => setShowInstructions(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
            >
              Rules
            </button>
            <button
              onClick={onExit}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Dealer Section */}
        <div className="flex flex-col items-center mb-8">
          <DealerAvatar
            state={dealerState}
            name="Dealer"
            mood={phase === 'RESULT' ? (dealerState === 'celebrating' ? 'happy' : 'sympathetic') : 'neutral'}
          />
          
          {/* House Card */}
          <div className="mt-4">
            {houseCard ? (
              <div>
                <div className="text-center text-yellow-400 font-bold mb-2">House Card</div>
                {renderCard(houseCard)}
              </div>
            ) : (
              <div className="w-20 h-28 bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center">
                <span className="text-slate-600 text-3xl">⚔️</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center mb-6">
          <motion.div
            key={message}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-white/20"
          >
            <span className="text-white font-semibold text-lg">{message}</span>
          </motion.div>
        </div>

        {/* 5 Zones in semi-circle */}
        <div className="flex justify-center gap-4 flex-wrap">
          {[0, 1, 2, 3, 4].map(zoneIndex => renderZone(zoneIndex))}
        </div>

        {/* Legend */}
        <div className="mt-8 bg-slate-900/60 backdrop-blur-md rounded-xl p-4 border border-white/10">
          <div className="text-center text-slate-400 text-sm">
            <span className="font-bold text-white">How to Play:</span> Use the controls below to set your bet amount, then tap any empty spot to place your bet. 
            Each zone gets one card. If your zone's card beats the house, you win! Ties trigger War (auto-play).
          </div>
        </div>
      </div>

      {/* Betting Controls - Armed Cursor Mode */}
      <BettingControls
        phase={phase === 'BETTING' ? 'betting' : 'waiting'}
        minBet={10}
        balance={user.chipBalance || 0}
        disabled={phase !== 'BETTING'}
        armedCursorMode={true}
        onCursorValueChange={setBetCursorValue}
        gameType="war"
      />

      {/* Instructions Modal */}
      <GameInstructions
        gameType="WAR"
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  );
};

export default WarTableZones;
