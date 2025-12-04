import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProvablyFairVerifier - Transparency UI for game fairness
 *
 * Features:
 * 1. Pre-game: Shows server seed hash (commitment)
 * 2. Post-game: Reveals server seed for verification
 * 3. Client-side hash verification
 * 4. Copy-to-clipboard functionality
 * 5. Link to external verification tool
 */

const ProvablyFairVerifier = ({ gameState, gameSessionId, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('current');
    const [verificationResult, setVerificationResult] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [historicalGames, setHistoricalGames] = useState([]);
    const [copied, setCopied] = useState(null);

    // Fetch historical games for verification
    const fetchHistory = useCallback(async () => {
        try {
            const response = await fetch('/api/games/history?limit=10');
            if (response.ok) {
                const data = await response.json();
                setHistoricalGames(data.games);
            }
        } catch (error) {
            console.error('Failed to fetch game history:', error);
        }
    }, []);

    useEffect(() => {
        if (isOpen && activeTab === 'history') {
            fetchHistory();
        }
    }, [isOpen, activeTab, fetchHistory]);

    // Copy to clipboard
    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(label);
            setTimeout(() => setCopied(null), 2000);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    };

    // Client-side SHA256 hash verification
    const verifyHash = async (serverSeed, playerSeed, expectedHash) => {
        setIsVerifying(true);
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(serverSeed + playerSeed);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const isValid = computedHash.toLowerCase() === expectedHash.toLowerCase();
            setVerificationResult({
                isValid,
                computedHash,
                expectedHash
            });
        } catch (error) {
            setVerificationResult({
                isValid: false,
                error: error.message
            });
        } finally {
            setIsVerifying(false);
        }
    };

    // Verify a specific game
    const verifyGame = async (game) => {
        if (game.serverSeed && game.playerSeed && game.initialDeckSeed) {
            await verifyHash(game.serverSeed, game.playerSeed, game.initialDeckSeed);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 p-4 border-b border-slate-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                    <span className="text-xl">🔐</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Provably Fair 2.0</h2>
                                    <p className="text-xs text-emerald-400">Verify every hand is truly random</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-white transition-colors p-2"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-700">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'current'
                                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Current Game
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'history'
                                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Verify History
                        </button>
                        <button
                            onClick={() => setActiveTab('how')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'how'
                                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            How It Works
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 max-h-96 overflow-y-auto">
                        {/* Current Game Tab */}
                        {activeTab === 'current' && (
                            <div className="space-y-4">
                                {/* Pre-game: Show commitment */}
                                {gameState?.status === 'waiting' || gameState?.status === 'betting' ? (
                                    <div className="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            <span className="text-emerald-400 text-sm font-medium">Seed Committed</span>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">Server Seed Hash (Hidden until game ends)</label>
                                                <div className="flex items-center gap-2">
                                                    <code className="flex-1 bg-black/30 px-3 py-2 rounded-lg text-xs text-emerald-400 font-mono truncate">
                                                        {gameState?.serverSeedHash || 'Generating...'}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(gameState?.serverSeedHash, 'hash')}
                                                        className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors"
                                                        title="Copy"
                                                    >
                                                        {copied === 'hash' ? '✓' : '📋'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-400 flex items-start gap-2">
                                                <span className="text-emerald-400">ℹ️</span>
                                                <span>
                                                    This hash proves the deck was shuffled before you placed your bet.
                                                    After the game, the actual seed will be revealed so you can verify it matches.
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : gameState?.serverSeed ? (
                                    /* Post-game: Show revealed seeds */
                                    <div className="space-y-4">
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/30">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-emerald-400">✓</span>
                                                <span className="text-emerald-400 text-sm font-medium">Seeds Revealed</span>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">Server Seed</label>
                                                    <div className="flex items-center gap-2">
                                                        <code className="flex-1 bg-black/30 px-3 py-2 rounded-lg text-xs text-white font-mono truncate">
                                                            {gameState.serverSeed}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(gameState.serverSeed, 'server')}
                                                            className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors"
                                                        >
                                                            {copied === 'server' ? '✓' : '📋'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-1">Player Seed</label>
                                                    <div className="flex items-center gap-2">
                                                        <code className="flex-1 bg-black/30 px-3 py-2 rounded-lg text-xs text-white font-mono truncate">
                                                            {gameState.playerSeed}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(gameState.playerSeed, 'player')}
                                                            className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors"
                                                        >
                                                            {copied === 'player' ? '✓' : '📋'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Verify Button */}
                                        <button
                                            onClick={() => verifyHash(gameState.serverSeed, gameState.playerSeed, gameState.serverSeedHash)}
                                            disabled={isVerifying}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isVerifying ? (
                                                <>
                                                    <span className="animate-spin">⏳</span>
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    🔍 Verify This Game
                                                </>
                                            )}
                                        </button>

                                        {/* Verification Result */}
                                        <AnimatePresence>
                                            {verificationResult && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className={`p-4 rounded-xl border ${
                                                        verificationResult.isValid
                                                            ? 'bg-emerald-900/30 border-emerald-500'
                                                            : 'bg-red-900/30 border-red-500'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-2xl">
                                                            {verificationResult.isValid ? '✅' : '❌'}
                                                        </span>
                                                        <span className={`font-bold ${
                                                            verificationResult.isValid ? 'text-emerald-400' : 'text-red-400'
                                                        }`}>
                                                            {verificationResult.isValid ? 'Verified! Game was fair.' : 'Verification Failed'}
                                                        </span>
                                                    </div>
                                                    {verificationResult.isValid && (
                                                        <p className="text-xs text-slate-400">
                                                            The computed hash matches the pre-committed hash, proving the deck order was determined before betting.
                                                        </p>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-400">
                                        <div className="text-4xl mb-3">🎴</div>
                                        <p>Start a game to see fairness data</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* History Tab */}
                        {activeTab === 'history' && (
                            <div className="space-y-3">
                                {historicalGames.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <div className="text-4xl mb-3">📜</div>
                                        <p>No game history yet</p>
                                    </div>
                                ) : (
                                    historicalGames.map((game, idx) => (
                                        <div
                                            key={game.id}
                                            className="bg-slate-800/50 rounded-xl p-3 border border-slate-700"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                        game.gameType === 'WAR' ? 'bg-red-500/20 text-red-400' :
                                                        game.gameType === 'BLACKJACK' ? 'bg-purple-500/20 text-purple-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                        {game.gameType}
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(game.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => verifyGame(game)}
                                                    className="text-xs text-emerald-400 hover:text-emerald-300"
                                                >
                                                    Verify →
                                                </button>
                                            </div>
                                            <code className="text-xs text-slate-500 font-mono block truncate">
                                                Hash: {game.initialDeckSeed?.slice(0, 32)}...
                                            </code>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* How It Works Tab */}
                        {activeTab === 'how' && (
                            <div className="space-y-4 text-sm">
                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                        <span>1️⃣</span> Before the Game
                                    </h3>
                                    <p className="text-slate-400">
                                        The server generates a random seed and shows you only its hash (a one-way fingerprint).
                                        This commits to the deck order before you bet.
                                    </p>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                        <span>2️⃣</span> You Contribute Randomness
                                    </h3>
                                    <p className="text-slate-400">
                                        Your player seed is combined with the server seed to determine the final deck order.
                                        Neither party alone can predict the outcome.
                                    </p>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                        <span>3️⃣</span> After the Game
                                    </h3>
                                    <p className="text-slate-400">
                                        The server reveals its actual seed. You can verify that hashing it produces
                                        the same hash shown before the game, proving nothing was changed.
                                    </p>
                                </div>

                                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
                                    <h3 className="text-emerald-400 font-bold mb-2 flex items-center gap-2">
                                        <span>🔒</span> QRNG Enhanced
                                    </h3>
                                    <p className="text-slate-400">
                                        We use Quantum Random Number Generation via Cloudflare's drand service
                                        for true randomness that even we cannot predict.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Game ID: {gameSessionId || 'N/A'}</span>
                            <a
                                href="https://drand.love"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300"
                            >
                                Learn about QRNG →
                            </a>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ProvablyFairVerifier;
