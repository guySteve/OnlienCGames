// @/views/HomeView.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showForm, setShowForm] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkDeviceMemory = async () => {
      const rememberedEmail = localStorage.getItem('moe_remembered_email');

      if (rememberedEmail && window.PublicKeyCredential) {
        try {
          await attemptBiometricLogin(rememberedEmail);
          return;
        } catch (err) {
          console.log('Auto-login not available:', err);
        }
      }

      setIsCheckingDevice(false);
      setShowForm(true);
    };

    checkDeviceMemory();
  }, []);

  const attemptBiometricLogin = async (emailToUse) => {
    try {
      setLoading(true);
      const startResponse = await fetch('/auth/webauthn/login-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: emailToUse })
      });

      if (!startResponse.ok) throw new Error('Failed to start authentication');
      const options = await startResponse.json();
      const credential = await navigator.credentials.get({ publicKey: options });

      const finishResponse = await fetch('/auth/webauthn/login-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credential)
      });

      if (finishResponse.ok) {
        window.location.reload();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      console.error('Biometric login failed:', err);
      setError('Auto-login failed. Please sign in again.');
      setIsCheckingDevice(false);
      setShowForm(true);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }

        if (rememberDevice && window.PublicKeyCredential) {
          try {
            await setupBiometric(email);
            localStorage.setItem('moe_remembered_email', email);
          } catch (bioErr) {
            console.log('Biometric setup skipped:', bioErr);
          }
        }

        window.location.reload();
      } else {
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: displayName,
            email: email,
            password: password
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Registration failed');
          setLoading(false);
          return;
        }

        if (rememberDevice && window.PublicKeyCredential) {
          try {
            await setupBiometric(email);
            localStorage.setItem('moe_remembered_email', email);
          } catch (bioErr) {
            console.log('Biometric setup skipped:', bioErr);
          }
        }

        window.location.reload();
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to request password reset');
        setLoading(false);
        return;
      }

      // If token returned (dev mode), show it. Otherwise, prompt user to check email
      if (data.resetToken) {
        setSuccess(`Reset code: ${data.resetToken}\n\nCopy this code and use it below to reset your password.`);
        setResetToken(data.resetToken);
      } else {
        setSuccess('Check your email for the reset code, then enter it below.');
        setResetToken(''); // Set to empty string to show form 2
      }
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          token: resetToken,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      setSuccess('Password reset successful! You can now login with your new password.');
      setTimeout(() => {
        setShowPasswordReset(false);
        setIsLogin(true);
        setEmail(resetEmail);
        setPassword(newPassword);
        setResetEmail('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('');
      }, 2000);
      setLoading(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const setupBiometric = async (userEmail) => {
    const startResponse = await fetch('/auth/webauthn/register-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: userEmail,
        authenticatorName: 'Primary Device'
      })
    });

    if (!startResponse.ok) throw new Error('Failed to start biometric setup');
    const options = await startResponse.json();
    const credential = await navigator.credentials.create({ publicKey: options });

    const finishResponse = await fetch('/auth/webauthn/register-finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credential)
    });

    if (!finishResponse.ok) throw new Error('Failed to complete biometric setup');
  };

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
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-950"
    >
      {/* BACKGROUND: Gritty Texture & Spotlight */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Spotlight Effect */}
      <div className="absolute inset-0 z-0 bg-gradient-radial from-slate-800/20 via-slate-950/80 to-black"></div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* LOGO: Neon Sign Aesthetic */}
        <motion.div variants={titleContainerVariants} className="mb-12 text-center">
          <h1 className="font-black text-6xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-slate-200 to-slate-600 drop-shadow-2xl"
              style={{ textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>
            MOE'S
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-emerald-500/50"></div>
            <span className="text-emerald-500 font-mono tracking-[0.3em] text-sm uppercase text-shadow-glow-green">
              Private Card Room
            </span>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-emerald-500/50"></div>
          </div>
        </motion.div>

        {/* FORM CONTAINER: Frosted Glass Panel */}
        <AnimatePresence mode="wait">
          {showForm && (
            <motion.div
              variants={buttonVariants}
              className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10"
            >
              {/* Tab Switcher */}
              <div className="flex border-b border-white/5">
                <button
                  onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                  className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all ${
                    isLogin ? 'bg-white/5 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  MEMBER LOGIN
                </button>
                <button
                  onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                  className={`flex-1 py-4 text-sm font-bold tracking-wide transition-all ${
                    !isLogin ? 'bg-white/5 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  APPLY FOR ENTRY
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="group">
                      <input
                        type="text"
                        placeholder="CODENAME"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        maxLength={30}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-sm"
                      />
                    </div>
                  )}

                  <div className="group">
                    <input
                      type="email"
                      placeholder="EMAIL ADDRESS"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-sm"
                    />
                  </div>

                  <div className="group">
                    <input
                      type="password"
                      placeholder="PASSPHRASE"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-sm"
                    />
                  </div>

                  {error && <div className="text-red-400 text-xs text-center bg-red-900/20 p-2 rounded border border-red-900/30">{error}</div>}
                  {success && <div className="text-emerald-400 text-xs text-center bg-emerald-900/20 p-2 rounded border border-emerald-900/30">{success}</div>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-emerald-900/20 transition-all transform active:scale-[0.98] uppercase tracking-wider text-sm mt-2"
                  >
                    {loading ? 'AUTHENTICATING...' : (isLogin ? 'ENTER ROOM' : 'SUBMIT APPLICATION')}
                  </button>

                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="w-full text-emerald-500 hover:text-emerald-400 text-xs transition-colors mt-2 font-mono"
                    >
                      Forgot Passphrase?
                    </button>
                  )}

                  {rememberDevice && window.PublicKeyCredential && (
                    <p className="text-xs text-slate-600 text-center mt-2">
                      Biometric access will be configured
                    </p>
                  )}
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Disclaimer */}
      <div className="absolute bottom-6 text-center w-full px-4">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest opacity-50">
          Restricted Access • Members Only • 21+
        </p>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showPasswordReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPasswordReset(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-white/20 rounded-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-white font-bold text-2xl mb-2">Reset Password</h2>
              <p className="text-slate-400 text-sm mb-6">
                {!resetToken ? 'Enter your email to receive a reset code' : 'Enter the code and your new password'}
              </p>

              {!resetToken ? (
                <form onSubmit={handlePasswordResetRequest} className="space-y-4">
                  <input
                    type="email"
                    placeholder="Email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                  />

                  {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3 whitespace-pre-line font-mono">
                      {success}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordReset(false);
                        setResetEmail('');
                        setError('');
                        setSuccess('');
                      }}
                      className="flex-1 py-3 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Get Code'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Reset Code"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                  />

                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                  />

                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                  />

                  {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      {success}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResetToken('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setError('');
                      }}
                      className="flex-1 py-3 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
