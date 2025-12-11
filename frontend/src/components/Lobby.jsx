import React from 'react';
import { motion } from 'framer-motion';

const Lobby = ({ rooms, onJoin, onCreate }) => {
  const gameTypeIcons = {
    BLACKJACK: '🃏',
    WAR: '⚔️'
  };

  const gameTypeColors = {
    BLACKJACK: 'from-emerald-500/20 to-emerald-900/20 border-emerald-500/30',
    WAR: 'from-red-500/20 to-red-900/20 border-red-500/30'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
      </div>
      
      <div className="relative z-10 p-4 sm:p-8 pb-20 safe-area-inset">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600"
              >
                🃏 Moe's Card Room
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-slate-400 mt-2 text-sm sm:text-base"
              >
                Select a table to begin your game
              </motion.p>
            </div>
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCreate}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 transition-all text-sm sm:text-base"
            >
              + Create Room
            </motion.button>
          </header>

          {/* Room Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {rooms.map((room, index) => (
              <motion.div 
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={() => onJoin(room.id)}
                className={`
                  bg-gradient-to-br ${gameTypeColors[room.type] || gameTypeColors.WAR}
                  border rounded-2xl p-5 sm:p-6 cursor-pointer transition-all
                  hover:shadow-xl hover:shadow-yellow-500/10 group
                `}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/30 flex items-center justify-center text-2xl sm:text-3xl shadow-inner">
                    {gameTypeIcons[room.type] || '🎮'}
                  </div>
                  <div className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    ${room.players < room.maxPlayers 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }
                  `}>
                    {room.players}/{room.maxPlayers}
                  </div>
                </div>
                
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1 group-hover:text-yellow-400 transition-colors">
                  {room.name || `${room.type} Table #${room.id.substring(0, 4)}`}
                </h3>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                  <div>
                    <span className="text-slate-400 text-xs">Min Bet</span>
                    <div className="text-yellow-400 font-mono font-bold">${room.minBet}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(room.players, 5))].map((_, i) => (
                      <div key={i} className="w-5 h-5 rounded-full bg-slate-600 border-2 border-slate-500 -ml-1 first:ml-0" />
                    ))}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-3 h-1.5 bg-black/30 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(room.players / room.maxPlayers) * 100}%` }}
                    transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Empty State */}
          {rooms.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 sm:py-20"
            >
              <div className="text-5xl sm:text-6xl mb-4">🎲</div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No Active Tables</h3>
              <p className="text-slate-400 mb-6 text-sm sm:text-base">Be the first to create a game room!</p>
              <button 
                onClick={onCreate}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-colors"
              >
                Create First Room
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
