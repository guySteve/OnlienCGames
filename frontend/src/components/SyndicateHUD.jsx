import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * SyndicateHUD - Guild overlay component
 *
 * Displays:
 * - Syndicate name/tag with animated treasury
 * - Member activity feed
 * - Weekly contribution leaderboard
 * - Quick actions (donate, invite)
 */

const SyndicateHUD = ({ socket, userId, isExpanded = false, onToggle }) => {
    const [syndicate, setSyndicate] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showDonateModal, setShowDonateModal] = useState(false);
    const [donateAmount, setDonateAmount] = useState(100);
    const [recentEvents, setRecentEvents] = useState([]);
    const [treasuryAnimation, setTreasuryAnimation] = useState(null);

    // Fetch syndicate data
    const fetchSyndicate = useCallback(async () => {
        try {
            const response = await fetch('/api/syndicate/my');
            if (response.ok) {
                const data = await response.json();
                setSyndicate(data);
            } else {
                setSyndicate(null);
            }
        } catch (error) {
            console.error('Failed to fetch syndicate:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSyndicate();
    }, [fetchSyndicate]);

    // Socket event listeners
    useEffect(() => {
        if (!socket || !syndicate) return;

        // Join syndicate room
        socket.emit('join_syndicate_room', { syndicateId: syndicate.id });

        // Treasury contribution event
        const handleTreasuryContribution = (data) => {
            if (data.syndicateId === syndicate.id) {
                setSyndicate(prev => ({
                    ...prev,
                    treasuryBalance: data.newBalance
                }));

                // Trigger animation
                setTreasuryAnimation({
                    amount: data.amount,
                    contributorId: data.contributorId
                });
                setTimeout(() => setTreasuryAnimation(null), 2000);

                // Add to feed
                setRecentEvents(prev => [{
                    type: 'contribution',
                    amount: data.amount,
                    userId: data.contributorId,
                    timestamp: Date.now()
                }, ...prev.slice(0, 9)]);
            }
        };

        // Member joined
        const handleMemberJoined = (data) => {
            if (data.syndicateId === syndicate.id) {
                setRecentEvents(prev => [{
                    type: 'member_joined',
                    userName: data.userName,
                    timestamp: Date.now()
                }, ...prev.slice(0, 9)]);
                fetchSyndicate(); // Refresh member count
            }
        };

        // Dividend distributed
        const handleDividend = (data) => {
            if (data.syndicateId === syndicate.id) {
                setRecentEvents(prev => [{
                    type: 'dividend',
                    totalAmount: data.totalAmount,
                    amountPerMember: data.amountPerMember,
                    timestamp: Date.now()
                }, ...prev.slice(0, 9)]);
                fetchSyndicate(); // Refresh treasury
            }
        };

        socket.on('treasury_contribution', handleTreasuryContribution);
        socket.on('member_joined', handleMemberJoined);
        socket.on('dividend_distributed', handleDividend);

        return () => {
            socket.off('treasury_contribution', handleTreasuryContribution);
            socket.off('member_joined', handleMemberJoined);
            socket.off('dividend_distributed', handleDividend);
            socket.emit('leave_syndicate_room', { syndicateId: syndicate.id });
        };
    }, [socket, syndicate?.id, fetchSyndicate]);

    // Handle donation
    const handleDonate = async () => {
        try {
            const response = await fetch('/api/syndicate/donate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: donateAmount })
            });

            if (response.ok) {
                setShowDonateModal(false);
                fetchSyndicate();
            }
        } catch (error) {
            console.error('Donation failed:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed top-20 right-4 w-64 bg-slate-900/90 rounded-xl p-4 border border-slate-700">
                <div className="animate-pulse flex space-x-4">
                    <div className="rounded-full bg-slate-700 h-10 w-10"></div>
                    <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!syndicate) {
        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="fixed top-20 right-4 w-64 bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-xl p-4 border border-slate-700 backdrop-blur-sm"
            >
                <div className="text-center">
                    <div className="text-4xl mb-2">🏛️</div>
                    <h3 className="text-white font-bold mb-1">Join a Syndicate</h3>
                    <p className="text-slate-400 text-sm mb-3">Team up for shared rewards</p>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => window.location.href = '/syndicates'}
                            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold py-2 px-4 rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-all"
                        >
                            Browse Syndicates
                        </button>
                        <button
                            onClick={() => window.location.href = '/syndicates/create'}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-all"
                        >
                            Create Syndicate
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`fixed top-20 right-4 bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-xl border border-yellow-500/30 backdrop-blur-sm shadow-2xl transition-all duration-300 ${
                    isExpanded ? 'w-80' : 'w-64'
                }`}
            >
                {/* Header */}
                <div
                    className="p-3 cursor-pointer hover:bg-white/5 rounded-t-xl transition-colors"
                    onClick={onToggle}
                >
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            {syndicate.iconUrl ? (
                                <img
                                    src={syndicate.iconUrl}
                                    alt={syndicate.name}
                                    className="w-10 h-10 rounded-lg object-cover border-2 border-yellow-500/50"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-xl font-bold text-black">
                                    {syndicate.tag?.charAt(0) || 'S'}
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-slate-900"></div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-white font-bold truncate">{syndicate.name}</h3>
                                <span className="text-xs text-yellow-500 font-mono">[{syndicate.tag}]</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{syndicate.totalMembers} members</span>
                                <span>•</span>
                                <span>Rank #{syndicate.rank || '—'}</span>
                            </div>
                        </div>

                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            className="text-slate-400"
                        >
                            ▼
                        </motion.div>
                    </div>
                </div>

                {/* Treasury Display */}
                <div className="px-3 pb-3">
                    <div className="bg-black/30 rounded-lg p-3 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider">Treasury</div>
                                <motion.div
                                    key={syndicate.treasuryBalance}
                                    initial={{ scale: 1 }}
                                    animate={treasuryAnimation ? { scale: [1, 1.1, 1] } : {}}
                                    className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-mono"
                                >
                                    ${Number(syndicate.treasuryBalance).toLocaleString()}
                                </motion.div>
                            </div>

                            <button
                                onClick={() => setShowDonateModal(true)}
                                className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                + Donate
                            </button>
                        </div>

                        {/* Contribution animation */}
                        <AnimatePresence>
                            {treasuryAnimation && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="absolute inset-0 flex items-center justify-center bg-green-500/20"
                                >
                                    <span className="text-green-400 font-bold text-lg">
                                        +${treasuryAnimation.amount.toLocaleString()}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            {/* Weekly Leaderboard */}
                            <div className="px-3 pb-3">
                                <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                                    Top Contributors This Week
                                </div>
                                <div className="space-y-1.5">
                                    {syndicate.members?.slice(0, 5).map((member, idx) => (
                                        <div
                                            key={member.userId}
                                            className={`flex items-center gap-2 p-2 rounded-lg ${
                                                member.userId === userId
                                                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                                                    : 'bg-white/5'
                                            }`}
                                        >
                                            <span className={`text-sm font-bold ${
                                                idx === 0 ? 'text-yellow-400' :
                                                idx === 1 ? 'text-slate-300' :
                                                idx === 2 ? 'text-orange-400' :
                                                'text-slate-500'
                                            }`}>
                                                #{idx + 1}
                                            </span>
                                            <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-700">
                                                {member.user?.customAvatar || member.user?.avatarUrl ? (
                                                    <img
                                                        src={member.user.customAvatar || member.user.avatarUrl}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                                                        {(member.user?.nickname || member.user?.displayName)?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-sm text-white truncate flex-1">
                                                {member.user?.nickname || member.user?.displayName}
                                                {member.userId === userId && (
                                                    <span className="text-yellow-500 ml-1">(You)</span>
                                                )}
                                            </span>
                                            <span className="text-xs text-yellow-400 font-mono">
                                                ${Number(member.weeklyContribution).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Activity Feed */}
                            {recentEvents.length > 0 && (
                                <div className="px-3 pb-3">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                                        Recent Activity
                                    </div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {recentEvents.map((event, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="text-xs text-slate-400 flex items-center gap-2"
                                            >
                                                {event.type === 'contribution' && (
                                                    <>
                                                        <span className="text-green-400">+${event.amount}</span>
                                                        <span>contribution</span>
                                                    </>
                                                )}
                                                {event.type === 'member_joined' && (
                                                    <>
                                                        <span className="text-blue-400">👋</span>
                                                        <span>{event.userName} joined</span>
                                                    </>
                                                )}
                                                {event.type === 'dividend' && (
                                                    <>
                                                        <span className="text-yellow-400">💰</span>
                                                        <span>Dividend: ${event.amountPerMember}/member</span>
                                                    </>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="px-3 pb-3 flex gap-2">
                                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 px-3 rounded-lg text-sm transition-colors">
                                    Members
                                </button>
                                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 px-3 rounded-lg text-sm transition-colors">
                                    Invite
                                </button>
                                <button className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 px-3 rounded-lg text-sm transition-colors">
                                    Settings
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Donate Modal */}
            <AnimatePresence>
                {showDonateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setShowDonateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 rounded-2xl p-6 w-80 border border-slate-700"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">Donate to Treasury</h3>

                            <div className="mb-4">
                                <label className="text-sm text-slate-400 block mb-2">Amount</label>
                                <input
                                    type="number"
                                    value={donateAmount}
                                    onChange={e => setDonateAmount(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white text-lg font-mono focus:border-yellow-500 focus:outline-none"
                                    min="1"
                                />
                            </div>

                            <div className="flex gap-2 mb-4">
                                {[100, 500, 1000, 5000].map(amount => (
                                    <button
                                        key={amount}
                                        onClick={() => setDonateAmount(amount)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            donateAmount === amount
                                                ? 'bg-yellow-500 text-black'
                                                : 'bg-slate-700 text-white hover:bg-slate-600'
                                        }`}
                                    >
                                        ${amount}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDonateModal(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDonate}
                                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black py-3 rounded-lg font-bold transition-all"
                                >
                                    Donate ${donateAmount}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default SyndicateHUD;
