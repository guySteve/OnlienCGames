# 🎱 Moe's Card Room - New Features Guide

## 🎉 What's New in Version 5.0

Welcome to the biggest update to Moe's Card Room! This release introduces **Multiplayer Bingo**, a **Tip System**, and an **Information Hub**.

---

## 🎱 Bingo Hall

### How to Play

1. **Create a Bingo Room**
   - From the lobby, click "🎱 Start Bingo Hall"
   - You'll be the host of a new Bingo room
   - The buying phase starts immediately (30 seconds)

2. **Buy Cards**
   - Click "Buy Card (1 chip)" to purchase a Bingo card
   - Each card costs **1 chip**
   - You can own up to **5 cards** per game
   - All purchased cards are displayed in your cards area

3. **Game Starts Automatically**
   - After 30 seconds, the buying phase ends
   - Balls are automatically drawn every **4.5 seconds**
   - A smoky-voiced caller announces each ball (e.g., "B-15")
   - Numbers are automatically marked on your cards

4. **Claim BINGO!**
   - When you complete a line (horizontal, vertical, or diagonal), select your winning card
   - Click the big pulsing **"BINGO!"** button
   - If valid, you win the entire pot!
   - If invalid, the game continues

### Bingo Card Layout

```
B   I   N   G   O
1   16  31  46  61
5   20  FREE 50 65
10  25  40  55  70
15  30  45  60  75
```

- **B** column: Numbers 1-15
- **I** column: Numbers 16-30
- **N** column: Numbers 31-45 (center is FREE)
- **G** column: Numbers 46-60
- **O** column: Numbers 61-75

### Winning Patterns

- ✅ **Horizontal**: Any complete row
- ✅ **Vertical**: Any complete column
- ✅ **Diagonal**: Corner to corner

### The Smoky Voice Caller

The game uses your browser's Text-to-Speech engine to call out balls:
- **Voice**: Female (if available)
- **Pitch**: Low/Smoky (0.7)
- **Speed**: Slow/Deliberate (0.8)

*Note: If speech doesn't work, check your browser's TTS settings or permissions.*

### Bingo Room Features

- **Big Ball Display**: Shows the current called number with animation
- **Called Numbers History**: Last 10 called numbers displayed
- **Real-time Pot**: See the pot grow as players buy cards
- **Multiple Cards**: All your cards displayed side-by-side
- **Auto-Marking**: No need to click - numbers mark automatically

---

## 🎩 Tip the House

### How to Tip Moe

1. Click the floating **ℹ️ button** in the bottom-right
2. Navigate to the **"🎩 Tip Moe"** tab
3. Enter your tip amount (minimum 1 chip)
4. Optionally add a thank-you note
5. Click **"Send Tip 💝"**

### What Happens to Tips?

- Tips are **removed from the economy** (not given to another player)
- They're logged in your transaction history as type: `TIP`
- Moe appreciates your generosity! 🎩

### Why Tip?

Show appreciation for:
- Great gameplay experience
- Server maintenance
- Future feature development
- Just because you're feeling generous!

---

## ℹ️ Information Hub

Access the Information Hub by clicking the **floating ℹ️ button** in the bottom-right corner of any screen.

### Tab Overview

#### 1. 📜 Rules Tab
Learn how to play:
- **Casino War**: Classic card showdown
- **Blackjack**: Get to 21 without busting
- **Bingo**: Complete lines to win

#### 2. 🔒 Encryption Tab
Learn about security:
- **AES-256 encryption** for room chats
- **End-to-end encrypted** messages
- Only table participants can read messages
- Moe can't see your private chats!

#### 3. 💰 Chips Tab
Chip system information:
- **Daily Refresh**: 1,000 chips at Midnight EST
- **Earning**: Win games, streaks, achievements
- **Coming Soon**: Purchase chips with real money

#### 4. 🎩 Tip Moe Tab
Send appreciation to the house:
- Quick tip form
- Optional personal note
- Instant chip deduction
- Transaction logging

---

## 🎨 UI/UX Enhancements

### New Visual Elements

1. **Floating Info Button**
   - Always accessible
   - Bottom-right corner
   - Hover animation
   - Opens Information Hub

2. **Bingo Big Ball**
   - 200px animated ball
   - Glowing effects
   - Pop animation on each draw
   - Shows current number + letter

3. **Pulsing BINGO Button**
   - Large, impossible to miss
   - Animated golden glow
   - Disabled during buying phase
   - Encourages quick claims

4. **Tabbed Info Modal**
   - 4 distinct sections
   - Active tab highlighting
   - Smooth transitions
   - Mobile responsive

### Accessibility Features

- ✅ **Voice Announcements**: Audio feedback for visually impaired
- ✅ **Large Buttons**: Easy to click, especially on mobile
- ✅ **High Contrast**: Bingo cards use clear marked/unmarked states
- ✅ **Keyboard Navigation**: Modal can be closed with Escape key
- ✅ **Responsive Design**: Works on all screen sizes

---

## 🔧 Technical Details

### API Endpoints

#### POST `/api/tip-moe`
Send a tip to the house.

**Request Body:**
```json
{
  "amount": 10,
  "note": "Thanks for the great game!"
}
```

**Response:**
```json
{
  "ok": true,
  "newBalance": 990,
  "message": "Thank you! Moe appreciates your 10 chip tip 🎩"
}
```

**Error Responses:**
- `401`: Not authenticated
- `400`: Invalid amount or insufficient chips
- `500`: Server error

### Socket.io Events

#### Bingo Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `create_bingo_room` | Client → Server | Create new Bingo room |
| `join_bingo_room` | Client → Server | Join existing room |
| `buy_bingo_card` | Client → Server | Purchase a card |
| `claim_bingo` | Client → Server | Claim BINGO win |
| `bingo_room_created` | Server → Client | Room created confirmation |
| `bingo_room_joined` | Server → Client | Join confirmation with cards |
| `bingo_card_purchased` | Server → Client | Card purchase confirmation |
| `bingo_ball_called` | Server → All | New ball announced |
| `bingo_game_started` | Server → All | Game phase changed |
| `bingo_winner` | Server → All | Winner announcement |
| `bingo_pot_updated` | Server → All | Pot value changed |

### Database Schema Changes

#### New Enum Values

```prisma
enum GameType {
  WAR
  BLACKJACK
  BINGO        // NEW
}

enum TransactionType {
  // ... existing types
  TIP          // NEW
}
```

### Logging

All API requests are now logged with format:
```
[2024-12-03T18:30:00.000Z] POST /api/tip-moe - User: user-google-id
```

---

## 🚀 Performance & Scalability

### Bingo Engine Optimizations

- **Efficient RNG**: SHA-256 hashing with minimal collisions
- **Auto-marking**: O(1) lookup for number marking
- **Win Validation**: O(1) pattern checking (only 12 patterns max)
- **Memory**: ~2KB per card, ~10KB per player (5 cards)

### Network Efficiency

- **Socket.io Rooms**: Broadcasts only to room participants
- **Minimal Payloads**: Only state changes transmitted
- **Batched Updates**: Pot updates sent once, not per card

### Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Bingo Game | ✅ | ✅ | ✅ | ✅ |
| Voice Caller | ✅ | ✅ | ⚠️ (Limited voices) | ✅ |
| Info Modal | ✅ | ✅ | ✅ | ✅ |
| Tip System | ✅ | ✅ | ✅ | ✅ |

---

## 📱 Mobile Experience

All new features are **fully responsive**:

### Bingo on Mobile
- Single-column card layout
- Larger tap targets (60px BINGO button)
- Optimized ball size (150px)
- Touch-friendly card selection

### Info Modal on Mobile
- Full-screen overlay
- Scrollable tabs
- Readable text (16px base)
- Easy-to-close button

### Floating Button on Mobile
- Smaller size (50px)
- Still easily accessible
- Doesn't block game content

---

## 🐛 Troubleshooting

### "Bingo voice not working"
- **Check browser TTS**: Go to browser settings > Accessibility > Text-to-Speech
- **Unmute tab**: Ensure browser tab is not muted
- **Permissions**: Allow audio in browser settings
- **Fallback**: Numbers still appear visually even without sound

### "Can't buy more cards"
- **Max reached**: You can only buy 5 cards per game
- **Insufficient chips**: Each card costs 1 chip
- **Wrong phase**: Cards can only be bought during BUYING phase (first 30 seconds)

### "BINGO claim rejected"
- **Select card first**: Click the card you want to claim with
- **Incomplete pattern**: Ensure you have a complete line
- **Already won**: Game may have already ended

### "Tip not going through"
- **Not logged in**: Must be authenticated to tip
- **Insufficient balance**: Check your chip balance
- **Network error**: Check your internet connection and retry

---

## 🎯 Best Practices

### Bingo Strategy

1. **Buy Multiple Cards**: More cards = better odds
2. **Watch the Board**: Pay attention to called numbers
3. **Quick Claim**: Click BINGO immediately when you have it
4. **Stay Connected**: Disconnecting forfeits your cards

### Responsible Gaming

- ✅ Set a chip budget before playing
- ✅ Take breaks between games
- ✅ Remember: It's just for fun!
- ✅ Chips reset daily - no pressure

---

## 🔮 Coming Soon

### Planned Features

1. **Bingo Tournaments**
   - Multi-game series
   - Progressive jackpots
   - Leaderboards

2. **Additional Patterns**
   - Four corners
   - Blackout (full card)
   - Letters (T, L, X, etc.)

3. **Chip Purchases**
   - Buy chips with real money
   - Secure payment integration
   - Bonus chip packs

4. **Enhanced Social**
   - Bingo room chat
   - Emoji reactions
   - Winner celebrations

5. **Statistics**
   - Win/loss records
   - Favorite patterns
   - Lucky numbers

---

## 📞 Support & Feedback

### Found a Bug?
Report it in the game chat or email support with:
- What you were doing
- What you expected to happen
- What actually happened
- Screenshots (if possible)

### Have a Suggestion?
We love feedback! Use the **Tip Moe** note field to share ideas, or contact us directly.

### Want to Contribute?
Check out the codebase:
- `src/engines/BingoEngine.ts` - Game logic
- `client.js` - Client-side functionality
- `server.js` - Server endpoints and socket handlers

---

## 🏆 Credits

**Development**: VegasCore Team
**Version**: 5.0.0
**Release Date**: December 2024

Special thanks to our beta testers and the community for making Moe's Card Room the best online card room experience!

---

## 📜 License & Legal

- Chips have no real-world value
- For entertainment purposes only
- Must be 18+ to play
- See full Terms of Service in footer

---

**Enjoy the new features, and may the cards be ever in your favor! 🎰**

*Last Updated: December 3, 2024*
