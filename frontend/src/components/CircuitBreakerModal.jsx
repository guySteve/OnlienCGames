import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CircuitBreakerModal - High Traffic Lockdown Display
 *
 * Shown when backend returns CIRCUIT_BREAKER_ACTIVE (503)
 * Uses Oceanic Blue theme to communicate safety/trust during downtime
 */

const CircuitBreakerModal = ({ isOpen, onClose, retryIn }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-squircle-lg border-2 border-blue-500/50 shadow-glow-green max-w-md w-full p-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-4xl"
            >
              ⚡
            </motion.div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-white mb-3">
            High Traffic Detected
          </h2>

          {/* Message */}
          <p className="text-slate-300 text-center mb-6">
            We're experiencing high traffic right now. Our circuit breaker has activated to protect the system.
            Please try again in a moment.
          </p>

          {/* Retry Timer */}
          {retryIn && (
            <div className="bg-black/30 rounded-squircle-sm p-4 mb-6">
              <div className="text-center">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                  Retry Available In
                </div>
                <motion.div
                  key={retryIn}
                  initial={{ scale: 1.2, color: '#fbbf24' }}
                  animate={{ scale: 1, color: '#60a5fa' }}
                  className="text-3xl font-mono font-bold"
                >
                  {retryIn}s
                </motion.div>
              </div>
            </div>
          )}

          {/* Status Indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-blue-500"
            />
            <span>System Protected • Auto-Retry Enabled</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-squircle-sm transition-all shadow-glow-green"
            >
              Got It
            </button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-slate-500 mt-4">
            This is a temporary measure to ensure system stability. Your session is safe.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CircuitBreakerModal;
