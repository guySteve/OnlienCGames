# ✅ SIMPLIFIED LAUNCH CHECKLIST

**Updated:** December 11, 2024 @ 6:19 PM EST  
**Status:** Core Features Only - Ready to Test

---

## What Works Now:

### 🔐 Authentication (3 Options)
- ✅ **Guest Login** - Click "PLAY AS GUEST" → Instant access
- ✅ **Create Account** - Username, email, password → Save progress
- ✅ **Sign In** - Email + password for returning players
- ✅ **Always Open** - No time restrictions (removed 10pm-2am limit)

### 🎮 Casino War Game
- ✅ **Join Room** - Create or join game rooms
- ✅ **Place Bets** - Chip betting system working
- ✅ **Animated Dealer** - 3D dealer model deals cards
- ✅ **Card Animations** - See cards flip and move
- ✅ **Win/Lose** - Payouts calculated correctly
- ✅ **Tie Bets** - Optional tie betting feature

### 💬 Live Chat
- ✅ **Global Chat** - Talk to all online players
- ✅ **Room Chat** - Chat with players at your table
- ✅ **Real-time** - Messages appear instantly
- ✅ **Auto-moderation** - Filters bad language

---

## Quick Test (After Deployment)

### 1. Test Guest Login (30 seconds)
```
1. Go to https://playwar.games
2. Click "PLAY AS GUEST"
3. Should redirect to lobby immediately
4. Should see 100 chips in balance
✅ PASS if you're in the lobby with chips
```

### 2. Test Create Account (1 minute)
```
1. Go to https://playwar.games  
2. Click "CREATE ACCOUNT"
3. Enter:
   - Username: TestPlayer
   - Email: test@test.com
   - Password: test123
4. Click "CREATE ACCOUNT"
5. Should see success message
6. Form switches to login
7. Enter same email/password
8. Click "SIGN IN"
9. Should be in lobby
✅ PASS if account created and login worked
```

### 3. Test War Game (2 minutes)
```
1. In lobby, click "Create Room" or "War"
2. Room should open with green table
3. See animated dealer at top
4. Click betting area (spots)
5. Chips should appear on table
6. Click "Start Hand" or similar
7. Dealer deals cards (animated)
8. Winner declared
9. Chips added/removed from balance
✅ PASS if you can play a full hand
```

### 4. Test Chat (30 seconds)
```
1. In game room, find chat box
2. Type a message
3. Press Enter or click Send
4. Message appears in chat
5. Open new browser tab (different player)
6. Guest login
7. Join same room
8. First player's messages should be visible
✅ PASS if messages show up
```

---

## What to Check in Logs

After deployment, check Cloud Run logs for:

### Good Signs ✅
```
✅ Server listening on port 8080
✅ Redis client initialized
✅ Database connected
✅ Socket.IO connection
✅ User created
✅ Game session started
```

### Bad Signs ❌
```
❌ Database connection failed
❌ Redis connection error
❌ EADDRINUSE (port already in use)
❌ Session error
❌ Prisma error
```

---

## If Something Doesn't Work

### Login Issues
**Problem:** Can't login or create account  
**Check:**
- Cloud Run logs: Look for "auth" errors
- Database: Verify Supabase is running
- Environment: `SESSION_SECRET` is set

### Game Not Loading
**Problem:** Can't join game or table is blank  
**Check:**
- Socket.IO connection in browser console (F12)
- Look for "socket.io" connection errors
- Redis connection status in logs

### Chat Not Working
**Problem:** Messages don't send or appear  
**Check:**
- Socket events in browser console
- Room ID matches between users
- Auto-moderation not blocking everything

### Dealer Not Animated
**Problem:** Dealer is static or not visible  
**Check:**
- Browser console for Three.js errors
- Check `public/dealer.js` loaded
- GLTF model file accessible

---

## Core Files (Don't Touch Unless Broken)

### Authentication
- `src/routes/auth.js` - Login/register endpoints
- `welcome.html` - Login form and JavaScript

### War Game
- `src/engines/WarEngine.js` - Game logic
- `src/socket/index.js` - Real-time communication
- `index.html` - Game interface

### Dealer Animation
- `public/dealer.js` - 3D dealer code
- Uses Three.js library (CDN)

### Chat
- `src/socket/index.js` - Chat handlers (lines 400-500)
- `client.js` - Chat UI functions

---

## Environment Variables (Must Be Set)

```bash
DATABASE_URL=postgresql://...          # Supabase pooled
DIRECT_URL=postgresql://...            # Supabase direct
SESSION_SECRET=random_32_chars         # For sessions
UPSTASH_REDIS_REST_URL=https://...    # Redis cache
UPSTASH_REDIS_REST_TOKEN=...          # Redis auth
NODE_ENV=production                    # Production mode
PORT=8080                              # Cloud Run default
```

---

## Success Criteria

### Minimum Viable Product (Must Work)
- [x] User can create guest account
- [x] User can create permanent account
- [x] User can login with credentials
- [x] User can join a War game
- [x] User can place bets
- [x] Dealer deals cards (animated)
- [x] User can chat with others
- [x] Casino is always open (no time restrictions)

### Nice to Have (Can Fix Later)
- [ ] Avatar customization
- [ ] Friend system
- [ ] Leaderboards
- [ ] Daily rewards
- [ ] Achievements
- [ ] Multiple game rooms
- [ ] Sound effects

---

## Rollback Plan

If deployment fails or major bugs:

```bash
# Find previous working version
gcloud container images list --repository=gcr.io/YOUR_PROJECT/moes-casino

# Deploy previous version
gcloud run deploy moes-casino \
  --image gcr.io/YOUR_PROJECT/moes-casino:PREVIOUS_SHA \
  --region us-central1

# Verify
curl https://playwar.games/health
```

---

## Contact Info

**Cloud Build:** https://console.cloud.google.com/cloud-build  
**Cloud Run:** https://console.cloud.google.com/run  
**Database:** https://supabase.com/dashboard  
**Redis:** https://console.upstash.com  

---

**🎰 Focus: Login → Play War → Chat with players → See animated dealer**

That's it! Everything else is extra.
