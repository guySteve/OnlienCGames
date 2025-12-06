// @/views/SettingsView.jsx
import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('security');

  const tabs = [
    { id: 'security', label: '🔐 Security', icon: '🔐' },
    { id: 'profile', label: '👤 Profile', icon: '👤' },
    { id: 'preferences', label: '⚙️ Preferences', icon: '⚙️' }
  ];

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
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account and preferences</p>
        </div>

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
          {activeTab === 'security' && (
            <div>
              <BiometricSetup />

              {/* Additional security settings can go here */}
              <div className="mt-8 bg-slate-800/50 border border-white/10 rounded-xl p-6">
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

          {activeTab === 'profile' && (
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Profile Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Display Name</label>
                  <input
                    type="text"
                    value={user?.displayName || ''}
                    disabled
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <p className="text-slate-500 text-sm italic">
                  Profile information is managed through your Google account
                </p>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Preferences</h3>
              <p className="text-slate-400">Preference settings coming soon...</p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
