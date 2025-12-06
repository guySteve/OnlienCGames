/**
 * BiometricSetup Component
 *
 * Allows authenticated users (via Google OAuth) to register their biometric
 * credentials (Touch ID, Face ID, Windows Hello, etc.) for fast passwordless login.
 *
 * Usage: Display this component in user settings or admin panel after Google login.
 */

import { useState, useEffect } from 'react';
import {
  startRegistration,
  browserSupportsWebAuthn
} from '@simplewebauthn/browser';

const BiometricSetup = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [authenticators, setAuthenticators] = useState([]);
  const [deviceName, setDeviceName] = useState('');

  // Check browser support on mount
  useEffect(() => {
    setIsSupported(browserSupportsWebAuthn());
    fetchAuthenticators();
  }, []);

  // Fetch existing authenticators
  const fetchAuthenticators = async () => {
    try {
      const response = await fetch('/auth/webauthn/authenticators', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAuthenticators(data.authenticators || []);
      }
    } catch (err) {
      console.error('Failed to fetch authenticators:', err);
    }
  };

  // Handle biometric registration
  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

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

      // Step 2: Prompt user for biometric (browser native UI)
      // This will trigger Touch ID, Face ID, Windows Hello, etc.
      let credential;
      try {
        credential = await startRegistration(options);
      } catch (authError) {
        // User cancelled or biometric failed
        if (authError.name === 'NotAllowedError') {
          throw new Error('Biometric authentication was cancelled');
        } else if (authError.name === 'InvalidStateError') {
          throw new Error('This biometric device is already registered');
        } else {
          throw new Error('Biometric authentication failed: ' + authError.message);
        }
      }

      // Step 3: Send credential to server for verification and storage
      const verificationResponse = await fetch('/auth/webauthn/register-finish', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credential,
          deviceName: deviceName || undefined
        })
      });

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.message || 'Failed to verify credential');
      }

      const result = await verificationResponse.json();
      setSuccess(result.message || 'Biometric login successfully set up!');
      setDeviceName(''); // Clear device name input

      // Refresh authenticators list
      await fetchAuthenticators();

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to set up biometric login');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle authenticator deletion
  const handleDelete = async (authenticatorId) => {
    if (!confirm('Are you sure you want to remove this biometric device?')) {
      return;
    }

    try {
      const response = await fetch(`/auth/webauthn/authenticators/${authenticatorId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to remove authenticator');
      }

      await fetchAuthenticators();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message);
    }
  };

  if (!isSupported) {
    return (
      <div className="biometric-setup-container" style={styles.container}>
        <div style={styles.unsupportedCard}>
          <h3>⚠️ Biometric Login Not Supported</h3>
          <p>
            Your browser or device does not support biometric authentication.
            Please use a modern browser (Chrome, Safari, Edge) on a device with
            Touch ID, Face ID, or Windows Hello.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="biometric-setup-container" style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>🔐 Biometric Login Setup</h2>
        <p style={styles.description}>
          Set up biometric authentication for fast, secure, passwordless login
          to your admin account. Use Touch ID, Face ID, Windows Hello, or other
          biometric devices.
        </p>

        {error && (
          <div style={styles.errorAlert}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div style={styles.successAlert}>
            <strong>Success:</strong> {success}
          </div>
        )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Register New Device</h3>
          <div style={styles.inputGroup}>
            <label htmlFor="deviceName" style={styles.label}>
              Device Name (optional)
            </label>
            <input
              id="deviceName"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g., MacBook Pro Touch ID"
              maxLength={100}
              style={styles.input}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {})
            }}
          >
            {isLoading ? 'Setting up...' : '🔐 Set Up Biometric Login'}
          </button>
        </div>

        {authenticators.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Registered Devices</h3>
            <div style={styles.authenticatorList}>
              {authenticators.map((auth) => (
                <div key={auth.id} style={styles.authenticatorItem}>
                  <div>
                    <div style={styles.authenticatorName}>
                      {auth.deviceName || 'Biometric Device'}
                    </div>
                    <div style={styles.authenticatorDate}>
                      Registered: {new Date(auth.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(auth.id)}
                    style={styles.deleteButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={styles.infoBox}>
          <p style={styles.infoTitle}>ℹ️ How it works:</p>
          <ol style={styles.infoList}>
            <li>Click "Set Up Biometric Login" above</li>
            <li>Your device will prompt you to use your biometric (Touch ID, Face ID, etc.)</li>
            <li>Once registered, you can log in instantly using just your biometric</li>
            <li>Your biometric data never leaves your device - it's secure by design</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

// Inline styles (can be moved to CSS module if preferred)
const styles = {
  container: {
    maxWidth: '600px',
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
  title: {
    fontSize: '1.75rem',
    marginBottom: '0.5rem',
    color: '#fff'
  },
  description: {
    color: '#aaa',
    marginBottom: '1.5rem',
    lineHeight: '1.5'
  },
  errorAlert: {
    backgroundColor: '#4a1414',
    border: '1px solid #ff6b6b',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    color: '#ff9999'
  },
  successAlert: {
    backgroundColor: '#144a14',
    border: '1px solid #6bff6b',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
    color: '#99ff99'
  },
  section: {
    marginBottom: '2rem',
    paddingBottom: '2rem',
    borderBottom: '1px solid #333'
  },
  sectionTitle: {
    fontSize: '1.25rem',
    marginBottom: '1rem',
    color: '#fff'
  },
  inputGroup: {
    marginBottom: '1rem'
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#ccc',
    fontSize: '0.9rem'
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
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  buttonDisabled: {
    backgroundColor: '#555',
    cursor: 'not-allowed'
  },
  authenticatorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  authenticatorItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    border: '1px solid #444'
  },
  authenticatorName: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '0.25rem'
  },
  authenticatorDate: {
    fontSize: '0.85rem',
    color: '#888'
  },
  deleteButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#c62828',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  infoBox: {
    backgroundColor: '#1a2a3a',
    border: '1px solid #3a5a7a',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '1rem'
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#7ab8ff'
  },
  infoList: {
    margin: '0',
    paddingLeft: '1.5rem',
    color: '#ccc',
    lineHeight: '1.6'
  }
};

export default BiometricSetup;
