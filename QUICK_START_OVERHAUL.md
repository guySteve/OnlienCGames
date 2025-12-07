# VegasCore Overhaul - Quick Start Guide

## 🚀 What Changed?

This overhaul fixed 10 critical issues across 4 phases. Here's what you need to know:

---

## Phase I: Security & Time

### 1. Biometric Login Now Works When Casino Closed ✅
**What it does**: Admins can biometric-login even during closed hours (2 AM - 10 PM ET)

**Test it**:
```bash
# Set casino to closed hours
# Go to site → Biometric login button should appear
```

### 2. Admin Dashboard Shows ALL Users ✅
**What it does**: Admin panel now shows past and present users with online status

**Test it**:
```bash
curl -H "Cookie: YOUR_SESSION" http://localhost:3000/api/admin/users
```

**Look for**: Green dot = online, Gray dot = offline

### 3. Countdown Timer Fixed ✅
**What it does**: Casino closed countdown now accurate across all timezones

**Test it**: Open site from different timezones → All should show same time

---

## Phase II: User Experience

### 4. Info Modals Don't Overflow ✅
**What it does**: Game rules/help modals now scroll properly on mobile

**Test it**: Open rules on phone → Scroll to bottom → No clipping

### 5. Dealer Has Personality ✅
**What it does**: Click dealer to hear voice lines and see speech bubbles

**Test it**: 
```javascript
// During a game, click the dealer avatar
// Expected: Speech bubble appears + voice plays
```

### 6. New Betting Controls ✅
**What it does**: Rapid bet adjustment with ÷2, -5, +5, ×2 buttons

**Test it**:
```javascript
// Enable in your game component:
<BettingControls armedCursorMode={true} onCursorValueChange={setBet} />
```

---

## Phase III: Game Engines

### 7. NEW: War Zone Table ✅
**What it does**: Community War table with 25 spots (5 zones × 5 spots)

**Use it**:
```javascript
import WarTableZones from './components/WarTableZones';

// Replace old WarTable with:
<WarTableZones socket={socket} roomId={roomId} user={user} onExit={onExit} />
```

**Features**:
- No seat ownership
- Tap any empty spot to bet
- Visual player identification (neon colors)
- Armed cursor integration

### 8. Blackjack Walk-On ✅
**What it does**: Auto-seating when placing bet (no explicit "sit" needed)

**Already working** - no changes needed

---

## Phase IV: Game Activation

### 9. Global Bingo Hall ✅
**What it does**: Single global Bingo game for all players

**How it works**:
- Server auto-starts Bingo on launch
- All users join same room
- Late joiners can spectate current game

**Socket event changed**:
```javascript
// OLD:
socket.emit('create_bingo_room');

// NEW:
socket.emit('join_bingo_hall');
```

### 10. Let It Ride Active ✅
**What it does**: Let It Ride visible in lobby

**Already working** - verify in GameLobbyView

---

## 🛠️ Quick Integration Guide

### Using Armed Cursor (War/Blackjack)

```jsx
const [betCursorValue, setBetCursorValue] = useState(10);

<BettingControls
  armedCursorMode={true}
  onCursorValueChange={setBetCursorValue}
  // ... other props
/>

// In your betting spot click handler:
const handleSpotClick = (spotIndex) => {
  socket.emit('place_bet', { spotIndex, amount: betCursorValue });
};
```

### Using War Zones

```jsx
import WarTableZones from './components/WarTableZones';

function GameView({ gameType }) {
  if (gameType === 'WAR') {
    return <WarTableZones socket={socket} roomId={roomId} user={user} onExit={handleExit} />;
  }
  // ... other games
}
```

### Joining Global Bingo

```jsx
useEffect(() => {
  if (gameType === 'BINGO') {
    socket.emit('join_bingo_hall');
    
    socket.on('bingo_joined', (data) => {
      console.log('Joined Bingo Hall!', data.gameState);
    });
  }
}, [gameType]);
```

---

## 🧪 Testing Checklist

Run these tests after deployment:

```bash
# Phase I
□ Biometric login works during closed hours
□ Admin panel shows all users (not just online)
□ Countdown synced across timezones

# Phase II
□ Info modals scroll on mobile (no overflow)
□ Dealer click triggers speech bubble
□ Armed cursor buttons adjust bet value

# Phase III
□ War zones render with 25 spots
□ Multiple bets can be placed on different spots
□ Blackjack allows instant betting (no sit button)

# Phase IV
□ Server logs show "Global Bingo Hall is now running"
□ Multiple users see same Bingo game
□ Let It Ride appears in lobby
```

---

## 🐛 Troubleshooting

### Biometric Login Not Showing
**Check**: Middleware whitelist in `server.js` includes `/auth/*`
```javascript
const allowedPaths = ['/auth', '/me', '/api/casino-status', ...];
```

### Admin Dashboard Missing Users
**Check**: Socket.IO is running and users are connecting
```javascript
// server.js should have:
const onlineUserIds = new Set();
for (const [socketId, socket] of io.sockets.sockets) {
  onlineUserIds.add(socket.user?.id);
}
```

### Countdown Wrong Time
**Check**: API returns `msUntilOpen`
```bash
curl http://localhost:3000/api/casino-status
# Should return: { isOpen: false, msUntilOpen: 28800000, ... }
```

### War Zones Not Loading
**Check**: Import path
```javascript
import WarTableZones from './components/WarTableZones'; // Not WarTable
```

### Bingo Not Starting
**Check**: Server logs on startup
```bash
# Should see:
# 🎱 Initializing Global Bingo Hall...
# ✅ Global Bingo Hall is now running!
```

### Let It Ride Missing
**Check**: GameLobbyView includes game
```javascript
const allGames = [
  ...,
  { id: '4', name: 'Let It Ride', type: 'LET_IT_RIDE', ... }
];
```

---

## 📁 File Locations

**Backend**:
- `server.js` - Main server, all Phase I/IV changes

**Frontend**:
- `frontend/src/App.jsx` - Countdown prop passing
- `frontend/src/components/CasinoClosedView.jsx` - Countdown logic
- `frontend/src/components/DealerAvatar.jsx` - Dealer personality
- `frontend/src/components/BettingControls.jsx` - Armed cursor
- `frontend/src/components/WarTableZones.jsx` - NEW zone-based War
- `frontend/src/components/common/GameInstructions.jsx` - Modal fixes
- `frontend/src/views/GameLobbyView.jsx` - Let It Ride config

**Styles**:
- `styles.css` - Modal safe-zone CSS
- `frontend/src/components/DealerAvatar.css` - Speech bubble styles

---

## 🎯 Key API Endpoints

```bash
# Casino status (with countdown delta)
GET /api/casino-status
Response: { isOpen: boolean, msUntilOpen: number, nextOpenTime: string }

# Admin users (with online status)
GET /api/admin/users?page=1&limit=50
Response: { users: [...], pagination: {...} }
```

---

## 🔥 Hot Tips

1. **Armed Cursor**: Set `armedCursorMode={true}` on any game that uses BettingControls
2. **War Zones**: Each zone gets ONE card, all spots in that zone share the same card
3. **Bingo Hall**: Only ONE global instance - don't create multiple rooms
4. **Dealer Voice**: Works best in Chrome/Edge, limited on iOS Safari
5. **Countdown**: Re-syncs every 60s automatically - no manual refresh needed

---

## 📞 Need Help?

Check the full documentation:
- `VEGASCORE_COMPLETE_OVERHAUL_SUMMARY.md` - Detailed technical specs
- `VEGASCORE_OVERHAUL_PHASE_I_II_COMPLETE.md` - Phase I/II details

---

**Last Updated**: December 7, 2024  
**Version**: 1.0  
**Status**: Production Ready ✅
