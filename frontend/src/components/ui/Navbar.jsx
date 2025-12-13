// @/components/ui/Navbar.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';

const navVariants = {
    initial: { y: -80, opacity: 0 },
    in: { y: 0, opacity: 1, transition: { delay: 0.5, duration: 0.5, ease: 'easeOut' }},
    exit: { y: -80, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' }}
}

export function Navbar({ user, onLogout, onSettings, onComs, onAdmin, socket }) {
  const [lockGlitch, setLockGlitch] = useState(false);

  // You might want to listen to a global event or a prop to trigger this
  const handleSecretMessage = () => {
    setLockGlitch(true);
    setTimeout(() => setLockGlitch(false), 200);
  };

  return (
    <>
      <motion.header
        variants={navVariants}
        initial="initial"
        animate="in"
        exit="exit"
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="safe-area-top m-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-squircle-md px-4 py-3 flex items-center justify-between shadow-lg">
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
                  <p className="text-slate-400 text-xs leading-tight">{user?.isAdmin ? '👑 Admin' : 'Welcome Back'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-black/30 px-4 py-2 rounded-full border border-yellow-500/20 text-yellow-400 font-mono text-lg">
                $<AnimatedCounter value={user?.chipBalance || 0} />
              </div>

              {/* SecretComs Chat Icon */}
              <button
                onClick={onComs}
                className="text-slate-400 hover:text-white transition-colors"
                title="SecretComs - Encrypted Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>

              {user?.isAdmin && onAdmin && (
                   <button onClick={onAdmin} className="text-red-400 hover:text-red-300 text-xs transition-colors font-semibold">
                      👑 Admin
                  </button>
              )}

              {onSettings && (
                   <button onClick={onSettings} className="text-slate-400 hover:text-white text-xs transition-colors">
                      ⚙️ Settings
                  </button>
              )}

              {onLogout && (
                   <button onClick={onLogout} className="text-slate-400 hover:text-white text-xs">
                      Logout
                  </button>
              )}
            </div>
          </div>
        </div>
      </motion.header>
    </>
  );
}
