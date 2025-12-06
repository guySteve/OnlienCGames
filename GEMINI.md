# GEMINI Game Rules

- Operating Hours: 10 PM - 2 AM ET Only.
- Visual Mandate: Chips must move in arcs (parabolic).
- Dealer Logic: Dealer hits Soft 17.

## Casino Standards

### Blackjack
- 6-deck shoe with 75% penetration
- Dealer hits on soft 17
- Blackjack pays 3:2
- Insurance pays 2:1
- Double down on any two cards
- Split pairs (up to 3 hands)

### War
- Standard 52-card deck
- Equal cards trigger war
- War requires additional bet equal to original
- Surrender option pays 1:2 on tie

### Let It Ride
- 5-card poker hand
- Three betting circles
- Can pull back first two bets
- Final bet must stay
- Community cards dealt progressively

## Animation Standards

### Chip Movement
- All chip animations must use parabolic arcs
- Duration: 800ms standard
- Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)
- Stacking: Slight rotation on land

### Card Dealing
- Deal speed: 200ms per card
- Flip animation: 150ms
- Slide distance: Minimum 100px
- Sound on deal and flip

### Dealer Behavior
- Idle state: Subtle breathing animation
- Thinking state: Hand gestures
- Dealing state: Focused animation
- Reaction states: Win/lose expressions

## Fair Play Requirements

### Provably Fair System
- Dual-seed shuffling (client + server)
- QRNG integration via Cloudflare drand
- SHA-256 hash verification
- Public audit trail

### Session Management
- Redis-backed state persistence
- Socket.io real-time sync
- Automatic reconnection handling
- Session timeout: 30 minutes inactive
