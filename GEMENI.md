GEMINI.md - Project Bible: Moe's Casino
1. Project Identity & Vision
Moe's Casino is a high-fidelity, mobile-first web application that replicates the tactile feel of a physical casino.

Core Philosophy: "The screen is the table." The UI must feel physical, not like a website.

Visual Style: Dark, luxurious, immersive. Deep greens (#014421), slate grays (#0f172a), and gold accents (#fbbf24).

Target Experience: Native app feel in a mobile browser. Zero scrolling during gameplay.

2. Tech Stack & Architecture
Frontend: React 18+ (Vite), Tailwind CSS, Framer Motion (UI), Anime.js (Physics/Game Objects), Howler.js (Sound).

Backend: Node.js, Socket.io (Real-time bi-directional), Redis (Game State/PubSub), PostgreSQL (Prisma ORM).

Infrastructure: Docker, Google Cloud Run.

3. Mobile-First & "Locked Screen" Mandates
Crucial: The user must never accidentally scroll, refresh, or zoom while dragging chips.

3.1 Viewport & Meta Rules
Always ensure index.html contains these exact meta tags:

HTML

<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="touch-action" content="none" />
3.2 Global CSS Enforcements
All new CSS must adhere to these rules to prevent "rubber-banding" or scrolling:

CSS

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden; /* Locks the screen */
  overscroll-behavior: none; /* Prevents pull-to-refresh */
  touch-action: none; /* Disables browser gestures on game area */
  user-select: none; /* Prevents text highlighting */
  -webkit-user-select: none;
  -webkit-touch-callout: none; /* Prevents long-press context menus */
}
3.3 Safe Area Handling
All HUD elements (headers, footers, betting controls) must respect device notches.

Use Tailwind utilities: pt-safe, pb-safe, pl-safe, pr-safe (mapped to env(safe-area-inset-*)).

4. Graphics & Animation Guidelines ("The Juice")
Do not simply "show" data. Animate it.

4.1 Animation Libraries
UI/Menus: Use Framer Motion (<AnimatePresence>).

Standard: Slide up from bottom for controls, fade in for modals.

Game Objects (Cards/Chips): Use Anime.js or React Spring.

Requirement: Objects must move from source (shoe/stack) to destination (table) with easing (e.g., spring or cubic-bezier).

4.2 "Juice" Checklist
When implementing any game action, check these off:

Visual Effect: The object moves/scales. (e.g., Chips stack physically).

Sound Effect: Play a specific sound (e.g., chip_place.mp3, card_slide.mp3).

Haptic Feedback: If available, trigger navigator.vibrate().

Particle Effect: On big wins or crits, spawn particles (confetti, sparks).

5. Game Rules & Logic ("Hard Rock Standard")
All game engines must strictly follow standard Vegas rules. Do not simplify logic for code convenience.

5.1 Blackjack Rules (Engine: BlackjackEngine.js)
Decks: 6-Deck Shoe, shuffled via Provably Fair RNG.

Dealer: Stands on Soft 17.

Payouts: Blackjack pays 3:2. Insurance pays 2:1.

Player Options:

Double Down: Allowed on any two cards.

Split: Allowed on pairs. Max 3 splits (4 hands total). Aces receive only 1 card after split.

Surrender: Late surrender allowed (if dealer doesn't have Blackjack).

Penetration: Shuffle at 75% shoe depth.

5.2 Betting Logic
Chip Denominations: 1, 5, 25, 100, 500, 1000.

Validation: Server MUST verify balance before accepting place_bet socket event.

Concurrency: Handle race conditions (e.g., user bets twice rapidly) using Redis locks or atomic DB transactions.

5.3 Provably Fair
Every hand/round must generate a serverSeed (hashed) and accept a clientSeed.

After the round, the unhashed serverSeed must be revealed to the client for verification.

6. Coding Standards
6.1 React/Frontend
Components: Functional components only. Use hooks for logic (useGameSocket, useSound).

State: Use useReducer for complex game state (don't use 20 useState hooks).

Typing: Use JSDoc or TypeScript interfaces for all Game State objects.

6.2 Backend/Socket
Events: Use snake_case for event names (e.g., player_action, round_ended).

Validation: All inputs from client are untrusted. Validate seatIndex, amount, and action server-side.

Recovery: If a user reconnects, send GAME_STATE_SYNC immediately to restore their screen.

7. Asset Management
Images: stored in /public/assets. Use SVG for UI icons, PNG/WebP for textures (felt, cards).

Sounds: stored in /public/sounds. Preload critical sounds (chips, cards) in App.jsx.
