// @/views/SettingsView.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BiometricSetup from '../components/BiometricSetup';

const containerVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const tabVariants = {
  inactive: { backgroundColor: 'rgba(255,255,255,0.05)' },
  active: { backgroundColor: 'rgba(59,130,246,0.2)' }
};

export function SettingsView({ user, onBack }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [minBetPreset, setMinBetPreset] = useState(10);
  const [savedDevices, setSavedDevices] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const tabs = [
    { id: 'profile', label: '👤 Profile', icon: '👤' },
    { id: 'preferences', label: '⚙️ Preferences', icon: '⚙️' },
    { id: 'security', label: '🔐 Security', icon: '🔐' },
    { id: 'social', label: '👥 Friends', icon: '👥' }
  ];

  // Load saved devices on mount
  useEffect(() => {
    const loadSavedDevices = async () => {
      try {
        const response = await fetch('/auth/webauthn/authenticators', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setSavedDevices(data.authenticators || []);
        }
      } catch (err) {
        console.error('Failed to load saved devices:', err);
      }
    };

    loadSavedDevices();
  }, []);

  // Update display name
  const handleUpdateDisplayName = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Display name updated!' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage({ type: 'error', text: 'Failed to update display name' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  // Save preferences
  const handleSavePreferences = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      localStorage.setItem('moe_min_bet_preset', minBetPreset.toString());
      setMessage({ type: 'success', text: 'Preferences saved!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setLoading(false);
    }
  };

  // Remove saved device
  const handleRemoveDevice = async (deviceId) => {
    if (!confirm('Remove this device? You will need to sign in again on this device.')) return;

    try {
      const response = await fetch(`/auth/webauthn/authenticators/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setSavedDevices(savedDevices.filter(d => d.id !== deviceId));
        setMessage({ type: 'success', text: 'Device removed' });
      } else {
        setMessage({ type: 'error', text: 'Failed to remove device' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="in"
      exit="exit"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20 pb-8"
    >
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 transition-colors"
          >
            <span>←</span> Back to Lobby
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Account Settings</h1>
          <p className="text-slate-400">Manage your profile and preferences</p>
        </div>

        {/* Global Message */}
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {message.text}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              variants={tabVariants}
              animate={activeTab === tab.id ? 'active' : 'inactive'}
              className={`
                px-4 py-2 rounded-lg border transition-all whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500/50 text-white'
                  : 'border-white/10 text-slate-400 hover:text-white'
                }
              `}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Display Name */}
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Display Name</h3>
                <form onSubmit={handleUpdateDisplayName} className="space-y-4">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={30}
                    required
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                    placeholder="Your display name"
                  />
                  <button
                    type="submit"
                    disabled={loading || displayName === user?.displayName}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Update Display Name'}
                  </button>
                </form>
              </div>

              {/* Avatar Placeholder */}
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Avatar</h3>
                <p className="text-slate-400 text-sm mb-4">Avatar customization coming soon...</p>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                  {user?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
              </div>

              {/* Email */}
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Email</h3>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-slate-400"
                />
                <p className="text-slate-500 text-sm mt-2 italic">
                  Email cannot be changed for security reasons
                </p>
              </div>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* Min Bet Preset */}
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Betting Preferences</h3>
                <label className="block text-slate-400 text-sm mb-2">
                  Default Minimum Bet (for quick tap betting)
                </label>
                <select
                  value={minBetPreset}
                  onChange={(e) => setMinBetPreset(Number(e.target.value))}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value={5}>$5</option>
                  <option value={10}>$10</option>
                  <option value={25}>$25</option>
                  <option value={50}>$50</option>
                  <option value={100}>$100</option>
                </select>
                <p className="text-slate-500 text-sm mt-2">
                  This amount will be used when you tap a spot to quickly place a bet
                </p>
                <button
                  onClick={handleSavePreferences}
                  disabled={loading}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Biometric Setup */}
              <div>
                <BiometricSetup />
              </div>

              {/* Saved Devices */}
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Saved Devices</h3>
                {savedDevices.length === 0 ? (
                  <p className="text-slate-400">No saved devices</p>
                ) : (
                  <div className="space-y-3">
                    {savedDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex justify-between items-center bg-slate-900/50 border border-white/10 rounded-lg p-4"
                      >
                        <div>
                          <p className="text-white font-medium">{device.name || 'Unnamed Device'}</p>
                          <p className="text-slate-400 text-sm">
                            Added: {new Date(device.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveDevice(device.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Session Management */}
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Session Management</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">Current Session</p>
                      <p className="text-slate-400 text-sm">Active now</p>
                    </div>
                    <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                      Active
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SOCIAL TAB */}
          {activeTab === 'social' && (
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Friends</h3>
              <p className="text-slate-400 mb-4">
                Friends list functionality coming soon. You'll be able to add friends, see who's online, and invite them to games.
              </p>
              <div className="bg-slate-900/50 border border-white/10 rounded-lg p-8 text-center">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-slate-500">No friends added yet</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
