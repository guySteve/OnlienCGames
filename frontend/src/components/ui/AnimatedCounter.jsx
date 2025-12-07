// @/components/ui/AnimatedCounter.jsx
import React, { useEffect } from 'react';
import { motion, useSpring } from 'framer-motion';

/**
 * A component that animates a number "ticking" up or down to a new value.
 * @param {{ value: number }} props
 */
export function AnimatedCounter({ value }) {
  // We use a motion value and a spring to smoothly animate the number.
  // `useSpring` is great for this as it provides a natural, physics-based animation.
  const spring = useSpring(value, {
    mass: 0.8,
    stiffness: 100,
    damping: 15,
  });

  // When the target `value` prop changes, update the spring's target value.
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  // We'll also use a transform to round the number and format it with commas.
  // This runs on every frame of the animation.
  const display = React.useRef(null);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
        if (display.current) {
          display.current.textContent = Math.round(latest).toLocaleString('en-US');
        }
    });
    return unsubscribe;
  }, [spring]);

  return <span ref={display}>{value.toLocaleString('en-US')}</span>;
}
