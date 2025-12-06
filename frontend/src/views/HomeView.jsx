// @/views/HomeView.jsx
import React from 'react';
import { motion } from 'framer-motion';

const containerVariants = {
  initial: { opacity: 0 },
  in: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
      delayChildren: 0.2,
    },
  },
  exit: {
    opacity: 0,
    y: -50,
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
};

const titleContainerVariants = {
  initial: {},
  in: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const wordVariants = {
  initial: { opacity: 0, y: 30 },
  in: { opacity: 1, y: 0, transition: { type: 'spring', damping: 15, stiffness: 150 } },
};

const buttonVariants = {
    initial: { opacity: 0, scale: 0.8 },
    in: { opacity: 1, scale: 1, transition: { delay: 1.2, duration: 0.5, ease: 'easeOut' }}
}

const AnimatedWord = ({ children }) => (
    <span className="inline-block overflow-hidden">
        <motion.span variants={wordVariants} className="inline-block">
            {children}
        </motion.span>
    </span>
);

export function HomeView({ onPlayNow }) {
  return (
    <motion.div
      key="home-view"
      variants={containerVariants}
      initial="initial"
      animate="in"
      exit="exit"
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-900"
    >
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 z-0">
        <div className="animate-breathing-gradient absolute inset-0 bg-gradient-to-br from-cyan-900/50 via-purple-900/50 to-red-900/50" />
      </div>
      
      <div className="relative z-10 text-center px-4">
        <motion.h1
          variants={titleContainerVariants}
          className="text-5xl md:text-7xl lg:text-8xl font-black text-white"
          style={{ textShadow: '0 5px 25px rgba(0,0,0,0.3)'}}
        >
          <AnimatedWord>Welcome</AnimatedWord> <AnimatedWord>To</AnimatedWord> <br />
          <AnimatedWord>The</AnimatedWord> <AnimatedWord>Future</AnimatedWord> <br />
          <AnimatedWord>Of</AnimatedWord> <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-red-500"><AnimatedWord>Gaming.</AnimatedWord></span>
        </motion.h1>

        <motion.div variants={buttonVariants}>
            <motion.button
                onClick={onPlayNow}
                className="mt-12 px-10 py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold text-lg rounded-full shadow-2xl shadow-black/50"
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
                Play Now
            </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
