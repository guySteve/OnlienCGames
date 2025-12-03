import React from 'react';

const Lobby = ({ rooms, onJoin, onCreate }) => {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 font-serif">
              ROYAL CASINO
            </h1>
            <p className="text-slate-400 mt-2">Select a table to begin</p>
          </div>
          <button 
            onClick={onCreate}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
          >
            Create Private Room
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <div 
              key={room.id}
              className="bg-slate-800/50 border border-white/5 rounded-xl p-6 hover:border-yellow-500/30 transition-all hover:-translate-y-1 cursor-pointer group"
              onClick={() => onJoin(room.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <span className="text-2xl">
                    {room.type === 'BLACKJACK' ? '♠️' : room.type === 'WAR' ? '⚔️' : '🎱'}
                  </span>
                </div>
                <div className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">
                  {room.players}/{room.maxPlayers} Players
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-yellow-400 transition-colors">
                {room.name || `Table #${room.id.substr(0,4)}`}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Min Bet: <span className="text-white font-mono">${room.minBet}</span>
              </p>
              
              <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-500"
                  style={{ width: `${(room.players / room.maxPlayers) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
