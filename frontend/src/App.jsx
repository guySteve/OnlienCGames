import React, { useState, useEffect } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import GameTable from './components/GameTable';
import Lobby from './components/Lobby';
import BettingControls from './components/BettingControls';
import { AnimatePresence, motion } from 'framer-motion';

// Mock API for demo purposes - in real app, use axios/fetch
const api = {
  getMe: async () => {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },
  getRooms: async () => {
    // Simulate fetch
    return [
      { id: '1', name: 'High Rollers', type: 'BLACKJACK', players: 3, maxPlayers: 5, minBet: 100 },
      { id: '2', name: 'Casual War', type: 'WAR', players: 1, maxPlayers: 5, minBet: 10 },
      { id: '3', name: 'Bingo Hall', type: 'BINGO', players: 12, maxPlayers: 50, minBet: 5 },
    ];
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('loading'); // loading, login, lobby, game
  const [rooms, setRooms] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [mySeats, setMySeats] = useState([]); // Array of seat indexes I occupy

  // Socket Hook
  const { socket, gameState, isConnected, lastEvent, emit } = useGameSocket();

  // 1. Authentication & Persistence
  useEffect(() => {
    const initAuth = async () => {
      try {
        const userData = await api.getMe();
        setUser(userData);
        setView('lobby');
        loadRooms();
      } catch (e) {
        console.log('Not authenticated');
        setView('login');
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // Load Rooms
  const loadRooms = async () => {
    const data = await api.getRooms();
    setRooms(data);
  };

  // 2. Game Logic & Event Handling
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'cards_dealt':
        // Animation is handled by AnimatePresence in GameTable/Card components
        // triggered by the state update that usually accompanies this event
        break;
      case 'round_result':
        // Show result overlay (could be a toast or modal)
        console.log('Round Result:', lastEvent.data);
        break;
    }
  }, [lastEvent]);

  // Actions
  const handleLogin = () => {
    // In a real app, redirect to OAuth or show login form
    window.location.href = '/auth/google'; 
  };

  const handleJoinRoom = (roomId) => {
    setCurrentRoomId(roomId);
    emit('join_room', { roomId });
    setView('game');
  };

  const handleSit = (seatIndex) => {
    emit('sit_at_seat', { seatIndex, chips: 1000 }); // Default buy-in
    setMySeats(prev => [...prev, seatIndex]);
  };

  const handleLeaveSeat = (seatIndex) => {
    emit('leave_seat', { seatIndex });
    setMySeats(prev => prev.filter(s => s !== seatIndex));
  };

  const handleBet = (amount) => {
    // Place bet for all my active seats that need a bet
    // Simplified: just bet for the first one for now or pass seatIndex
    mySeats.forEach(seatIdx => {
      emit('place_bet', { seatIndex: seatIdx, betAmount: amount });
    });
  };

  const handleExitGame = () => {
    emit('leave_room');
    setCurrentRoomId(null);
    setMySeats([]);
    setView('lobby');
    loadRooms();
  };

  // 3. Render Logic
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full"
        />
        <h2 className="ml-4 text-xl text-yellow-500 font-serif">Loading Casino...</h2>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-bold text-yellow-500 font-serif mb-8">ROYAL CASINO</h1>
        <button 
          onClick={handleLogin}
          className="px-8 py-4 bg-white text-slate-900 font-bold rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" />
          Sign in with Google
        </button>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <Lobby 
        rooms={rooms} 
        onJoin={handleJoinRoom} 
        onCreate={() => console.log('Create room')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <button onClick={handleExitGame} className="text-slate-400 hover:text-white">
            ← Lobby
          </button>
          <span className="font-bold text-yellow-500">
            {rooms.find(r => r.id === currentRoomId)?.name || 'Game Room'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-black/30 px-3 py-1 rounded-full border border-yellow-500/20 text-yellow-400 font-mono">
            ${user?.chipBalance?.toLocaleString() || 0}
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden">
            {user?.avatar && <img src={user.avatar} alt="Me" />}
          </div>
        </div>
      </header>

      {/* Main Game Area - The Visual Canvas */}
      <main className="flex-1 relative flex items-center justify-center p-4 md:p-8">
        <GameTable 
          gameState={gameState}
          mySeats={mySeats}
          onSit={handleSit}
          onLeave={handleLeaveSeat}
        />
      </main>

      {/* Betting Controls */}
      <AnimatePresence>
        {gameState?.bettingPhase && mySeats.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
          >
            <BettingControls 
              onBet={handleBet}
              minBet={gameState?.minBet || 10}
              balance={user?.chipBalance || 0}
              disabled={!isConnected}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
