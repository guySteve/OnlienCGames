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

      setSuccess(`Reset code: ${data.resetToken}\n\nCopy this code and use it below to reset your password.`);
      setResetToken(data.resetToken);
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
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-900"
    >
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
          <span style={{
            background: 'linear-gradient(to right, rgb(34, 211, 238), rgb(217, 70, 239), rgb(239, 68, 68))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            <AnimatedWord>Card</AnimatedWord> <AnimatedWord>Room</AnimatedWord>
          </span>
        </motion.h1>

        {showForm && (
          <motion.div variants={buttonVariants} className="space-y-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-white font-bold text-xl mb-2 text-center">
                {isLogin ? 'Welcome Back' : 'Join Moe\'s'}
              </h2>
              <p className="text-white/60 text-sm mb-6 text-center">
                {isLogin ? 'Sign in to continue' : 'Create your account'}
              </p>

              <div className="flex mb-6 bg-white/5 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 rounded-md transition-all ${
                    isLogin ? 'bg-white/20 text-white font-semibold' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 rounded-md transition-all ${
                    !isLogin ? 'bg-white/20 text-white font-semibold' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                />

                {!isLogin && (
                  <input
                    type="text"
                    placeholder="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={30}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                  />
                )}

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                />

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

                {success && (
                  <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                </button>

                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordReset(true)}
                    className="w-full text-cyan-400 hover:text-cyan-300 text-sm transition-colors mt-2"
                  >
                    Forgot Password?
                  </button>
                )}

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
                    <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3 whitespace-pre-line">
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
