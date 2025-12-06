/**
 * BiometricSetupPrompt Modal
 *
 * Shows immediately after Google login to prompt user to enable biometric login.
 * Much better UX than hiding in settings!
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  startRegistration,
  browserSupportsWebAuthn
} from '@simplewebauthn/browser';

const BiometricSetupPrompt = ({ isOpen, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSupported] = useState(browserSupportsWebAuthn());

  // Handle enabling biometric login
  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get registration options from server
      const optionsResponse = await fetch('/auth/webauthn/register-start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.message || 'Failed to start registration');
      }

      const options = await optionsResponse.json();

      // Step 2: Prompt user for biometric
      let credential;
      try {
        credential = await startRegistration(options);
      } catch (authError) {
        if (authError.name === 'NotAllowedError') {
          throw new Error('Biometric authentication was cancelled');
        } else if (authError.name === 'InvalidStateError') {
          throw new Error('This biometric device is already registered');
        } else {
          throw new Error('Biometric authentication failed: ' + authError.message);
        }
      }

      // Step 3: Send credential to server
      const verificationResponse = await fetch('/auth/webauthn/register-finish', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credential,
          deviceName: navigator.userAgent.includes('Mac') ? 'Touch ID' :
                      navigator.userAgent.includes('Windows') ? 'Windows Hello' :
                      'Biometric Device'
        })
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.message || 'Failed to verify credential');
      }

      // Success!
      if (onSuccess) {
        onSuccess();
      }
      onClose();

    } catch (err) {
      console.error('Biometric setup error:', err);
      setError(err.message || 'Failed to set up biometric login');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle declining
  const handleDecline = () => {
    // Store in localStorage so we don't ask again for a while
    localStorage.setItem('biometric_prompt_declined', Date.now());
    onClose();
  };

  if (!isSupported) {
    // Browser doesn't support biometrics - don't show the prompt
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDecline}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-white/10 max-w-md w-full p-8 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                className="text-center mb-6"
              >
                <div className="text-7xl mb-4">🚀</div>
              </motion.div>

              {/* Title */}
              <h2 className="text-3xl font-black text-white text-center mb-3">
                Yo, Want Faster Login?
              </h2>

              {/* Description */}
              <p className="text-slate-300 text-center mb-6 text-lg">
                Enable biometric login and skip the Google OAuth dance next time.
                One touch, you're in.
              </p>

              {/* Feature List */}
              <div className="bg-slate-900/50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex items-center gap-3 text-slate-200">
                  <span className="text-xl">⚡</span>
                  <span>Instant login with Touch ID / Face ID</span>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <span className="text-xl">🔐</span>
                  <span>Military-grade security</span>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <span className="text-xl">😎</span>
                  <span>Look cool AF doing it</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span> Setting up...
                    </span>
                  ) : (
                    <span>🔥 Hell Yeah, Enable It!</span>
                  )}
                </button>

                <button
                  onClick={handleDecline}
                  disabled={isLoading}
                  className="w-full bg-slate-700/50 hover:bg-slate-600/50 disabled:bg-slate-800/50 text-slate-300 font-medium py-3 px-6 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  Nah, I Like Wasting Time
                </button>
              </div>

              {/* Fine print */}
              <p className="text-slate-500 text-xs text-center mt-4">
                Your biometric data never leaves your device. Seriously secure.
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BiometricSetupPrompt;
