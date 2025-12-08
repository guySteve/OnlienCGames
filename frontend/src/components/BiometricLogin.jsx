/**
 * BiometricLogin Component
 *
 * Provides a fast, passwordless biometric login flow for users who have
 * previously registered their biometric credentials.
 *
 * Usage: Display this component on the login page or when casino is closed
 * for admin access.
 */

import { useState, useEffect } from 'react';
import {
  startAuthentication,
  browserSupportsWebAuthn
} from '@simplewebauthn/browser';

const BiometricLogin = ({ onSuccess, adminEmail = 'smmohamed60@gmail.com' }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEmailFallback, setShowEmailFallback] = useState(false);
  const [email, setEmail] = useState(adminEmail);

  // Check browser support on mount
  useEffect(() => {
    setIsSupported(browserSupportsWebAuthn());
  }, []);

  // Handle biometric login - supports both passwordless and email-based
  const handleBiometricLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // If email fallback is shown, validate email
      if (showEmailFallback && (!email || !email.includes('@'))) {
        throw new Error('Please enter a valid email address');
      }

      // Step 1: Get authentication options from server
      // If email is provided, use email-based mode; otherwise use discoverable credentials
      const optionsResponse = await fetch('/auth/webauthn/login-start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(showEmailFallback ? { email } : { userVerification: 'preferred' })
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.message || 'Failed to start authentication');
      }

      const options = await optionsResponse.json();

      // Step 2: Prompt user for biometric authentication
      // This will trigger Touch ID, Face ID, Windows Hello, etc.
      let credential;
      try {
        credential = await startAuthentication(options);
      } catch (authError) {
        // User cancelled or biometric failed
        if (authError.name === 'NotAllowedError') {
          throw new Error('Biometric authentication was cancelled');
        } else if (authError.name === 'InvalidStateError') {
          throw new Error('No registered biometric devices found');
        } else {
          throw new Error('Biometric authentication failed: ' + authError.message);
        }
      }

      // Step 3: Send credential to server for verification and login
      const verificationResponse = await fetch('/auth/webauthn/login-finish', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential })
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.message || 'Failed to verify credential');
      }

      const result = await verificationResponse.json();

      // Success! User is now logged in
      if (onSuccess) {
        onSuccess(result.user);
      } else {
        // Default: reload page to refresh session
        window.location.href = '/';
      }

    } catch (err) {
      console.error('Biometric login error:', err);
      const errorMessage = err.message || 'Failed to log in with biometric';
      
      // Check if we should automatically switch to the email fallback
      const isDiscoverableCredentialError = !showEmailFallback && 
        (errorMessage.includes('find') || errorMessage.includes('credential'));
        
      if (isDiscoverableCredentialError) {
        setError('No registered device found. Please enter your email to try again.');
        setShowEmailFallback(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="biometric-login-container" style={styles.container}>
        <div style={styles.unsupportedCard}>
          <h3>⚠️ Biometric Login Not Supported</h3>
          <p>
            Your browser or device does not support biometric authentication.
            Please use the standard Google login or use a modern browser
            (Chrome, Safari, Edge) on a device with biometric capabilities.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="biometric-login-container" style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>🔐 Biometric Login</h2>
          <p style={styles.description}>
            Tap the button below and use your fingerprint, Face ID, or device PIN
          </p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <form onSubmit={handleBiometricLogin} style={styles.form}>
          {showEmailFallback && (
            <div style={styles.inputGroup}>
              <label htmlFor="email" style={styles.label}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={styles.input}
                disabled={isLoading}
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {})
            }}
          >
            {isLoading ? (
              <>
                <span style={styles.spinner}>⏳</span> Authenticating...
              </>
            ) : (
              <>
                {showEmailFallback ? '🔐 Sign In with Email + Biometric' : '👆 Use Biometric to Sign In'}
              </>
            )}
          </button>

          {!showEmailFallback && (
            <button
              type="button"
              onClick={() => setShowEmailFallback(true)}
              style={styles.linkButton}
              disabled={isLoading}
            >
              Or enter email if device not registered
            </button>
          )}

          {showEmailFallback && (
            <button
              type="button"
              onClick={() => {
                setShowEmailFallback(false);
                setError(null);
              }}
              style={styles.linkButton}
              disabled={isLoading}
            >
              ← Back to quick biometric login
            </button>
          )}
        </form>

        <div style={styles.infoBox}>
          <p style={styles.infoTitle}>ℹ️ How it works:</p>
          {!showEmailFallback ? (
            <>
              <ol style={styles.infoList}>
                <li>Tap the button above</li>
                <li>Your device will prompt for biometric authentication</li>
                <li>Use Touch ID, Face ID, fingerprint, or device PIN</li>
                <li>You'll be instantly logged in!</li>
              </ol>
              <p style={styles.infoNote}>
                <strong>Note:</strong> Your device must be registered. If not, click "Or enter email" below.
              </p>
            </>
          ) : (
            <>
              <ol style={styles.infoList}>
                <li>Enter your email address</li>
                <li>Click "Sign In with Email + Biometric"</li>
                <li>Use your Touch ID, Face ID, or fingerprint</li>
                <li>You'll be logged in!</li>
              </ol>
              <p style={styles.infoNote}>
                <strong>Tip:</strong> Register your device in Settings for faster login next time.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline styles (can be moved to CSS module if preferred)
const styles = {
  container: {
    maxWidth: '500px',
    margin: '2rem auto',
    padding: '1rem'
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    color: '#fff'
  },
  unsupportedCard: {
    backgroundColor: '#2a1a1a',
    borderRadius: '12px',
    padding: '2rem',
    border: '2px solid #ff6b6b',
    textAlign: 'center'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  title: {
    fontSize: '1.75rem',
    marginBottom: '0.5rem',
    color: '#fff'
  },
  description: {
    color: '#aaa',
    fontSize: '0.95rem'
  },
  errorAlert: {
    backgroundColor: '#4a1414',
    border: '1px solid #ff6b6b',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    color: '#ff9999'
  },
  form: {
    marginBottom: '1.5rem'
  },
  inputGroup: {
    marginBottom: '1.5rem'
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#ccc',
    fontSize: '0.9rem',
    fontWeight: 'bold'
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '1rem',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'
  },
  buttonDisabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed'
  },
  linkButton: {
    width: '100%',
    padding: '0.75rem',
    marginTop: '0.75rem',
    backgroundColor: 'transparent',
    color: '#7ab8ff',
    border: '1px solid #3a5a7a',
    borderRadius: '6px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textDecoration: 'none'
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite'
  },
  infoBox: {
    backgroundColor: '#1a2a3a',
    border: '1px solid #3a5a7a',
    borderRadius: '8px',
    padding: '1rem'
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#7ab8ff'
  },
  infoList: {
    margin: '0 0 1rem 0',
    paddingLeft: '1.5rem',
    color: '#ccc',
    lineHeight: '1.6'
  },
  infoNote: {
    fontSize: '0.85rem',
    color: '#999',
    marginBottom: '0'
  }
};

export default BiometricLogin;
