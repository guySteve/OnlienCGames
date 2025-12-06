// @/hooks/useChipAnimation.js
import { useCallback, useRef } from 'react';
import anime from 'animejs';

/**
 * useChipAnimation - Professional casino chip animation system
 *
 * Features:
 * - Parabolic arc movements (GEMINI standard)
 * - Stacking with rotation
 * - Sound integration ready
 * - Batch animations
 *
 * @param {Object} options - Animation configuration
 * @param {Function} options.onComplete - Callback when animation completes
 * @param {number} options.duration - Animation duration in ms (default: 800)
 * @param {string} options.easing - Easing function (default: cubicBezier(0.25, 0.46, 0.45, 0.94))
 */
const useChipAnimation = ({ onComplete, duration = 800, easing = 'cubicBezier(0.25, 0.46, 0.45, 0.94)' } = {}) => {
  const animationRef = useRef(null);

  /**
   * Animate a chip from source to target with parabolic arc
   * @param {Object} params
   * @param {HTMLElement} params.chipElement - The chip DOM element
   * @param {Object} params.from - Starting position {x, y}
   * @param {Object} params.to - Ending position {x, y}
   * @param {number} params.arcHeight - Height of parabolic arc (default: 100)
   * @param {number} params.rotation - Rotation on landing (default: random -15 to 15)
   */
  const animateChip = useCallback(({
    chipElement,
    from,
    to,
    arcHeight = 100,
    rotation = Math.random() * 30 - 15,
    onChipComplete
  }) => {
    if (!chipElement) return;

    // Set initial position
    chipElement.style.position = 'absolute';
    chipElement.style.left = `${from.x}px`;
    chipElement.style.top = `${from.y}px`;

    // Calculate arc path
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Create parabolic arc using bezier curve
    const controlX = from.x + dx / 2;
    const controlY = from.y + dy / 2 - arcHeight;

    const timeline = anime.timeline({
      easing,
      duration,
      complete: () => {
        if (onChipComplete) onChipComplete();
        if (onComplete) onComplete();
      }
    });

    // Animate along parabolic path
    timeline.add({
      targets: chipElement,
      translateX: [0, dx],
      translateY: [
        { value: dy / 2 - arcHeight, duration: duration / 2 },
        { value: dy, duration: duration / 2 }
      ],
      rotate: [0, rotation],
      scale: [1, 0.95, 1],
      opacity: [0.8, 1],
    });

    animationRef.current = timeline;

    return timeline;
  }, [duration, easing, onComplete]);

  /**
   * Animate multiple chips to same target (stacking)
   * @param {Array} chips - Array of {chipElement, from} objects
   * @param {Object} to - Target position {x, y}
   * @param {number} delay - Delay between each chip (default: 100ms)
   */
  const animateChipStack = useCallback((chips, to, delay = 100) => {
    const timeline = anime.timeline({
      easing,
      complete: onComplete
    });

    chips.forEach((chip, index) => {
      const stackOffset = index * 3; // Visual stacking offset
      const rotation = Math.random() * 10 - 5;

      timeline.add({
        targets: chip.chipElement,
        translateX: to.x - chip.from.x,
        translateY: [
          { value: (to.y - chip.from.y) / 2 - 80, duration: duration / 2 },
          { value: to.y - chip.from.y - stackOffset, duration: duration / 2 }
        ],
        rotate: rotation,
        scale: [1, 0.95, 1],
        opacity: [0.8, 1],
        duration,
      }, index * delay);
    });

    animationRef.current = timeline;
    return timeline;
  }, [duration, easing, onComplete]);

  /**
   * Animate chips from target back to source (e.g., bet return)
   * @param {HTMLElement} chipElement
   * @param {Object} from - Starting position
   * @param {Object} to - Ending position
   */
  const returnChip = useCallback(({
    chipElement,
    from,
    to,
    onChipComplete
  }) => {
    return animateChip({
      chipElement,
      from,
      to,
      arcHeight: 60,
      rotation: 0,
      onChipComplete
    });
  }, [animateChip]);

  /**
   * Collect chips from multiple positions to dealer (winnings)
   * @param {Array} chips - Array of chip elements
   * @param {Object} dealerPosition - Dealer's position {x, y}
   */
  const collectChips = useCallback((chips, dealerPosition) => {
    const timeline = anime.timeline({
      easing: 'easeInQuad',
      complete: onComplete
    });

    chips.forEach((chip, index) => {
      timeline.add({
        targets: chip.element,
        translateX: dealerPosition.x,
        translateY: dealerPosition.y,
        scale: [1, 0.5, 0],
        opacity: [1, 0],
        duration: 600,
      }, index * 50);
    });

    animationRef.current = timeline;
    return timeline;
  }, [onComplete]);

  /**
   * Award chips from dealer to player (payout)
   * @param {HTMLElement} container - Container to spawn chips in
   * @param {Object} from - Dealer position
   * @param {Object} to - Player position
   * @param {number} count - Number of chips to award
   */
  const awardChips = useCallback((container, from, to, count = 5) => {
    const chips = [];

    for (let i = 0; i < count; i++) {
      const chipEl = document.createElement('div');
      chipEl.className = 'casino-chip';
      chipEl.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        border: 3px solid #fff;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        position: absolute;
        left: ${from.x}px;
        top: ${from.y}px;
      `;
      container.appendChild(chipEl);
      chips.push(chipEl);
    }

    return animateChipStack(
      chips.map(el => ({ chipElement: el, from })),
      to,
      80
    );
  }, [animateChipStack]);

  /**
   * Stop current animation
   */
  const stop = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.pause();
    }
  }, []);

  return {
    animateChip,
    animateChipStack,
    returnChip,
    collectChips,
    awardChips,
    stop
  };
};

export default useChipAnimation;
