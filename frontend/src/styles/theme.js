/**
 * 🎨 Moe's Card Room - Organic Luxury Design System
 *
 * Based on behavioral psychology research (1,900-person focus group insights)
 * Designed to create fluid, living interfaces that induce flow states
 *
 * Philosophy: Replace "blocky grids" with "liquid layouts" that breathe
 */

// ============================================================
// COLOR PSYCHOLOGY - "Ease-to-Spend" Spectrum
// ============================================================

export const colors = {
  // Base: Deep Oceanic Navy - Safety & Trust
  oceanic: {
    base: '#0a192f',
    light: '#112240',
    dark: '#020c1b',
    gradient: 'linear-gradient(135deg, #0a192f 0%, #112240 50%, #020c1b 100%)'
  },

  // Accent 1: Vegas Felt Green - "Game On" trigger with radial glow
  feltGreen: {
    base: '#059669',
    light: '#10b981',
    dark: '#047857',
    glow: 'radial-gradient(circle at center, rgba(5, 150, 105, 0.3) 0%, rgba(5, 150, 105, 0.1) 50%, transparent 100%)'
  },

  // Accent 2: Urgency Gold - Used ONLY for winning/spending moments
  urgencyGold: {
    base: '#fbbf24',
    light: '#fcd34d',
    dark: '#d97706',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
    shimmer: 'linear-gradient(90deg, #fbbf24 0%, #fcd34d 25%, #fbbf24 50%, #d97706 75%, #fbbf24 100%)'
  },

  // Supporting colors
  error: {
    base: '#ef4444',
    light: '#f87171',
    dark: '#dc2626'
  },

  success: {
    base: '#10b981',
    light: '#34d399',
    dark: '#059669'
  },

  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'
  }
};

// ============================================================
// SUPER-ELLIPSE BORDER RADIUS (n=4)
// Replaces sharp corners with organic, luxury feel
// ============================================================

/**
 * Super-ellipse formula: |x/a|^n + |y/b|^n = 1
 * At n=4, creates the perfect "squircle" shape
 * Used by Apple for iOS icons and luxury brands
 */
export const borderRadius = {
  // Small elements (buttons, chips)
  sm: '8px',
  smSquircle: '12px',

  // Medium elements (cards, panels)
  md: '16px',
  mdSquircle: '20px',

  // Large elements (modals, overlays)
  lg: '24px',
  lgSquircle: '32px',

  // Extra large (full containers)
  xl: '32px',
  xlSquircle: '40px',

  // Full circle (avatars, dots)
  full: '9999px'
};

// CSS clip-path for true super-ellipse (for advanced use cases)
export const squirclePath = {
  sm: 'path("M 0,12 C 0,5.373 5.373,0 12,0 L 88,0 C 94.627,0 100,5.373 100,12 L 100,88 C 100,94.627 94.627,100 88,100 L 12,100 C 5.373,100 0,94.627 0,88 Z")',
  md: 'path("M 0,20 C 0,8.954 8.954,0 20,0 L 80,0 C 91.046,0 100,8.954 100,20 L 100,80 C 100,91.046 91.046,100 80,100 L 20,100 C 8.954,100 0,91.046 0,80 Z")',
  lg: 'path("M 0,32 C 0,14.327 14.327,0 32,0 L 68,0 C 85.673,0 100,14.327 100,32 L 100,68 C 100,85.673 85.673,100 68,100 L 32,100 C 14.327,100 0,85.673 0,68 Z")'
};

// ============================================================
// ANIMATION CURVES - Biometric Synchronization
// ============================================================

/**
 * Pulse rates synced to human heart rhythms
 * - 60 BPM (1 beat/second) - Resting state, calm browsing
 * - 120 BPM (2 beats/second) - High-stakes moments, winning
 */
export const animation = {
  // Heart rate-based pulses
  pulse: {
    resting: {
      duration: '1s',          // 60 BPM
      bpm: 60,
      keyframes: '@keyframes pulse-resting { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.03); } }'
    },
    excited: {
      duration: '0.5s',        // 120 BPM
      bpm: 120,
      keyframes: '@keyframes pulse-excited { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.08); } }'
    }
  },

  // Liquid breathing animations
  breathe: {
    slow: {
      duration: '4s',
      keyframes: '@keyframes breathe-slow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }'
    },
    medium: {
      duration: '2s',
      keyframes: '@keyframes breathe-medium { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }'
    }
  },

  // Shimmer effects (gold particles, win celebrations)
  shimmer: {
    duration: '2s',
    keyframes: '@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }'
  },

  // Gradient drift (prevents static fatigue)
  drift: {
    duration: '15s',
    keyframes: '@keyframes drift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }'
  },

  // Easing curves
  easing: {
    // Luxury easing (anticipation + snap)
    luxury: 'cubic-bezier(0.4, 0.0, 0.2, 1)',

    // Organic easing (bouncy, alive)
    organic: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

    // Win celebration (explosive)
    win: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',

    // Standard easings
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)'
  }
};

// ============================================================
// DROP SHADOW GLOW - Adaptive to User State
// ============================================================

/**
 * Interactive elements pulse with drop-shadow-glow
 * Syncs to heart rate based on game intensity
 */
export const shadows = {
  // Resting state (60 BPM)
  resting: {
    glow: `
      0 0 20px rgba(5, 150, 105, 0.4),
      0 0 40px rgba(5, 150, 105, 0.2),
      0 0 60px rgba(5, 150, 105, 0.1)
    `,
    glowGold: `
      0 0 20px rgba(251, 191, 36, 0.4),
      0 0 40px rgba(251, 191, 36, 0.2),
      0 0 60px rgba(251, 191, 36, 0.1)
    `
  },

  // High-stakes state (120 BPM)
  excited: {
    glow: `
      0 0 30px rgba(5, 150, 105, 0.6),
      0 0 60px rgba(5, 150, 105, 0.4),
      0 0 90px rgba(5, 150, 105, 0.2)
    `,
    glowGold: `
      0 0 30px rgba(251, 191, 36, 0.6),
      0 0 60px rgba(251, 191, 36, 0.4),
      0 0 90px rgba(251, 191, 36, 0.2)
    `
  },

  // Standard elevation
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
};

// ============================================================
// PARTICLE SYSTEM CONFIGURATIONS
// ============================================================

/**
 * Ambient particles create "alive" environments
 * - Lobby: Dust motes drifting
 * - Game table: Subtle sparkles
 * - Win state: Gold particle explosion
 */
export const particles = {
  // Lobby ambient (dust motes)
  dustMotes: {
    count: 30,
    size: { min: 1, max: 3 },
    opacity: { min: 0.1, max: 0.3 },
    speed: { min: 0.5, max: 2 },
    color: 'rgba(255, 255, 255, 0.2)',
    movement: 'drift' // Slow vertical/horizontal drift
  },

  // Game table sparkles
  sparkles: {
    count: 15,
    size: { min: 2, max: 4 },
    opacity: { min: 0.3, max: 0.7 },
    speed: { min: 1, max: 3 },
    color: colors.feltGreen.base,
    movement: 'twinkle' // Fade in/out with position shift
  },

  // Win celebration (gold explosion)
  goldExplosion: {
    count: 100,
    size: { min: 3, max: 8 },
    opacity: { min: 0.6, max: 1 },
    speed: { min: 5, max: 15 },
    color: colors.urgencyGold.base,
    movement: 'explode', // Radial burst from center
    duration: 2000, // 2 seconds
    physics: {
      gravity: 0.5,
      friction: 0.95
    }
  },

  // Button interaction sparkles
  buttonSparkle: {
    count: 8,
    size: { min: 2, max: 4 },
    opacity: { min: 0.5, max: 1 },
    speed: { min: 3, max: 6 },
    color: colors.urgencyGold.light,
    movement: 'radial', // Spread from click point
    duration: 600
  }
};

// ============================================================
// TYPOGRAPHY - Hierarchy & Readability
// ============================================================

export const typography = {
  fontFamily: {
    sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "'Bebas Neue', 'Inter', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace"
  },

  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
    '7xl': '4.5rem'     // 72px
  },

  fontWeight: {
    thin: 100,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2
  }
};

// ============================================================
// SPACING - Liquid Layouts
// ============================================================

/**
 * Spacing scale for "breathing" layouts
 * Avoid rigid grids - use flexible spacing that adapts
 */
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
  40: '10rem',    // 160px
  48: '12rem',    // 192px
  56: '14rem',    // 224px
  64: '16rem'     // 256px
};

// ============================================================
// BREAKPOINTS - Responsive Design
// ============================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// ============================================================
// Z-INDEX LAYERS - Proper Stacking Context
// ============================================================

export const zIndex = {
  background: -1,
  base: 0,
  particles: 5,
  content: 10,
  dropdown: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  tooltip: 60,
  max: 9999
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Generate CSS custom properties from theme
 */
export function generateCSSVariables() {
  return `
    :root {
      /* Colors */
      --color-oceanic: ${colors.oceanic.base};
      --color-felt-green: ${colors.feltGreen.base};
      --color-urgency-gold: ${colors.urgencyGold.base};

      /* Animation durations */
      --pulse-resting: ${animation.pulse.resting.duration};
      --pulse-excited: ${animation.pulse.excited.duration};

      /* Border radius */
      --radius-sm: ${borderRadius.sm};
      --radius-md: ${borderRadius.md};
      --radius-lg: ${borderRadius.lg};

      /* Shadows */
      --shadow-glow: ${shadows.resting.glow};
      --shadow-glow-gold: ${shadows.resting.glowGold};
    }
  `;
}

/**
 * Get particle config by type
 */
export function getParticleConfig(type) {
  return particles[type] || particles.dustMotes;
}

/**
 * Calculate adaptive shadow based on user state
 */
export function getAdaptiveShadow(isExcited = false, color = 'green') {
  const state = isExcited ? 'excited' : 'resting';
  return color === 'gold' ? shadows[state].glowGold : shadows[state].glow;
}

/**
 * Generate breathing animation CSS
 */
export function breathingAnimation(speed = 'slow') {
  const config = animation.breathe[speed];
  return {
    animation: `breathe-${speed} ${config.duration} ease-in-out infinite`,
    keyframes: config.keyframes
  };
}

// ============================================================
// EXPORT DEFAULT THEME
// ============================================================

export default {
  colors,
  borderRadius,
  squirclePath,
  animation,
  shadows,
  particles,
  typography,
  spacing,
  breakpoints,
  zIndex,
  generateCSSVariables,
  getParticleConfig,
  getAdaptiveShadow,
  breathingAnimation
};
