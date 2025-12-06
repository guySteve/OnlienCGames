// @/components/ui/Navbar.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';

const navVariants = {
    initial: { y: -80, opacity: 0 },
    in: { y: 0, opacity: 1, transition: { delay: 0.5, duration: 0.5, ease: 'easeOut' }},
    exit: { y: -80, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' }}
}

export function Navbar({ user, onLogout }) {
  return (
    <motion.header
      variants={navVariants}
      initial="initial"
      animate="in"
      exit="exit"
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="safe-area-top m-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 overflow-hidden shadow-lg p-0.5">
                {user?.avatar ? (
                    <img src={user.avatar} alt="You" className="w-full h-full object-cover rounded-full" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 rounded-full text-white font-bold">
                    {user?.displayName?.charAt(0) || '?'}
                    </div>
                )}
            </div>
            <div>
                <p className="font-bold text-white text-sm leading-tight">{user?.displayName || 'Player'}</p>
                <p className="text-slate-400 text-xs leading-tight">Welcome Back</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-black/30 px-4 py-2 rounded-full border border-yellow-500/20 text-yellow-400 font-mono text-lg">
              $<AnimatedCounter value={user?.chipBalance || 0} />
            </div>
            
            {onLogout && (
                 <button onClick={onLogout} className="text-slate-400 hover:text-white text-xs">
                    Logout
                </button>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
