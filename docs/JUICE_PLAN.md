# VegasCore "Juice" Implementation Plan

## Executive Summary

"Juice" refers to the micro-interactions, animations, and audio feedback that transform functional UI into emotionally resonant experiences. This document prioritizes all juice implementations by **impact on retention**.

---

## Priority Matrix

| Priority | Feature | Impact | Effort | Status |
|----------|---------|--------|--------|--------|
| P0 | Card Deal Physics | High | Medium | 📋 Planned |
| P0 | Win/Lose Feedback | High | Low | 📋 Planned |
| P0 | Chip Stack Animations | High | Medium | 📋 Planned |
| P1 | Spatial Audio | Medium | Medium | 📋 Planned |
| P1 | Happy Hour Visuals | High | Low | 📋 Planned |
| P1 | Mystery Drop Celebration | High | Low | 📋 Planned |
| P2 | Near-Miss Effects | Medium | Low | 📋 Planned |
| P2 | Streak Counter Animation | Medium | Low | 📋 Planned |
| P2 | Syndicate Treasury Pulse | Medium | Low | 📋 Planned |
| P3 | Ambient Table Sounds | Low | Low | 📋 Planned |
| P3 | Button Micro-interactions | Low | Low | 📋 Planned |

---

## P0: Critical Juice (Week 1)

### 1. Physics-Based Card Dealing

**Implementation**: `useCardPhysics.js` hook with framer-motion

**Animation Sequence**:
```
1. Card appears at shoe (top-right, scale 0.5, rotateY 180°)
2. Arc trajectory to player seat (bezier curve)
3. Scale up during flight (0.5 → 1.0)
4. Rotation during flight (random ±5°)
5. Flip at destination (rotateY 180° → 0°)
6. Settle with slight bounce
```

**Timing**:
- Deal duration: 400ms
- Stagger between cards: 150ms
- Flip duration: 300ms

**Audio Sync**:
- `card-deal.mp3` plays at animation start
- Stereo panning matches seat position

**Code Reference**: `frontend/src/hooks/useCardPhysics.js`

---

### 2. Win/Lose Result Feedback

**Win Animation**:
```javascript
{
  scale: [1, 1.15, 1],
  filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'],
  boxShadow: ['0 0 0 rgba(255,215,0,0)', '0 0 40px rgba(255,215,0,0.8)', '0 0 0 rgba(255,215,0,0)']
}
duration: 600ms
```

**Big Win (≥1000 chips)**:
- Screen shake (subtle)
- Particle confetti burst
- Extended celebration (2s)
- Audio: fanfare with ducking

**Lose Animation**:
```javascript
{
  opacity: [1, 0.6, 1],
  scale: [1, 0.98, 1],
  filter: ['saturate(1)', 'saturate(0.5)', 'saturate(1)']
}
duration: 400ms
```

**Near-Miss Animation**:
```javascript
{
  scale: [1, 1.05, 1, 1.03, 1],
  boxShadow: ['0 0 0 rgba(255,100,100,0)', '0 0 30px rgba(255,100,100,0.6)', '0 0 0 rgba(255,100,100,0)']
}
duration: 700ms
```
*Psychology*: Amplifies loss aversion, increases perceived "almost won" feeling

---

### 3. Chip Stack Animations

**Betting**:
```
1. Chips rise from player chip tray
2. Arc to pot (center table)
3. Stack with slight offset
4. Satisfying "click" sound
```

**Winning**:
```
1. Pot chips explode outward slightly
2. Stream toward winner seat
3. Stack in chip tray with cascade
4. Increasing pitch sounds (more chips = longer sequence)
```

**Implementation**:
```javascript
// Chip count visualization
const chipCount = Math.min(Math.ceil(amount / 100), 10);
const colors = ['red', 'blue', 'black', 'green', 'purple'];
```

---

## P1: High-Impact Juice (Week 2)

### 4. Spatial Audio System

**Implementation**: `useSpatialAudio.js` hook with Howler.js

**Stereo Panning by Seat**:
```javascript
const SEAT_POSITIONS = {
  0: -0.8,  // Far left
  1: -0.4,  // Left
  2: 0,     // Center
  3: 0.4,   // Right
  4: 0.8    // Far right
};
```

**Sound Categories**:

| Category | Files | Usage |
|----------|-------|-------|
| Cards | deal-1/2/3.mp3, flip.mp3, shuffle.mp3 | Game actions |
| Chips | stack.mp3, single.mp3, win.mp3 | Economy |
| UI | click.mp3, notification.mp3 | Interface |
| Events | mystery-drop.mp3, level-up.mp3, happy-hour.mp3 | Celebrations |
| Ambient | casino-ambient.mp3 (loop) | Immersion |

**Variant Selection**: Random selection from sound variants for natural feel

**Code Reference**: `frontend/src/hooks/useSpatialAudio.js`

---

### 5. Happy Hour Visual System

**Banner Animation**:
```javascript
// Gradient animation
animate: {
  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
}
transition: { duration: 3, repeat: Infinity }

// Icon pulse
animate: { scale: [1, 1.2, 1] }
transition: { duration: 1, repeat: Infinity }
```

**Countdown Timer**:
- Large, readable font (2xl)
- Warning state at 5 minutes (color change to red)
- Pulse animation in final minute

**Progress Bar**:
- Linear decrease synced to end time
- Gradient matches bonus type color

**Bonus Type Themes**:
| Type | Color Gradient | Icon |
|------|---------------|------|
| XP_BOOST | purple → pink | ⚡ |
| CHIP_BOOST | yellow → orange | 💰 |
| MYSTERY_BOOST | emerald → teal | 🎁 |
| STREAK_PROTECT | blue → cyan | 🛡️ |

**Code Reference**: `frontend/src/components/HappyHourBanner.jsx`

---

### 6. Mystery Drop Celebration

**Trigger Animation**:
```javascript
// Screen flash
{
  backgroundColor: ['transparent', 'rgba(255,215,0,0.3)', 'transparent']
}
duration: 300ms

// Chest/gift icon
{
  scale: [0, 1.5, 1],
  rotate: [0, -10, 10, 0]
}
duration: 800ms
```

**Tier-Specific Effects**:
| Tier | Visual | Audio |
|------|--------|-------|
| COMMON | Sparkle | Short chime |
| UNCOMMON | Glow ring | Medium fanfare |
| RARE | Particle burst | Extended fanfare |
| EPIC | Screen shake + confetti | Epic reveal |
| LEGENDARY | Full celebration (3s) | Jackpot sound |

**Amount Counter Animation**:
```javascript
// Counting up effect
animate: {
  textContent: [0, finalAmount] // Interpolated
}
duration: 1500ms
```

---

## P2: Enhancement Juice (Week 3)

### 7. Near-Miss Effects

**Visual Feedback**:
- Card border glow (red)
- Brief pause on comparison
- "So close!" toast message
- Consolation animation

**Blackjack Bust at 22**:
```javascript
{
  filter: ['hue-rotate(0deg)', 'hue-rotate(30deg)', 'hue-rotate(0deg)'],
  scale: [1, 1.02, 1]
}
```

**War Loss by 1 Rank**:
```javascript
// Highlight difference
{
  boxShadow: '0 0 20px rgba(255,0,0,0.5)'
}
```

---

### 8. Streak Counter Animation

**Increment Animation**:
```javascript
{
  scale: [1, 1.3, 1],
  color: ['#fff', '#ffd700', '#fff']
}
duration: 500ms
```

**Milestone Animations** (Day 7, 14, 30):
- Confetti burst
- Number grows larger
- Special badge reveal
- Achievement popup

**Danger State** (< 6h remaining):
```javascript
animate: {
  opacity: [1, 0.5, 1],
  color: ['#ef4444', '#fff', '#ef4444']
}
transition: { duration: 1, repeat: Infinity }
```

---

### 9. Syndicate Treasury Pulse

**Contribution Animation**:
```javascript
// Treasury balance
{
  scale: [1, 1.1, 1],
  textShadow: ['0 0 0 transparent', '0 0 20px gold', '0 0 0 transparent']
}
duration: 800ms
```

**Flying Numbers**:
- "+$X" floats up from contributor
- Follows arc to treasury
- Fades on arrival

**Weekly Dividend Celebration**:
- Treasury "explodes" outward
- Chips fly to all eligible members
- Member avatars flash

---

## P3: Polish Juice (Week 4)

### 10. Ambient Table Sounds

**Layers**:
1. Base ambient (casino floor, low volume)
2. Table-specific (cards, murmur)
3. Player action sounds (overrides ambient)

**Volume Ducking**:
- Auto-lower ambient during important events
- Fade back after 2 seconds

---

### 11. Button Micro-interactions

**Hover**:
```javascript
whileHover: { scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }
```

**Tap/Click**:
```javascript
whileTap: { scale: 0.98 }
// + haptic feedback on mobile (if available)
```

**Disabled State**:
- Reduced opacity
- No hover effects
- Cursor: not-allowed

---

## Mobile-Specific Juice

### Touch Target Sizing

**Minimum Sizes**:
- Betting buttons: 48x48px
- Card touch areas: 60x80px
- Seat selection: 56x56px

### Safe Area Compliance

```css
/* iPhone notch handling */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

### Haptic Feedback (iOS/Android)

```javascript
// Use Vibration API where available
if (navigator.vibrate) {
  navigator.vibrate(10); // Light tap
  navigator.vibrate([50, 30, 50]); // Win pattern
}
```

---

## Performance Considerations

### Animation Budget

- Max 60fps target
- Use `transform` and `opacity` only (GPU accelerated)
- Disable animations on `prefers-reduced-motion`
- Lazy load Howler.js sounds

### Memory Management

- Unload sounds when leaving table
- Limit particle count (max 50)
- Recycle animation instances

### Bundle Optimization

```javascript
// Lazy load animation hooks
const useCardPhysics = lazy(() => import('./hooks/useCardPhysics'));
const useSpatialAudio = lazy(() => import('./hooks/useSpatialAudio'));
```

---

## Implementation Checklist

### Week 1 (P0)
- [ ] Implement `useCardPhysics` hook
- [ ] Add card deal animations to GameTable
- [ ] Create win/lose feedback system
- [ ] Build chip stack animations

### Week 2 (P1)
- [ ] Integrate Howler.js with `useSpatialAudio`
- [ ] Add Happy Hour banner animations
- [ ] Create Mystery Drop celebration modal

### Week 3 (P2)
- [ ] Implement near-miss detection + effects
- [ ] Add streak counter animations
- [ ] Build syndicate treasury pulse

### Week 4 (P3)
- [ ] Add ambient audio layer
- [ ] Polish all button interactions
- [ ] Mobile haptic feedback
- [ ] Performance optimization pass

---

## Audio Asset Requirements

**Required Sound Files** (to be created/sourced):

```
/public/audio/
├── card-deal-1.mp3
├── card-deal-2.mp3
├── card-deal-3.mp3
├── card-flip.mp3
├── shuffle.mp3
├── chip-stack-1.mp3
├── chip-stack-2.mp3
├── chip-single.mp3
├── chips-win.mp3
├── chips-lose.mp3
├── click.mp3
├── notification.mp3
├── mystery-drop.mp3
├── level-up.mp3
├── win.mp3
├── lose.mp3
├── big-win.mp3
├── near-miss.mp3
├── bingo-ball.mp3
├── bingo-win.mp3
├── dab.mp3
├── happy-hour-start.mp3
├── happy-hour-end.mp3
└── casino-ambient.mp3
```

**Licensing**: All audio should be royalty-free or custom-created.

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Session Duration | 8 min | 15 min | Increased engagement |
| Actions/Session | 12 | 25 | More plays |
| Audio Opt-in | N/A | 60% | Users enabling sound |
| Return Rate | 22% | 35% | D1 retention |
