/**
 * useGameAnimations.js
 *
 * Custom hook for casino game animations using anime.js
 * Implements card dealing, chip movements, and win/loss visual feedback
 */

import { useRef, useCallback } from 'react';
import anime from 'animejs';

export const useGameAnimations = () => {
  // Refs for animation cleanup
  const activeAnimations = useRef([]);

  // Cleanup function to stop all running animations
  const cleanup = useCallback(() => {
    activeAnimations.current.forEach(anim => {
      if (anim && anim.pause) anim.pause();
    });
    activeAnimations.current = [];
  }, []);

  /**
   * Deal card animation - card flies from shoe (top right) to target position
   * @param {HTMLElement} cardElement - The card DOM element
   * @param {Object} targetPos - { x, y } final position
   * @param {number} delay - Delay before animation starts (ms)
   * @param {Function} onComplete - Callback when animation completes
   */
  const dealCard = useCallback((cardElement, targetPos, delay = 0, onComplete) => {
    if (!cardElement) return null;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;

    // Shoe position (top right corner)
    const shoeX = viewportWidth - 80;
    const shoeY = 60;

    // Set initial position (at shoe)
    cardElement.style.position = 'fixed';
    cardElement.style.left = `${shoeX}px`;
    cardElement.style.top = `${shoeY}px`;
    cardElement.style.transform = 'scale(0.3) rotateY(180deg)';
    cardElement.style.opacity = '1';
    cardElement.style.zIndex = '1000';

    const animation = anime.timeline({
      easing: 'easeOutQuart',
      complete: () => {
        // Reset to relative positioning after animation
        cardElement.style.position = '';
        cardElement.style.left = '';
        cardElement.style.top = '';
        cardElement.style.transform = '';
        cardElement.style.zIndex = '';
        if (onComplete) onComplete();
      }
    })
    .add({
      targets: cardElement,
      left: targetPos.x,
      top: targetPos.y,
      scale: 1,
      rotateY: 0,
      duration: 600,
      delay: delay
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Deal multiple cards with staggered timing
   * @param {HTMLElement[]} cardElements - Array of card DOM elements
   * @param {Object[]} targetPositions - Array of { x, y } positions
   * @param {Function} onComplete - Callback when all animations complete
   */
  const dealCards = useCallback((cardElements, targetPositions, onComplete) => {
    if (!cardElements || cardElements.length === 0) return;

    const staggerDelay = 150; // ms between each card
    let completed = 0;
    const total = cardElements.length;

    cardElements.forEach((card, index) => {
      const pos = targetPositions[index] || targetPositions[0];
      dealCard(card, pos, index * staggerDelay, () => {
        completed++;
        if (completed === total && onComplete) {
          onComplete();
        }
      });
    });
  }, [dealCard]);

  /**
   * Chip fly animation - chips move from one position to another
   * @param {HTMLElement} chipElement - The chip container element
   * @param {Object} fromPos - Starting { x, y } position
   * @param {Object} toPos - Ending { x, y } position
   * @param {Object} options - { delay, duration, count }
   */
  const flyChips = useCallback((chipElement, fromPos, toPos, options = {}) => {
    if (!chipElement) return null;

    const { delay = 0, duration = 800, count = 3 } = options;

    // Create chip stack visual
    const chips = [];
    for (let i = 0; i < count; i++) {
      const chip = document.createElement('div');
      chip.className = 'flying-chip';
      chip.style.cssText = `
        position: fixed;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
        border: 3px solid #fef3c7;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4);
        left: ${fromPos.x + (i * 4)}px;
        top: ${fromPos.y - (i * 4)}px;
        z-index: ${1000 + i};
        opacity: 0;
      `;
      document.body.appendChild(chip);
      chips.push(chip);
    }

    const timeline = anime.timeline({
      easing: 'easeOutQuad',
      complete: () => {
        chips.forEach(chip => chip.remove());
      }
    });

    // Animate each chip with slight stagger
    chips.forEach((chip, i) => {
      timeline.add({
        targets: chip,
        left: toPos.x + (i * 2),
        top: toPos.y - (i * 2),
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1.2, 1, 0.8],
        duration: duration,
        delay: delay + (i * 50)
      }, 0);
    });

    activeAnimations.current.push(timeline);
    return timeline;
  }, []);

  /**
   * Win glow effect - neon glow around winning element
   * @param {HTMLElement} element - The element to highlight
   * @param {string} color - Glow color (default: gold)
   */
  const winGlow = useCallback((element, color = '#fbbf24') => {
    if (!element) return null;

    // Store original box-shadow
    const originalShadow = element.style.boxShadow;

    const animation = anime({
      targets: element,
      boxShadow: [
        `0 0 0 0 ${color}00`,
        `0 0 30px 10px ${color}80`,
        `0 0 60px 20px ${color}40`,
        `0 0 30px 10px ${color}80`,
        `0 0 0 0 ${color}00`
      ],
      duration: 2000,
      easing: 'easeInOutSine',
      loop: 2,
      complete: () => {
        element.style.boxShadow = originalShadow;
      }
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Loss shake effect - subtle shake on losing element
   * @param {HTMLElement} element - The element to shake
   */
  const lossShake = useCallback((element) => {
    if (!element) return null;

    const animation = anime({
      targets: element,
      translateX: [0, -10, 10, -10, 10, -5, 5, 0],
      duration: 500,
      easing: 'easeInOutSine'
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Card flip animation
   * @param {HTMLElement} cardElement - The card to flip
   * @param {boolean} faceUp - Whether to flip face up or down
   */
  const flipCard = useCallback((cardElement, faceUp = true) => {
    if (!cardElement) return null;

    const animation = anime({
      targets: cardElement,
      rotateY: faceUp ? [180, 0] : [0, 180],
      duration: 400,
      easing: 'easeOutQuad'
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Pot pulse animation - draws attention to pot
   * @param {HTMLElement} potElement - The pot display element
   */
  const pulsePot = useCallback((potElement) => {
    if (!potElement) return null;

    const animation = anime({
      targets: potElement,
      scale: [1, 1.1, 1],
      duration: 500,
      easing: 'easeInOutSine'
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Bingo ball roll animation - realistic tumbling motion from cage
   * @param {HTMLElement} ballElement - The ball element
   */
  const rollBingoBall = useCallback((ballElement) => {
    if (!ballElement) return null;

    // Create a more dynamic, tumbling ball animation
    const animation = anime.timeline({
      easing: 'easeOutElastic(1, 0.5)'
    })
    // Phase 1: Ball tumbles in from above left (like coming out of cage)
    .add({
      targets: ballElement,
      translateX: [-150, 0],
      translateY: [-100, 0],
      rotate: [1080, 0], // 3 full rotations
      scale: [0.3, 1],
      opacity: [0, 1],
      duration: 800,
      easing: 'easeOutQuart'
    })
    // Phase 2: Settle bounce
    .add({
      targets: ballElement,
      translateY: [0, -20, 0],
      scale: [1, 1.1, 1],
      rotate: [0, -15, 0],
      duration: 400,
      easing: 'easeOutBounce'
    })
    // Phase 3: Gentle wobble to rest
    .add({
      targets: ballElement,
      rotate: [0, 5, -3, 0],
      duration: 300,
      easing: 'easeOutSine'
    })
    // Phase 4: Emphasis pulse
    .add({
      targets: ballElement,
      scale: [1, 1.15, 1],
      boxShadow: [
        '0 0 0px rgba(255,215,0,0)',
        '0 0 30px rgba(255,215,0,0.8)',
        '0 0 10px rgba(255,215,0,0.3)'
      ],
      duration: 400,
      easing: 'easeOutQuad'
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Number mark animation for bingo cards
   * @param {HTMLElement} cellElement - The cell to mark
   */
  const markBingoNumber = useCallback((cellElement) => {
    if (!cellElement) return null;

    const animation = anime({
      targets: cellElement,
      scale: [1, 1.3, 1],
      backgroundColor: ['rgba(251, 191, 36, 0)', 'rgba(251, 191, 36, 0.8)'],
      duration: 400,
      easing: 'easeOutBack'
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Confetti explosion for wins
   * @param {Object} position - { x, y } center position
   * @param {number} count - Number of confetti pieces
   */
  const confetti = useCallback((position, count = 50) => {
    const colors = ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
    const particles = [];

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[i % colors.length]};
        left: ${position.x}px;
        top: ${position.y}px;
        z-index: 9999;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        pointer-events: none;
      `;
      document.body.appendChild(particle);
      particles.push(particle);
    }

    const animation = anime({
      targets: particles,
      left: () => position.x + anime.random(-300, 300),
      top: () => position.y + anime.random(-300, 300),
      rotate: () => anime.random(-720, 720),
      scale: [1, 0],
      opacity: [1, 0],
      duration: 2000,
      easing: 'easeOutExpo',
      delay: anime.stagger(10),
      complete: () => {
        particles.forEach(p => p.remove());
      }
    });

    activeAnimations.current.push(animation);
    return animation;
  }, []);

  /**
   * Get element's center position for animation targeting
   * @param {HTMLElement} element
   * @returns {Object} { x, y }
   */
  const getElementCenter = useCallback((element) => {
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }, []);

  return {
    // Core animations
    dealCard,
    dealCards,
    flyChips,
    flipCard,

    // Feedback animations
    winGlow,
    lossShake,
    pulsePot,
    confetti,

    // Bingo specific
    rollBingoBall,
    markBingoNumber,

    // Utilities
    getElementCenter,
    cleanup
  };
};

export default useGameAnimations;
