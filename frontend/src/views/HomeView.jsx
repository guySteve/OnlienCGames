// @/views/HomeView.jsx
import React, { useState } from 'react';
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
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { username, email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        return;
      }

      // Reload page to trigger auth check
      window.location.reload();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

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

      <div className="relative z-10 text-center px-4 max-w-md w-full">
        <motion.h1
          variants={titleContainerVariants}
          className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-8"
          style={{ textShadow: '0 5px 25px rgba(0,0,0,0.3)'}}
        >
          <AnimatedWord>Moe's</AnimatedWord> <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-red-500">
            <AnimatedWord>Card</AnimatedWord> <AnimatedWord>Room</AnimatedWord>
          </span>
        </motion.h1>

        <motion.div
          variants={buttonVariants}
          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl"
        >
          {/* Tab Buttons */}
          <div className="flex mb-6 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md transition-all ${
                mode === 'login'
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md transition-all ${
                mode === 'register'
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
            />

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          {/* Google OAuth Option */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={onPlayNow}
              className="w-full py-2 text-white/60 hover:text-white text-sm transition-colors"
            >
              Or continue with Google
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
