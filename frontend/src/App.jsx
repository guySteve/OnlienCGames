// @/App.jsx
import React, { useState, useEffect } from 'react';
import { useGameSocket } from './hooks/useGameSocket';
import { AnimatePresence, motion } from 'framer-motion';

// --- New View & UI Components ---
import { HomeView } from './views/HomeView';
import { GameLobbyView } from './views/GameLobbyView';
import { SettingsView } from './views/SettingsView';
import { Navbar } from './components/ui/Navbar';
import { AnimatedCounter } from './components/ui/AnimatedCounter';
import { CasinoClosedView } from './components/CasinoClosedView';
import BiometricSetupPrompt from './components/BiometricSetupPrompt';

// --- Legacy Components (to be phased out or integrated) ---
import GameTable from './components/GameTable';
import WarTableZones from './components/WarTableZones';
import BingoGame from './components/BingoGame';
import LetItRideTable from './components/LetItRideTable';
import BettingControls from './components/BettingControls';
import SyndicateHUD from './components/SyndicateHUD';
import HappyHourBanner from './components/HappyHourBanner';
import ProvablyFairVerifier from './components/ProvablyFairVerifier';
import SecretComs from './components/SecretComs';


// Mock API for demo purposes
const api = {
  getMe: async () => {
    const res = await fetch('/me'); // NOTE: Using /me as per original server.js
    if (!res.ok) {
        // If the server is down or user is not authenticated, this will fail
        console.error("Failed to fetch user data. Assuming not logged in.");
        return { authenticated: false };
    };
    return res.json();
  },
  logout: async () => {
    await fetch('/logout', { method: 'POST' });
    window.location.reload();
  }
};

const pageVariants = {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    exit: { opacity: 0 },
}

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // The new view state machine: loading, home, lobby, game, bingo, settings
  const [view, setView] = useState('loading');
  const [currentGameType, setCurrentGameType] = useState(null);
  const [showComs, setShowComs] = useState(false);

  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [mySeats, setMySeats] = useState([]);
  const [bingoCards, setBingoCards] = useState([]);


  // Casino operating hours status
  const [casinoStatus, setCasinoStatus] = useState({ isOpen: true, nextOpenTime: null });

  // Biometric setup prompt
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  // Socket Hook
  const { socket, gameState, isConnected, lastEvent, emit } = useGameSocket();

  // 1. Authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { authenticated, user: userData } = await api.getMe();
        if (authenticated) {
          setUser(userData);
          setView('lobby'); // If logged in, go straight to lobby
        } else {
          setView('home'); // Otherwise, show the new home screen
        }
      } catch (err) {
        console.error("Auth error:", err);
        setView('home');
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // 1b. Check casino operating hours (for non-admin users)
  useEffect(() => {
    const checkOperatingHours = async () => {
      try {
        const response = await fetch('/api/casino-status');
        if (response.ok) {
          const data = await response.json();
          setCasinoStatus(data);
        }
      } catch (err) {
        console.error('Failed to check casino status:', err);
      }
    };

    if (user && !user.isAdmin) {
      checkOperatingHours();
      // Check every minute
      const interval = setInterval(checkOperatingHours, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // 1c. Check if user needs biometric setup prompt
  useEffect(() => {
    const checkBiometricSetup = async () => {
      if (!user) return;

      // Check if user declined recently (within 7 days)
      const declined = localStorage.getItem('biometric_prompt_declined');
      if (declined) {
        const declinedTime = parseInt(declined);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        if (declinedTime > sevenDaysAgo) {
          // User declined recently, don't ask again
          return;
        }
      }

      // Check if user already has biometric set up
      try {
        const response = await fetch('/auth/webauthn/authenticators', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticators && data.authenticators.length === 0) {
            // No biometrics set up - show prompt after a short delay
            setTimeout(() => {
              setShowBiometricPrompt(true);
            }, 2000); // 2 second delay so they see the lobby first
          }
        }
      } catch (err) {
        console.error('Failed to check biometric setup:', err);
      }
    };

    checkBiometricSetup();
  }, [user]);

  // 2. Game Logic & Event Handling (mostly unchanged)
  useEffect(() => {
    if (!lastEvent) return;

    switch (lastEvent.type) {
      case 'bingo_card_purchased':
        if (lastEvent.data?.cards) setBingoCards(lastEvent.data.cards);
        break;
      case 'room_created':
      case 'private_war_created':
        setCurrentRoomId(lastEvent.data.roomId);
        setView('game');
        break;
      case 'bingo_room_created':
        setCurrentRoomId(lastEvent.data.roomId);
        setView('bingo');
        break;
      // Add other game events as needed
    }
  }, [lastEvent]);

  // --- Actions ---
  const handleLogin = () => {
    // Redirect to Google OAuth flow
    window.location.href = '/auth/google';
  };

  const handleLogout = async () => {
      await api.logout();
  };

  const handleSettings = () => {
    setView('settings');
  };

  const handleJoinGame = (gameId) => {
    // This is a placeholder. In a real app, you'd use the gameId
    // to find a specific room or create a new one.
    console.log(`Joining game or creating room for game type: ${gameId}`);

    // For now, we just create a generic room based on a mock mapping.
    const gameTypeMap = { '1': 'BLACKJACK', '2': 'WAR', '3': 'BINGO', '4': 'LET_IT_RIDE' };
    const gameType = gameTypeMap[gameId] || 'WAR';

    setCurrentGameType(gameType);

    if (gameType === 'BINGO') {
        emit('create_bingo_room', {});
    } else if (gameType === 'BLACKJACK') {
        emit('create_blackjack_room', {});
    } else if (gameType === 'LET_IT_RIDE') {
        emit('create_let_it_ride_room', {});
    } else {
        emit('create_room', {});
    }
  };

  const handleExitGame = () => {
    emit('leave_room');
    setCurrentRoomId(null);
    setCurrentGameType(null);
    setMySeats([]);
    setBingoCards([]);
    setView('lobby');
  };

  // --- Render Logic ---
  
  const renderView = () => {
      if (isLoading) {
          return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                {/* Simple loading spinner */}
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"
                />
            </div>
          )
      }

      if (!user) {
          return <HomeView onPlayNow={handleLogin} />
      }

      // --- Authenticated Views ---
      return (
        <div className="min-h-screen bg-slate-900">
            {/* Only show navbar if casino is open or user is admin */}
            {(casinoStatus.isOpen || user.isAdmin) && (
              <Navbar
                user={user}
                onLogout={handleLogout}
                onSettings={handleSettings}
                onComs={() => setShowComs(true)}
                socket={socket}
              />
            )}

            {/* Show casino closed view for non-admins when closed */}
            {!casinoStatus.isOpen && !user.isAdmin ? (
              <CasinoClosedView
                nextOpenTime={casinoStatus.nextOpenTime}
                msUntilOpen={casinoStatus.msUntilOpen}
                onLoginSuccess={(adminUser) => {
                  setUser(adminUser);
                  window.location.reload();
                }}
              />
            ) : (
              <AnimatePresence mode="wait">
                  {view === 'lobby' && (
                      <motion.div key="lobby">
                          <GameLobbyView
                            onJoinGame={handleJoinGame}
                            socket={socket}
                            user={user}
                          />
                      </motion.div>
                  )}
                  {view === 'settings' && (
                      <motion.div key="settings" variants={pageVariants} initial="initial" animate="in" exit="exit">
                          <SettingsView user={user} onBack={() => setView('lobby')} />
                      </motion.div>
                  )}
                  {view === 'game' && (
                       <motion.div key="game" variants={pageVariants} initial="initial" animate="in" exit="exit">
                          <GameTableWrapper
                              gameState={gameState}
                              gameType={currentGameType}
                              mySeats={mySeats}
                              onExit={handleExitGame}
                              user={user}
                              currentRoomId={currentRoomId}
                              emit={emit}
                              socket={socket}
                          />
                       </motion.div>
                  )}
                  {view === 'bingo' && (
                       <motion.div key="bingo" variants={pageVariants} initial="initial" animate="in" exit="exit">
                          <BingoGame
                              gameState={gameState}
                              playerCard={bingoCards}
                              onBuyCard={() => emit('buy_bingo_card', {})}
                              onClaimBingo={(cardId) => emit('claim_bingo', { cardId })}
                              onExit={handleExitGame}
                          />
                       </motion.div>
                  )}
              </AnimatePresence>
            )}
        </div>
      )
  }

  return (
      <>
        <AnimatePresence mode="wait">
          {renderView()}
        </AnimatePresence>

        {/* Secret Comms - shows over everything */}
        <AnimatePresence>
            {showComs && user && (
                <SecretComs
                    socket={socket}
                    currentUser={user}
                    onClose={() => setShowComs(false)}
                />
            )}
        </AnimatePresence>

        {/* Biometric setup prompt - shows after login if not set up */}
        <BiometricSetupPrompt
          isOpen={showBiometricPrompt}
          onClose={() => setShowBiometricPrompt(false)}
          onSuccess={() => {
            console.log('🎉 Biometric login enabled!');
            setShowBiometricPrompt(false);
          }}
        />
      </>
  )
}

// Wrapper for the legacy GameTable to integrate with the new structure
const GameTableWrapper = ({ gameState, gameType, mySeats, onExit, user, currentRoomId, emit, socket }) => {
    const [showProvablyFair, setShowProvablyFair] = useState(false);

    // For WAR games, use WarTableZones component
    if (gameType === 'WAR') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/10 to-slate-900 overflow-hidden flex flex-col">
                <ProvablyFairVerifier
                    gameState={gameState}
                    gameSessionId={currentRoomId}
                    isOpen={showProvablyFair}
                    onClose={() => setShowProvablyFair(false)}
                />
                <WarTableZones
                    socket={socket}
                    roomId={currentRoomId}
                    user={user}
                    onExit={onExit}
                />
            </div>
        );
    }

    if (gameType === 'LET_IT_RIDE') {
        return <LetItRideTable socket={socket} gameState={gameState} user={user} />;
    }

    // For other games (Blackjack, Let It Ride), use the legacy GameTable
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/10 to-slate-900 overflow-hidden flex flex-col">
            <ProvablyFairVerifier
                gameState={gameState}
                gameSessionId={currentRoomId}
                isOpen={showProvablyFair}
                onClose={() => setShowProvablyFair(false)}
            />
            {/* Using a simplified header for in-game view */}
            <header className="flex-shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-4 py-3 sm:px-6 sm:py-4 z-10 safe-area-top">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                <button onClick={onExit} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
                    <span>←</span> Lobby
                </button>
                <div className="bg-black/30 px-3 py-1.5 rounded-full border border-yellow-500/20 text-yellow-400 font-mono text-sm">
                    $<AnimatedCounter value={user?.chipBalance || 0} />
                </div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto py-4 sm:py-8">
                <GameTable
                gameState={gameState}
                mySeats={mySeats}
                onSit={(seatIndex) => emit('sit_at_seat', { seatIndex, chips: 1000 })}
                onLeave={(seatIndex) => emit('leave_seat', { seatIndex })}
                />
            </main>
            <AnimatePresence>
                {gameState?.bettingPhase && mySeats.length > 0 && (
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}>
                    <BettingControls
                        onBet={(amount) => mySeats.forEach(seatIdx => emit('place_bet', { seatIndex: seatIdx, betAmount: amount }))}
                        minBet={gameState?.minBet || 10}
                        balance={user?.chipBalance || 0}
                        disabled={!isConnected}
                    />
                </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}


export default App;