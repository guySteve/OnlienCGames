import React, { useState, useEffect } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import GameTable from './components/GameTable';
import Lobby from './components/Lobby';
import BingoGame from './components/BingoGame';
import BettingControls from './components/BettingControls';
import SyndicateHUD from './components/SyndicateHUD';
import HappyHourBanner from './components/HappyHourBanner';
import ProvablyFairVerifier from './components/ProvablyFairVerifier';
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
  const [view, setView] = useState('loading'); // loading, login, lobby, game, bingo
  const [rooms, setRooms] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [mySeats, setMySeats] = useState([]); // Array of seat indexes I occupy
  const [bingoCards, setBingoCards] = useState([]); // Bingo cards for the player
  const [syndicateExpanded, setSyndicateExpanded] = useState(false);
  const [showProvablyFair, setShowProvablyFair] = useState(false);

  // Socket Hook
  const { gameState, isConnected, lastEvent, emit, socket } = useGameSocket();

  // 1. Authentication & Persistence
  useEffect(() => {
    const initAuth = async () => {
      // Development preview mode via URL params
      const urlParams = new URLSearchParams(window.location.search);
      const previewMode = urlParams.get('preview');
      
      if (previewMode) {
        setUser({ displayName: 'Demo User', chipBalance: 10000, avatar: null });
        setRooms([
          { id: '1', name: 'High Rollers', type: 'BLACKJACK', players: 3, maxPlayers: 5, minBet: 100 },
          { id: '2', name: 'Casual War', type: 'WAR', players: 1, maxPlayers: 5, minBet: 10 },
          { id: '3', name: 'Bingo Hall', type: 'BINGO', players: 12, maxPlayers: 50, minBet: 5 },
        ]);
        setView(previewMode);
        setIsLoading(false);
        return;
      }
      
      try {
        const userData = await api.getMe();
        setUser(userData);
        setView('lobby');
        loadRooms();
      } catch {
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
        break;
      case 'round_result':
        console.log('Round Result:', lastEvent.data);
        break;
      case 'bingo_card_purchased':
        if (lastEvent.data?.cards) {
          setBingoCards(lastEvent.data.cards);
        }
        break;
      default:
        break;
    }
  }, [lastEvent]);

  // Actions
  const handleLogin = () => {
    window.location.href = '/auth/google'; 
  };

  const handleJoinRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    setCurrentRoomId(roomId);
    
    if (room?.type === 'BINGO') {
      emit('join_bingo_room', { roomId });
      setView('bingo');
    } else {
      emit('join_room', { roomId });
      setView('game');
    }
  };

  const handleSit = (seatIndex) => {
    emit('sit_at_seat', { seatIndex, chips: 1000 });
    setMySeats(prev => [...prev, seatIndex]);
  };

  const handleLeaveSeat = (seatIndex) => {
    emit('leave_seat', { seatIndex });
    setMySeats(prev => prev.filter(s => s !== seatIndex));
  };

  const handleBet = (amount) => {
    mySeats.forEach(seatIdx => {
      emit('place_bet', { seatIndex: seatIdx, betAmount: amount });
    });
  };

  const handleExitGame = () => {
    emit('leave_room');
    setCurrentRoomId(null);
    setMySeats([]);
    setBingoCards([]);
    setView('lobby');
    loadRooms();
  };

  const handleBuyBingoCard = () => {
    emit('buy_bingo_card', {});
  };

  const handleClaimBingo = (cardId) => {
    emit('claim_bingo', { cardId });
  };

  // 3. Render Logic
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-xl text-yellow-500 font-bold">Loading Casino...</h2>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 mb-4">
            🎰 Moe's Casino
          </h1>
          <p className="text-slate-400 mb-8">Sign in to start playing</p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogin}
            className="px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-gray-100 transition-colors flex items-center gap-3 mx-auto shadow-xl"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" />
            Sign in with Google
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        {/* Happy Hour Banner in Lobby */}
        <HappyHourBanner socket={socket} />

        <Lobby
          rooms={rooms}
          onJoin={handleJoinRoom}
          onCreate={() => console.log('Create room')}
        />
      </div>
    );
  }

  if (view === 'bingo') {
    return (
      <BingoGame
        gameState={gameState}
        playerCard={bingoCards}
        onBuyCard={handleBuyBingoCard}
        onClaimBingo={handleClaimBingo}
        onExit={handleExitGame}
      />
    );
  }

  // Default: Card Game View (War/Blackjack)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/10 to-slate-900 overflow-hidden flex flex-col">
      {/* Happy Hour Banner */}
      <HappyHourBanner socket={socket} />

      {/* Syndicate HUD */}
      {user && (
        <SyndicateHUD
          socket={socket}
          userId={user?.dbId}
          isExpanded={syndicateExpanded}
          onToggle={() => setSyndicateExpanded(!syndicateExpanded)}
        />
      )}

      {/* Provably Fair Modal */}
      <ProvablyFairVerifier
        gameState={gameState}
        gameSessionId={currentRoomId}
        isOpen={showProvablyFair}
        onClose={() => setShowProvablyFair(false)}
      />

      {/* Top Bar */}
      <header className="flex-shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4 z-50 safe-area-top">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={handleExitGame} 
              className="text-slate-400 hover:text-white flex items-center gap-1 text-sm sm:text-base"
            >
              <span>←</span>
              <span className="hidden sm:inline">Lobby</span>
            </button>
            <div className="hidden sm:block h-6 w-px bg-white/10" />
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 text-sm sm:text-base">
              {rooms.find(r => r.id === currentRoomId)?.name || 'Game Room'}
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Provably Fair Button */}
            <button
              onClick={() => setShowProvablyFair(true)}
              className="p-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
              title="Verify Game Fairness"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </button>
            <div className="bg-black/30 px-3 py-1.5 rounded-full border border-yellow-500/20 text-yellow-400 font-mono text-sm sm:text-base">
              ${user?.chipBalance?.toLocaleString() || 0}
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 overflow-hidden shadow-lg">
              {user?.avatar ? (
                <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-black font-bold">
                  {user?.displayName?.charAt(0) || '?'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 overflow-y-auto py-4 sm:py-8">
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
