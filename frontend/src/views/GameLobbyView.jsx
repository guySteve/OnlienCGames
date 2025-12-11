// @/views/GameLobbyView.jsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameCard } from '../components/ui/GameCard';

const allGames = [
  { id: '1', name: 'Blackjack', type: 'BLACKJACK', category: 'Card Games', description: 'Classic 21. Beat the dealer.', players: 12, minBet: 10 },
  { id: '2', name: 'War', type: 'WAR', category: 'Card Games', description: 'High card wins. Simple & fast.', players: 8, minBet: 5 },
];

const filters = ['All Games', 'Card Games'];

const lobbyVariants = {
  initial: { opacity: 0, scale: 1.1, y: 50 },
  in: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      duration: 0.5, 
      ease: [0.43, 0.13, 0.23, 0.96],
      staggerChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    y: -50,
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
};

const gridVariants = {
  in: {
    transition: {
      staggerChildren: 0.08,
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
        className="min-h-screen bg-slate-900 text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8"
      >
      <div className="max-w-7xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-black text-center mb-4"
        >
          Choose Your Game
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400 text-center mb-12 max-w-xl mx-auto"
        >
          Select from our collection of classic and community games. More experiences are coming soon.
        </motion.p>
        
        {/* Filter Pills */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center items-center gap-2 mb-12 p-1.5 bg-slate-900/50 rounded-full border border-white/10 w-fit mx-auto"
        >
          {filters.map(filter => (
            <FilterPill
              key={filter}
              label={filter}
              isActive={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            />
          ))}
        </motion.div>
        
        {/* Animated Game Grid */}
        <motion.div 
          variants={gridVariants}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8"
        >
          <AnimatePresence>
            {filteredGames.map(game => (
              <GameCard key={game.id} game={game} onClick={onJoinGame} />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
