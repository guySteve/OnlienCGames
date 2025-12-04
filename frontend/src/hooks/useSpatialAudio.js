import { useCallback, useEffect, useRef } from 'react';

/**
 * useSpatialAudio - Howler.js integration for immersive audio
 *
 * Features:
 * 1. Spatial panning based on seat position
 * 2. Sound variant selection for natural feel
 * 3. Volume ducking during important events
 * 4. Preloading for instant feedback
 */

// Sound definitions with variants
const SOUNDS = {
    // Card sounds
    cardDeal: {
        src: ['/audio/card-deal-1.mp3', '/audio/card-deal-2.mp3', '/audio/card-deal-3.mp3'],
        volume: 0.6,
        rate: [0.95, 1.05] // Slight pitch variation
    },
    cardFlip: {
        src: ['/audio/card-flip.mp3'],
        volume: 0.5
    },
    cardShuffle: {
        src: ['/audio/shuffle.mp3'],
        volume: 0.4,
        duration: 2000
    },

    // Chip sounds
    chipStack: {
        src: ['/audio/chip-stack-1.mp3', '/audio/chip-stack-2.mp3'],
        volume: 0.5
    },
    chipSingle: {
        src: ['/audio/chip-single.mp3'],
        volume: 0.3
    },
    chipWin: {
        src: ['/audio/chips-win.mp3'],
        volume: 0.7
    },
    chipLose: {
        src: ['/audio/chips-lose.mp3'],
        volume: 0.4
    },

    // UI sounds
    buttonClick: {
        src: ['/audio/click.mp3'],
        volume: 0.3
    },
    notification: {
        src: ['/audio/notification.mp3'],
        volume: 0.5
    },
    mysteryDrop: {
        src: ['/audio/mystery-drop.mp3'],
        volume: 0.8
    },
    levelUp: {
        src: ['/audio/level-up.mp3'],
        volume: 0.7
    },

    // Ambient
    tableAmbient: {
        src: ['/audio/casino-ambient.mp3'],
        volume: 0.15,
        loop: true
    },

    // Game events
    win: {
        src: ['/audio/win.mp3'],
        volume: 0.6
    },
    lose: {
        src: ['/audio/lose.mp3'],
        volume: 0.4
    },
    bigWin: {
        src: ['/audio/big-win.mp3'],
        volume: 0.8
    },
    nearMiss: {
        src: ['/audio/near-miss.mp3'],
        volume: 0.5
    },

    // Bingo
    ballDraw: {
        src: ['/audio/bingo-ball.mp3'],
        volume: 0.5
    },
    bingoWin: {
        src: ['/audio/bingo-win.mp3'],
        volume: 0.8
    },
    dabNumber: {
        src: ['/audio/dab.mp3'],
        volume: 0.3
    },

    // Happy Hour
    happyHourStart: {
        src: ['/audio/happy-hour-start.mp3'],
        volume: 0.7
    },
    happyHourEnd: {
        src: ['/audio/happy-hour-end.mp3'],
        volume: 0.5
    }
};

// Seat positions for stereo panning (-1 = left, 0 = center, 1 = right)
const SEAT_POSITIONS = {
    0: -0.8,  // Far left
    1: -0.4,  // Left
    2: 0,     // Center
    3: 0.4,   // Right
    4: 0.8    // Far right
};

const useSpatialAudio = (options = {}) => {
    const { enabled = true, masterVolume = 1.0 } = options;
    const howlerRef = useRef(null);
    const soundsRef = useRef({});
    const ambientRef = useRef(null);

    // Initialize Howler.js
    useEffect(() => {
        if (!enabled) return;

        // Dynamic import Howler
        import('howler').then(({ Howl, Howler }) => {
            howlerRef.current = Howler;

            // Set global volume
            Howler.volume(masterVolume);

            // Preload critical sounds
            const criticalSounds = ['cardDeal', 'chipStack', 'win', 'buttonClick'];

            criticalSounds.forEach(soundName => {
                const config = SOUNDS[soundName];
                if (config) {
                    soundsRef.current[soundName] = new Howl({
                        src: config.src,
                        volume: config.volume,
                        preload: true
                    });
                }
            });
        }).catch(error => {
            console.warn('Failed to load Howler.js:', error);
        });

        return () => {
            // Cleanup all sounds
            Object.values(soundsRef.current).forEach(sound => {
                if (sound?.unload) sound.unload();
            });
            if (ambientRef.current?.unload) {
                ambientRef.current.unload();
            }
        };
    }, [enabled, masterVolume]);

    /**
     * Get or create a Howl instance for a sound
     */
    const getSound = useCallback(async (soundName) => {
        if (!enabled || !SOUNDS[soundName]) return null;

        if (soundsRef.current[soundName]) {
            return soundsRef.current[soundName];
        }

        const { Howl } = await import('howler');
        const config = SOUNDS[soundName];

        soundsRef.current[soundName] = new Howl({
            src: config.src,
            volume: config.volume * masterVolume,
            loop: config.loop || false
        });

        return soundsRef.current[soundName];
    }, [enabled, masterVolume]);

    /**
     * Play a sound with optional spatial positioning
     */
    const playSound = useCallback(async (soundName, options = {}) => {
        if (!enabled) return;

        const { seatIndex, pan, volume, rate } = options;

        try {
            const sound = await getSound(soundName);
            if (!sound) return;

            // Play a new instance
            const id = sound.play();

            // Apply spatial panning
            if (seatIndex !== undefined && SEAT_POSITIONS[seatIndex] !== undefined) {
                sound.stereo(SEAT_POSITIONS[seatIndex], id);
            } else if (pan !== undefined) {
                sound.stereo(pan, id);
            }

            // Apply custom volume
            if (volume !== undefined) {
                sound.volume(volume * masterVolume, id);
            }

            // Apply playback rate (pitch)
            if (rate !== undefined) {
                sound.rate(rate, id);
            } else {
                // Random slight variation for natural feel
                const config = SOUNDS[soundName];
                if (config?.rate) {
                    const [min, max] = config.rate;
                    sound.rate(min + Math.random() * (max - min), id);
                }
            }

            return id;
        } catch (error) {
            console.warn(`Failed to play sound: ${soundName}`, error);
        }
    }, [enabled, getSound, masterVolume]);

    /**
     * Play card deal with shoe-to-seat animation timing
     */
    const playCardDeal = useCallback((seatIndex, delay = 0) => {
        if (!enabled) return;

        setTimeout(() => {
            playSound('cardDeal', { seatIndex });
        }, delay);
    }, [enabled, playSound]);

    /**
     * Play chip stack sound with amount-based intensity
     */
    const playChipSound = useCallback((amount, seatIndex) => {
        if (!enabled) return;

        if (amount >= 1000) {
            playSound('chipWin', { seatIndex, volume: 0.8 });
        } else if (amount >= 100) {
            playSound('chipStack', { seatIndex });
        } else {
            playSound('chipSingle', { seatIndex });
        }
    }, [enabled, playSound]);

    /**
     * Start ambient casino sounds
     */
    const startAmbient = useCallback(async () => {
        if (!enabled || ambientRef.current) return;

        try {
            const { Howl } = await import('howler');
            const config = SOUNDS.tableAmbient;

            ambientRef.current = new Howl({
                src: config.src,
                volume: config.volume * masterVolume,
                loop: true
            });

            ambientRef.current.play();
        } catch (error) {
            console.warn('Failed to start ambient audio:', error);
        }
    }, [enabled, masterVolume]);

    /**
     * Stop ambient sounds
     */
    const stopAmbient = useCallback(() => {
        if (ambientRef.current) {
            ambientRef.current.fade(ambientRef.current.volume(), 0, 1000);
            setTimeout(() => {
                ambientRef.current?.stop();
                ambientRef.current?.unload();
                ambientRef.current = null;
            }, 1000);
        }
    }, []);

    /**
     * Duck all sounds (lower volume) during important events
     */
    const duckAudio = useCallback((duration = 2000) => {
        if (!howlerRef.current) return;

        const original = howlerRef.current.volume();
        howlerRef.current.volume(original * 0.3);

        setTimeout(() => {
            howlerRef.current?.volume(original);
        }, duration);
    }, []);

    /**
     * Play win/lose result with appropriate fanfare
     */
    const playResult = useCallback((result, amount = 0, seatIndex) => {
        if (!enabled) return;

        switch (result) {
            case 'bigWin':
                duckAudio(3000);
                playSound('bigWin', { seatIndex });
                break;
            case 'win':
                playSound('win', { seatIndex });
                playChipSound(amount, seatIndex);
                break;
            case 'lose':
                playSound('lose', { seatIndex });
                break;
            case 'nearMiss':
                playSound('nearMiss', { seatIndex });
                break;
            case 'push':
                playSound('chipSingle', { seatIndex });
                break;
            default:
                break;
        }
    }, [enabled, duckAudio, playSound, playChipSound]);

    /**
     * Play Bingo-specific sounds
     */
    const playBingo = useCallback((event, data = {}) => {
        if (!enabled) return;

        switch (event) {
            case 'ballDraw':
                playSound('ballDraw');
                break;
            case 'dab':
                playSound('dabNumber');
                break;
            case 'win':
                duckAudio(4000);
                playSound('bingoWin');
                break;
            default:
                break;
        }
    }, [enabled, duckAudio, playSound]);

    /**
     * Set master volume
     */
    const setVolume = useCallback((volume) => {
        if (howlerRef.current) {
            howlerRef.current.volume(volume);
        }
    }, []);

    /**
     * Mute/unmute all audio
     */
    const setMuted = useCallback((muted) => {
        if (howlerRef.current) {
            howlerRef.current.mute(muted);
        }
    }, []);

    return {
        playSound,
        playCardDeal,
        playChipSound,
        playResult,
        playBingo,
        startAmbient,
        stopAmbient,
        duckAudio,
        setVolume,
        setMuted,
        isEnabled: enabled
    };
};

export default useSpatialAudio;
