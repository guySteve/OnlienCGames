// @/views/GameLobbyView.jsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameCard } from '../components/ui/GameCard';

const allGames = [
  { id: '1', name: 'Blackjack', type: 'BLACKJACK', category: 'Card Games', description: 'Coming Soon', players: 0, minBet: 10, disabled: true },
  { id: '2', name: 'War', type: 'WAR', category: 'Card Games', description: 'High card wins. Battle it out!', players: 0, minBet: 5 },
];

const filters = ['All Games', 'Card Games'];

// VIP Unlocking Animation - Elements appear sequentially like resolving
const lobbyVariants = {
  initial: { opacity: 0 },
  in: {
    opacity: 1,
    transition: {
      duration: 0.5,
      staggerChildren: 0.2, // Slower stagger for dramatic effect
      delayChildren: 0.3    // Start after a brief pause
    }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
};

// VIP Welcome - Fades in with glow effect
const welcomeVariants = {
  initial: { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
  in: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: [0.43, 0.13, 0.23, 0.96]
    }
  }
};

// Each section resolves (opposite of dissolving)
const sectionVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(8px)' },
  in: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.6,
      ease: 'easeOut'
    }
  }
};

// Game cards appear with a shimmer effect
const gridVariants = {
  initial: { opacity: 0 },
  in: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15, // Each card appears sequentially
      delayChildren: 0.2
    }
  }
}

const FilterPill = ({ label, isActive, onClick }) => (
  <motion.button
    onClick={onClick}
    className="relative px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:text-white"
  >
    {isActive && (
      <motion.div
        layoutId="activePill"
        className="absolute inset-0 rounded-full bg-slate-800/80 border border-white/10"
        style={{ borderRadius: 9999 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    )}
    <span className="relative z-10">{label}</span>
  </motion.button>
);

export function GameLobbyView({ onJoinGame, socket, user }) {
  const [activeFilter, setActiveFilter] = useState('All Games');

  const filteredGames = useMemo(() => {
    if (activeFilter === 'All Games') return allGames;
    return allGames.filter(g => g.category === activeFilter);
  }, [activeFilter]);

  return (
      <motion.div
        variants={lobbyVariants}
        initial="initial"
        animate="in"
        exit="exit"
        className="min-h-screen bg-slate-900 text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      >
      {/* VIP Glow Effect Background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-purple-900/20 to-red-900/20 pointer-events-none"
        style={{
          filter: 'blur(100px)'
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* VIP Welcome Message - Resolves First */}
        <motion.div
          variants={welcomeVariants}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5, type: 'spring' }}
            className="inline-block mb-4 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30"
          >
            <span className="text-yellow-400 font-bold text-sm">✨ VIP ACCESS GRANTED ✨</span>
          </motion.div>
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
            Welcome to Moe's Card Room
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            {user?.displayName}, your exclusive gaming experience awaits
          </p>
        </motion.div>

        {/* Section 1: Game Categories - Resolves Second */}
        <motion.div
          variants={sectionVariants}
          className="mb-12"
        >
          <div className="flex justify-center items-center gap-2 p-1.5 bg-slate-900/50 rounded-full border border-white/10 w-fit mx-auto backdrop-blur-sm">
            {filters.map(filter => (
              <FilterPill
                key={filter}
                label={filter}
                isActive={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              />
            ))}
          </div>
        </motion.div>

        {/* Section 2: Game Grid - Resolves Third */}
        <motion.div
          variants={sectionVariants}
        >
          <motion.div
            variants={gridVariants}
            initial="initial"
            animate="in"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 justify-items-center"
          >
            <AnimatePresence>
              {filteredGames.map(game => (
                <GameCard key={game.id} game={game} onClick={onJoinGame} />
              ))}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
