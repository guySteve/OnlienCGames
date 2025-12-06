// @/components/CasinoClosedView.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BiometricLogin from './BiometricLogin';

const containerVariants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  exit: { opacity: 0 }
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.02, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export function CasinoClosedView({ nextOpenTime, onLoginSuccess }) {
  const [timeUntilOpen, setTimeUntilOpen] = useState('');
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);

  useEffect(() => {
    if (!nextOpenTime) return;

    const updateTimer = () => {
      const now = new Date();
      const openTime = new Date(nextOpenTime);
      const diff = openTime - now;

      if (diff <= 0) {
        setTimeUntilOpen('Casino is opening...');
        // Refresh page when casino opens
        setTimeout(() => window.location.reload(), 2000);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilOpen(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextOpenTime]);

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="in"
      exit="exit"
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-900"
    >
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <motion.div
          variants={pulseVariants}
          animate="pulse"
          className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-slate-900 to-orange-900/30"
        />
      </div>

      <div className="relative z-10 text-center px-4 max-w-2xl">
        {/* Casino Closed Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="mb-8"
        >
          <div className="text-8xl mb-4">🌙</div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-5xl md:text-6xl font-black text-white mb-4"
        >
          Casino Closed
        </motion.h1>

        {/* Operating Hours */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6"
        >
          <p className="text-xl text-slate-300 mb-2">
            🕙 Operating Hours
          </p>
          <p className="text-3xl font-bold text-yellow-400">
            10 PM - 2 AM ET
          </p>
          {timeUntilOpen && (
            <p className="text-slate-400 mt-4">
              Opens in: <span className="text-white font-mono">{timeUntilOpen}</span>
            </p>
          )}
        </motion.div>

        {/* Admin Fast Login */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {!showBiometricLogin ? (
            <button
              onClick={() => setShowBiometricLogin(true)}
              className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <span className="relative z-10">🔐 Admin Fast Login</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ) : (
            <div className="mt-8">
              <BiometricLogin
                onSuccess={(user) => {
                  console.log('Admin logged in:', user);
                  if (onLoginSuccess) {
                    onLoginSuccess(user);
                  } else {
                    window.location.reload();
                  }
                }}
                adminEmail="smmohamed60@gmail.com"
              />
              <button
                onClick={() => setShowBiometricLogin(false)}
                className="mt-4 text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </motion.div>

        {/* Info Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-slate-500 mt-8 text-sm"
        >
          The nightclub is currently closed. Come back during operating hours to play!
        </motion.p>
      </div>
    </motion.div>
  );
}
