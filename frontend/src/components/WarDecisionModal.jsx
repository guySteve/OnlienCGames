// @/components/WarDecisionModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const modalVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

export const WarDecisionModal = ({ isOpen, onSurrender, onWar, betAmount }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={modalVariants}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 border border-yellow-500/30 text-center max-w-sm w-full"
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 10 }}
          >
            <h2 className="text-3xl font-extrabold text-yellow-400 mb-4">
              🔥 Go to War? 🔥
            </h2>
            <p className="text-white text-lg mb-6">
              You tied with the dealer! Choose your fate:
            </p>

            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onWar}
                className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-lg shadow-lg hover:from-red-700 hover:to-red-900 transition-all transform hover:-translate-y-0.5"
              >
                Go to War! (Bet another ${betAmount})
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSurrender}
                className="w-full py-3 px-6 bg-slate-700 text-slate-300 font-medium rounded-lg shadow-md hover:bg-slate-600 transition-all transform hover:-translate-y-0.5"
              >
                Surrender (Lose ${betAmount / 2})
              </motion.button>
            </div>
            <p className="text-slate-400 text-sm mt-6">
              (Choose wisely, your chips depend on it!)
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};