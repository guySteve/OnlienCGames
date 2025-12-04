import { useCallback, useMemo } from 'react';

/**
 * useCardPhysics - Physics-based card animation system
 *
 * Uses framer-motion for animations with casino-authentic physics:
 * 1. Cards deal from shoe position (top-right) to player seats
 * 2. Arc trajectory with rotation
 * 3. Slight randomization for natural feel
 * 4. Staggered timing for multi-card deals
 */

// Table layout constants (adjust based on your table design)
const TABLE_LAYOUT = {
    shoe: { x: 85, y: 5 }, // Percentage position of dealer shoe
    dealer: { x: 50, y: 15 },
    seats: [
        { x: 10, y: 75 },   // Seat 0 (far left)
        { x: 30, y: 80 },   // Seat 1
        { x: 50, y: 82 },   // Seat 2 (center)
        { x: 70, y: 80 },   // Seat 3
        { x: 90, y: 75 },   // Seat 4 (far right)
    ]
};

// Animation timing constants
const TIMING = {
    dealDuration: 0.4,      // Base deal animation duration
    flipDuration: 0.3,      // Card flip duration
    collectDuration: 0.5,   // Collect cards to dealer
    staggerDelay: 0.15,     // Delay between each card in sequence
    revealDelay: 0.5        // Pause before revealing
};

// Physics constants
const PHYSICS = {
    stiffness: 100,
    damping: 15,
    mass: 0.5
};

const useCardPhysics = (containerRef) => {

    /**
     * Calculate arc trajectory from shoe to seat
     */
    const calculateDealPath = useCallback((seatIndex, cardIndex = 0) => {
        const shoe = TABLE_LAYOUT.shoe;
        const seat = TABLE_LAYOUT.seats[seatIndex] || TABLE_LAYOUT.seats[2];

        // Add slight randomization for natural feel
        const randomOffset = {
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 2
        };

        // Calculate midpoint for arc
        const midX = (shoe.x + seat.x) / 2;
        const midY = Math.min(shoe.y, seat.y) - 10; // Arc upward

        return {
            start: { x: shoe.x, y: shoe.y },
            mid: { x: midX, y: midY },
            end: {
                x: seat.x + randomOffset.x + (cardIndex * 2), // Offset for stacked cards
                y: seat.y + randomOffset.y
            }
        };
    }, []);

    /**
     * Generate framer-motion animation for dealing a card
     */
    const getDealAnimation = useCallback((seatIndex, options = {}) => {
        const {
            cardIndex = 0,
            isFaceDown = false,
            delay = 0
        } = options;

        const path = calculateDealPath(seatIndex, cardIndex);

        return {
            initial: {
                x: `${path.start.x}vw`,
                y: `${path.start.y}vh`,
                scale: 0.5,
                rotateY: 180, // Start face down
                rotateZ: Math.random() * 10 - 5, // Slight random rotation
                opacity: 0
            },
            animate: {
                x: [
                    `${path.start.x}vw`,
                    `${path.mid.x}vw`,
                    `${path.end.x}vw`
                ],
                y: [
                    `${path.start.y}vh`,
                    `${path.mid.y}vh`,
                    `${path.end.y}vh`
                ],
                scale: [0.5, 0.8, 1],
                rotateY: isFaceDown ? 180 : 0,
                rotateZ: Math.random() * 4 - 2,
                opacity: 1
            },
            transition: {
                duration: TIMING.dealDuration,
                delay: delay + (cardIndex * TIMING.staggerDelay),
                ease: [0.25, 0.1, 0.25, 1], // Custom easing
                rotateY: {
                    delay: delay + (cardIndex * TIMING.staggerDelay) + TIMING.dealDuration * 0.7,
                    duration: TIMING.flipDuration
                }
            }
        };
    }, [calculateDealPath]);

    /**
     * Generate animation for dealing to dealer
     */
    const getDealerAnimation = useCallback((cardIndex = 0, options = {}) => {
        const { isFaceDown = true, delay = 0 } = options;
        const path = {
            start: TABLE_LAYOUT.shoe,
            end: TABLE_LAYOUT.dealer
        };

        return {
            initial: {
                x: `${path.start.x}vw`,
                y: `${path.start.y}vh`,
                scale: 0.5,
                rotateY: 180,
                opacity: 0
            },
            animate: {
                x: `${path.end.x + (cardIndex * 1.5)}vw`,
                y: `${path.end.y}vh`,
                scale: 0.9,
                rotateY: isFaceDown ? 180 : 0,
                opacity: 1
            },
            transition: {
                duration: TIMING.dealDuration * 0.8,
                delay,
                ease: 'easeOut'
            }
        };
    }, []);

    /**
     * Generate card flip animation
     */
    const getFlipAnimation = useCallback((delay = 0) => {
        return {
            animate: {
                rotateY: [180, 0]
            },
            transition: {
                duration: TIMING.flipDuration,
                delay,
                ease: 'easeInOut'
            }
        };
    }, []);

    /**
     * Generate collect cards animation (sweep to dealer)
     */
    const getCollectAnimation = useCallback((fromSeatIndex, delay = 0) => {
        const seat = TABLE_LAYOUT.seats[fromSeatIndex] || TABLE_LAYOUT.seats[2];
        const dealer = TABLE_LAYOUT.dealer;

        return {
            animate: {
                x: `${dealer.x}vw`,
                y: `${dealer.y - 10}vh`,
                scale: 0.3,
                rotateZ: Math.random() * 30,
                opacity: 0
            },
            transition: {
                duration: TIMING.collectDuration,
                delay,
                ease: 'easeIn'
            }
        };
    }, []);

    /**
     * Generate win celebration animation
     */
    const getWinAnimation = useCallback(() => {
        return {
            initial: { scale: 1 },
            animate: {
                scale: [1, 1.1, 1.05, 1.1, 1],
                y: [0, -10, 0, -5, 0]
            },
            transition: {
                duration: 0.5,
                ease: 'easeOut'
            }
        };
    }, []);

    /**
     * Generate chip stack animation
     */
    const getChipAnimation = useCallback((fromPot, toSeatIndex, amount) => {
        const seat = TABLE_LAYOUT.seats[toSeatIndex] || TABLE_LAYOUT.seats[2];
        const potPosition = { x: 50, y: 40 }; // Center of table

        // Number of chip sprites based on amount
        const chipCount = Math.min(Math.ceil(amount / 100), 10);

        return Array.from({ length: chipCount }, (_, i) => ({
            initial: {
                x: `${potPosition.x}vw`,
                y: `${potPosition.y}vh`,
                scale: 1,
                opacity: 1
            },
            animate: {
                x: `${seat.x + (Math.random() * 4 - 2)}vw`,
                y: `${seat.y - 5 + (Math.random() * 2)}vh`,
                scale: 0.8,
                opacity: 1
            },
            transition: {
                duration: 0.4,
                delay: i * 0.05,
                ease: [0.25, 0.1, 0.25, 1]
            }
        }));
    }, []);

    /**
     * Generate shuffle animation
     */
    const getShuffleAnimation = useCallback(() => {
        return {
            animate: {
                x: [0, -5, 5, -3, 3, 0],
                rotateZ: [0, -2, 2, -1, 1, 0]
            },
            transition: {
                duration: 0.8,
                repeat: 2,
                ease: 'easeInOut'
            }
        };
    }, []);

    /**
     * Generate near-miss "almost" animation
     */
    const getNearMissAnimation = useCallback(() => {
        return {
            animate: {
                scale: [1, 1.05, 1, 1.03, 1],
                filter: [
                    'brightness(1)',
                    'brightness(1.3)',
                    'brightness(1)',
                    'brightness(1.2)',
                    'brightness(1)'
                ]
            },
            transition: {
                duration: 0.6,
                ease: 'easeOut'
            }
        };
    }, []);

    /**
     * Spring physics config for framer-motion
     */
    const springConfig = useMemo(() => ({
        type: 'spring',
        stiffness: PHYSICS.stiffness,
        damping: PHYSICS.damping,
        mass: PHYSICS.mass
    }), []);

    /**
     * Generate full deal sequence for a round
     */
    const generateDealSequence = useCallback((seatIndices, cardsPerSeat = 1, dealerCards = 1) => {
        const sequence = [];
        let currentDelay = 0;

        // Deal to each seat
        for (let cardNum = 0; cardNum < cardsPerSeat; cardNum++) {
            for (let seatIdx of seatIndices) {
                sequence.push({
                    type: 'playerCard',
                    seatIndex: seatIdx,
                    cardIndex: cardNum,
                    animation: getDealAnimation(seatIdx, {
                        cardIndex: cardNum,
                        delay: currentDelay
                    })
                });
                currentDelay += TIMING.staggerDelay;
            }

            // Deal to dealer after each round of player cards
            if (dealerCards > cardNum) {
                sequence.push({
                    type: 'dealerCard',
                    cardIndex: cardNum,
                    animation: getDealerAnimation(cardNum, {
                        isFaceDown: cardNum === 1, // Second card face down (blackjack)
                        delay: currentDelay
                    })
                });
                currentDelay += TIMING.staggerDelay;
            }
        }

        return {
            sequence,
            totalDuration: currentDelay + TIMING.dealDuration
        };
    }, [getDealAnimation, getDealerAnimation]);

    return {
        // Core animations
        getDealAnimation,
        getDealerAnimation,
        getFlipAnimation,
        getCollectAnimation,
        getWinAnimation,
        getChipAnimation,
        getShuffleAnimation,
        getNearMissAnimation,

        // Sequences
        generateDealSequence,

        // Physics config
        springConfig,

        // Layout info
        layout: TABLE_LAYOUT,
        timing: TIMING
    };
};

export default useCardPhysics;
