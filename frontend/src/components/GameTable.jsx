import React from 'react';
import PlayerSeat from './PlayerSeat';
import Card from './Card';
import { AnimatePresence, motion } from 'framer-motion';

const GameTable = ({ gameState, mySeats, onSit, onLeave }) => {
  // Find my primary seat (first seated position)
  const mySeatIndex = mySeats.length > 0 ? mySeats[0] : -1;
  const mySeatData = mySeatIndex >= 0 ? gameState?.seats?.[mySeatIndex] : null;
  
  // Get other players (non-my seats that are occupied)
  const otherPlayers = gameState?.seats?.filter((seat, idx) => 
    !mySeats.includes(idx) && seat && !seat.empty
  ) || [];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 p-2 sm:p-4">
      {/* Dealer/House Section - Compact */}
      <div className="bg-gradient-to-br from-emerald-900/80 to-emerald-950/80 rounded-2xl p-4 border border-emerald-700/30 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-lg sm:text-xl">
              🎰
            </div>
            <div>
              <div className="text-yellow-500/70 text-xs uppercase tracking-wider">Dealer</div>
              <div className="text-white font-bold text-sm sm:text-base">House</div>
            </div>
          </div>
          
          {/* Dealer Cards */}
          <div className="flex gap-1">
            <AnimatePresence>
              {gameState?.houseCard ? (
                <Card {...gameState.houseCard} index={0} compact />
              ) : gameState?.dealerHand?.map((c, i) => (
                <Card key={i} {...c} index={i} compact />
              ))}
            </AnimatePresence>
            {(!gameState?.houseCard && (!gameState?.dealerHand || gameState.dealerHand.length === 0)) && (
              <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg border-2 border-dashed border-white/20 bg-black/20 flex items-center justify-center">
                <span className="text-white/30 text-xs">DECK</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Pot Display */}
        {(gameState?.pot > 0) && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-3 bg-black/30 rounded-full px-4 py-2 inline-flex items-center gap-2"
          >
            <span className="text-yellow-400 font-mono font-bold">${gameState.pot.toLocaleString()}</span>
            <span className="text-yellow-500/60 text-xs">POT</span>
          </motion.div>
        )}
      </div>

      {/* Other Players - Condensed Row */}
      {otherPlayers.length > 0 && (
        <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Other Players</div>
          <div className="flex flex-wrap gap-2">
            {otherPlayers.map((seat, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 border border-white/5"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-600">
                  {seat.photo ? (
                    <img src={seat.photo} alt={seat.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-slate-400">
                      {seat.name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="text-xs">
                  <div className="text-white font-medium truncate max-w-20">{seat.name}</div>
                  <div className="text-yellow-400 font-mono">${seat.chips}</div>
                </div>
                {seat.card && (
                  <div className="ml-1">
                    <Card {...seat.card} index={0} micro />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Seat - Prominent Focus Area */}
      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-4 sm:p-6 border border-yellow-500/20 shadow-2xl">
        {mySeatData && !mySeatData.empty ? (
          <div className="space-y-4">
            {/* My Info Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-3 border-yellow-400 shadow-lg ring-4 ring-yellow-400/20">
                  {mySeatData.photo ? (
                    <img src={mySeatData.photo} alt="Me" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl font-bold text-black">
                      {mySeatData.name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-yellow-400 text-xs uppercase tracking-wider">Your Seat</div>
                  <div className="text-white font-bold text-lg sm:text-xl">{mySeatData.name}</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-slate-400 text-xs">Chips</div>
                <div className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-mono">
                  ${mySeatData.chips?.toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* My Cards - Large Display */}
            <div className="flex justify-center gap-3 py-4">
              <AnimatePresence>
                {mySeatData.card ? (
                  <Card {...mySeatData.card} index={0} large />
                ) : mySeatData.hands?.map((hand, hIdx) => (
                  hand.cards?.map((c, cIdx) => (
                    <Card key={`${hIdx}-${cIdx}`} {...c} index={cIdx} large />
                  ))
                ))}
              </AnimatePresence>
              {!mySeatData.card && (!mySeatData.hands || mySeatData.hands.length === 0) && (
                <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl border-2 border-dashed border-white/20 bg-black/20 flex items-center justify-center">
                  <span className="text-white/40 text-sm">Waiting...</span>
                </div>
              )}
            </div>
            
            {/* Current Bet */}
            {mySeatData.currentBet > 0 && (
              <div className="flex justify-center">
                <div className="bg-black/40 rounded-full px-6 py-2 flex items-center gap-3">
                  <div className="flex -space-x-1">
                    <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white/20" />
                    {mySeatData.currentBet > 50 && <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white/20" />}
                    {mySeatData.currentBet > 100 && <div className="w-6 h-6 rounded-full bg-black border-2 border-white/20" />}
                  </div>
                  <span className="text-white font-mono font-bold">${mySeatData.currentBet}</span>
                </div>
              </div>
            )}
            
            {/* Leave Button */}
            <div className="flex justify-center">
              <button 
                onClick={() => onLeave(mySeatIndex)}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Leave Seat
              </button>
            </div>
          </div>
        ) : (
          /* Empty Seat CTA */
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🪑</div>
            <h3 className="text-xl font-bold text-white mb-2">Take a Seat</h3>
            <p className="text-slate-400 text-sm mb-4">Join the table to start playing</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[0, 1, 2, 3, 4].map((seatIndex) => {
                const seat = gameState?.seats?.[seatIndex];
                const isAvailable = !seat || seat.empty;
                return (
                  <button
                    key={seatIndex}
                    onClick={() => isAvailable && onSit(seatIndex)}
                    disabled={!isAvailable}
                    className={`
                      px-4 py-2 rounded-lg font-medium text-sm transition-all
                      ${isAvailable 
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {isAvailable ? `Seat ${seatIndex + 1}` : 'Taken'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Game Status */}
      {gameState?.status && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-yellow-400 font-medium py-2"
        >
          {gameState.status}
        </motion.div>
      )}
    </div>
  );
};

export default GameTable;
