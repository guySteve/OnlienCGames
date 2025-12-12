// @/views/HomeView.jsx
import React, { useState, useEffect } from 'react';
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
  const [isCheckingDevice, setIsCheckingDevice] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if device is remembered on mount
  useEffect(() => {
    const checkDeviceMemory = async () => {
      const rememberedEmail = localStorage.getItem('moe_remembered_email');

      if (rememberedEmail && window.PublicKeyCredential) {
        // Try auto-login with WebAuthn
        try {
          // Check if user has authenticators
          const response = await fetch('/auth/webauthn/authenticators', {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.authenticators && data.authenticators.length > 0) {
              // Attempt biometric login
              await attemptBiometricLogin(rememberedEmail);
              return;
            }
          }
        } catch (err) {
          console.log('Auto-login not available:', err);
        }
      }

      // No remembered device, show registration
      setIsCheckingDevice(false);
      setShowRegistration(true);
    };

    checkDeviceMemory();
  }, []);

  const attemptBiometricLogin = async (email) => {
    try {
      setLoading(true);

      // Start WebAuthn authentication
      const startResponse = await fetch('/auth/webauthn/login-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start authentication');
      }

      const options = await startResponse.json();

      // Get credential from authenticator
      const credential = await navigator.credentials.get({
        publicKey: options
      });

      // Finish authentication
      const finishResponse = await fetch('/auth/webauthn/login-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credential)
      });

      if (finishResponse.ok) {
        // Success! Reload to enter the app
        window.location.reload();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      console.error('Biometric login failed:', err);
      setError('Auto-login failed. Please sign in again.');
      setIsCheckingDevice(false);
      setShowRegistration(true);
      setLoading(false);
    }
  };

  const handleRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Register new user
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: displayName,
          email: email,
          password: crypto.randomUUID() // Random password since we'll use WebAuthn
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // If remember device is enabled, set up WebAuthn
      if (rememberDevice && window.PublicKeyCredential) {
        try {
          await setupBiometric(email);
          localStorage.setItem('moe_remembered_email', email);
        } catch (bioErr) {
          console.log('Biometric setup skipped:', bioErr);
          // Continue anyway - not critical
        }
      }

      // Success! Reload to enter the app
      window.location.reload();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const setupBiometric = async (userEmail) => {
    // Start WebAuthn registration
    const startResponse = await fetch('/auth/webauthn/register-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: userEmail,
        authenticatorName: 'Primary Device'
      })
    });

    if (!startResponse.ok) {
      throw new Error('Failed to start biometric setup');
    }

    const options = await startResponse.json();

    // Create credential
    const credential = await navigator.credentials.create({
      publicKey: options
    });

    // Finish registration
    const finishResponse = await fetch('/auth/webauthn/register-finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credential)
    });

    if (!finishResponse.ok) {
      throw new Error('Failed to complete biometric setup');
    }
  };

  // Show loading spinner while checking device
  if (isCheckingDevice) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"
        />
        <p className="text-white/60 mt-4">Checking device memory...</p>
      </div>
    );
  }

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

        {showRegistration && (
          <motion.div variants={buttonVariants} className="space-y-4">
            {/* Simple Registration Form */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-white font-bold text-xl mb-2 text-center">Welcome</h2>
              <p className="text-white/60 text-sm mb-6 text-center">Enter the Card Room</p>

              {/* Form */}
              <form onSubmit={handleRegistration} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                />

                <input
                  type="text"
                  placeholder="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={30}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                />

                {/* Remember Device Checkbox */}
                <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="text-sm">Remember this device</span>
                </label>

                {error && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Please wait...' : 'Enter Card Room'}
                </button>

                {rememberDevice && window.PublicKeyCredential && (
                  <p className="text-xs text-white/40 text-center">
                    Biometric login will be set up for faster access
                  </p>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
