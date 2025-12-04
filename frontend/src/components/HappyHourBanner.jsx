import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * HappyHourBanner - Time-limited event display with countdown
 *
 * Psychology:
 * - Visual urgency creates FOMO
 * - Countdown timer drives immediate action
 * - Pulsing animations draw attention
 */

const BONUS_CONFIGS = {
    XP_BOOST: {
        icon: '⚡',
        title: 'XP Rush',
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-900/50',
        borderColor: 'border-purple-500',
        description: 'Double XP on all games!'
    },
    CHIP_BOOST: {
        icon: '💰',
        title: 'Golden Hour',
        color: 'from-yellow-500 to-orange-500',
        bgColor: 'bg-yellow-900/50',
        borderColor: 'border-yellow-500',
        description: '1.5x chip wins!'
    },
    MYSTERY_BOOST: {
        icon: '🎁',
        title: 'Mystery Mania',
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-900/50',
        borderColor: 'border-emerald-500',
        description: '3x mystery drop chance!'
    },
    STREAK_PROTECT: {
        icon: '🛡️',
        title: 'Streak Shield',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-900/50',
        borderColor: 'border-blue-500',
        description: 'Your streak is protected!'
    }
};

const HappyHourBanner = ({ socket }) => {
    const [activeEvent, setActiveEvent] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [upcomingEvents, setUpcomingEvents] = useState([]);

    // Fetch current happy hour status
    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/happy-hour/status');
            if (response.ok) {
                const data = await response.json();
                if (data.active) {
                    setActiveEvent(data);
                } else {
                    setActiveEvent(null);
                }
                if (data.upcoming) {
                    setUpcomingEvents(data.upcoming);
                }
            }
        } catch (error) {
            console.error('Failed to fetch happy hour status:', error);
        }
    }, []);

    useEffect(() => {
        fetchStatus();

        // Poll every minute
        const interval = setInterval(fetchStatus, 60000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const handleHappyHourStart = (data) => {
            setActiveEvent({
                bonusType: data.bonusType,
                multiplier: data.multiplier,
                endTime: data.endTime
            });
        };

        const handleHappyHourEnding = (data) => {
            // Flash warning animation
            setTimeRemaining(prev => ({ ...prev, warning: true }));
        };

        const handleHappyHourEnd = () => {
            setActiveEvent(null);
            setTimeRemaining(null);
        };

        socket.on('happy_hour_started', handleHappyHourStart);
        socket.on('happy_hour_ending_soon', handleHappyHourEnding);
        socket.on('happy_hour_ended', handleHappyHourEnd);

        return () => {
            socket.off('happy_hour_started', handleHappyHourStart);
            socket.off('happy_hour_ending_soon', handleHappyHourEnding);
            socket.off('happy_hour_ended', handleHappyHourEnd);
        };
    }, [socket]);

    // Countdown timer
    useEffect(() => {
        if (!activeEvent?.endTime) {
            setTimeRemaining(null);
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const end = new Date(activeEvent.endTime).getTime();
            const diff = end - now;

            if (diff <= 0) {
                setActiveEvent(null);
                setTimeRemaining(null);
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            setTimeRemaining({
                minutes,
                seconds,
                warning: diff < 5 * 60 * 1000 // Less than 5 minutes
            });
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeEvent?.endTime]);

    if (!activeEvent) {
        return null;
    }

    const config = BONUS_CONFIGS[activeEvent.bonusType] || BONUS_CONFIGS.XP_BOOST;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-40"
            >
                {/* Minimized State */}
                {isMinimized ? (
                    <motion.button
                        onClick={() => setIsMinimized(false)}
                        className={`absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r ${config.color} px-4 py-2 rounded-full shadow-lg flex items-center gap-2`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className="text-lg">{config.icon}</span>
                        <span className="text-white font-bold">
                            {timeRemaining && `${timeRemaining.minutes}:${String(timeRemaining.seconds).padStart(2, '0')}`}
                        </span>
                    </motion.button>
                ) : (
                    /* Full Banner */
                    <motion.div
                        className={`${config.bgColor} border-b ${config.borderColor} backdrop-blur-sm`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {/* Animated background */}
                        <div className="absolute inset-0 overflow-hidden">
                            <motion.div
                                className={`absolute inset-0 bg-gradient-to-r ${config.color} opacity-20`}
                                animate={{
                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: 'linear'
                                }}
                            />
                        </div>

                        <div className="relative container mx-auto px-4 py-3">
                            <div className="flex items-center justify-between">
                                {/* Left: Icon and Title */}
                                <div className="flex items-center gap-3">
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className="text-3xl"
                                    >
                                        {config.icon}
                                    </motion.div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className={`font-bold text-transparent bg-clip-text bg-gradient-to-r ${config.color}`}>
                                                HAPPY HOUR: {config.title}
                                            </h3>
                                            {activeEvent.multiplier > 1 && (
                                                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold text-white">
                                                    {activeEvent.multiplier}x
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-white/80">{config.description}</p>
                                    </div>
                                </div>

                                {/* Center: Countdown */}
                                <div className="hidden sm:flex items-center gap-4">
                                    <motion.div
                                        className={`bg-black/30 rounded-xl px-6 py-2 border ${
                                            timeRemaining?.warning ? 'border-red-500' : 'border-white/20'
                                        }`}
                                        animate={timeRemaining?.warning ? {
                                            borderColor: ['#ef4444', '#ffffff33', '#ef4444']
                                        } : {}}
                                        transition={{ duration: 0.5, repeat: Infinity }}
                                    >
                                        <div className="text-xs text-white/60 text-center">ENDS IN</div>
                                        <div className={`text-2xl font-mono font-bold ${
                                            timeRemaining?.warning ? 'text-red-400' : 'text-white'
                                        }`}>
                                            {timeRemaining ? (
                                                `${String(timeRemaining.minutes).padStart(2, '0')}:${String(timeRemaining.seconds).padStart(2, '0')}`
                                            ) : (
                                                '--:--'
                                            )}
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-2">
                                    {/* Mobile countdown */}
                                    <div className={`sm:hidden bg-black/30 rounded-lg px-3 py-1 border ${
                                        timeRemaining?.warning ? 'border-red-500' : 'border-white/20'
                                    }`}>
                                        <span className={`font-mono font-bold ${
                                            timeRemaining?.warning ? 'text-red-400' : 'text-white'
                                        }`}>
                                            {timeRemaining ? (
                                                `${timeRemaining.minutes}:${String(timeRemaining.seconds).padStart(2, '0')}`
                                            ) : (
                                                '--:--'
                                            )}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => setIsMinimized(true)}
                                        className="text-white/60 hover:text-white p-2 transition-colors"
                                        title="Minimize"
                                    >
                                        ▲
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        {activeEvent.endTime && (
                            <motion.div
                                className={`h-1 bg-gradient-to-r ${config.color}`}
                                initial={{ width: '100%' }}
                                animate={{ width: '0%' }}
                                transition={{
                                    duration: (new Date(activeEvent.endTime).getTime() - Date.now()) / 1000,
                                    ease: 'linear'
                                }}
                            />
                        )}
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default HappyHourBanner;
