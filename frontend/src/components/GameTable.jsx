import React from 'react';
import PlayerSeat from './PlayerSeat';
import Card from './Card';
import { AnimatePresence } from 'framer-motion';

const GameTable = ({ gameState, mySeats, onSit, onLeave }) => {
  // Define seat positions as percentages relative to the 16/9 container
  // This ensures the layout scales perfectly on all devices
  const seatPositions = [
    { top: '60%', left: '15%' },  // Seat 0
    { top: '35%', left: '5%' },   // Seat 1
    { top: '20%', left: '50%', transform: 'translateX(-50%)' }, // Seat 2 (Center)
    { top: '35%', left: '95%', transform: 'translateX(-100%)' }, // Seat 3
    { top: '60%', left: '85%', transform: 'translateX(-100%)' }, // Seat 4
  ];

  return (
    <div className="w-full max-w-6xl mx-auto aspect-video relative bg-[#0f3226] rounded-3xl shadow-2xl border-8 border-[#1a472a] overflow-hidden">
      {/* Felt Texture Overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-30 pointer-events-none" />
      
      {/* Center Logo / Decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
        <div className="text-6xl font-serif font-bold text-yellow-500 tracking-widest">CASINO</div>
      </div>

      {/* Dealer Area */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="text-yellow-500/50 font-serif text-sm mb-2 tracking-widest">DEALER</div>
        <div className="flex space-x-2">
          {/* Dealer Cards */}
          <AnimatePresence>
            {gameState?.houseCard && (
              <Card {...gameState.houseCard} index={0} />
            )}
            {gameState?.dealerHand?.map((c, i) => (
              <Card key={i} {...c} index={i} />
            ))}
            {(!gameState?.houseCard && (!gameState?.dealerHand || gameState.dealerHand.length === 0)) && (
               <div className="w-16 h-24 rounded-lg border-2 border-white/10 bg-black/20 flex items-center justify-center">
                 <span className="text-white/20 text-xs">DECK</span>
               </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Player Seats */}
      {seatPositions.map((pos, index) => {
        const seatData = gameState?.seats?.[index] || { empty: true };
        const isMySeat = mySeats.includes(index);

        return (
          <div 
            key={index}
            className="absolute w-32 h-32 flex items-center justify-center"
            style={pos}
          >
            <PlayerSeat 
              seatIndex={index}
              seatData={seatData}
              isMySeat={isMySeat}
              onSit={onSit}
              onLeave={onLeave}
            />
          </div>
        );
      })}

      {/* Pot Display */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 bg-black/40 px-4 py-1 rounded-full border border-yellow-500/20 backdrop-blur-sm">
        <span className="text-yellow-400 font-mono text-sm">POT: ${gameState?.pot || 0}</span>
      </div>
    </div>
  );
};

export default GameTable;
