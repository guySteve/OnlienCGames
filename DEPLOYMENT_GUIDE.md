# 🚀 Deployment Guide - Bingo & Feature Update

## Pre-Deployment Checklist

### 1. Database Migration Required ⚠️

The new features require database schema updates:

```bash
# Option A: Development (with migration history)
npm run db:migrate

# Option B: Production (direct push)
npm run db:push
```

**Changes:**
- Added `BINGO` to `GameType` enum
- Added `TIP` to `TransactionType` enum

### 2. Dependencies Check

All dependencies are already included. No new packages required.

**Existing packages used:**
- ✅ `socket.io` - Real-time Bingo communication
- ✅ `@prisma/client` - Database operations
- ✅ `express` - API endpoints
- ✅ Browser APIs - Web Speech Synthesis (no install needed)

### 3. Environment Variables

No new environment variables required. Existing setup is sufficient.

### 4. Server Restart Required

After deploying, restart your server to load the new code:

```bash
# Development
npm run dev

# Production (with PM2)
pm2 restart game

# Production (with systemd)
sudo systemctl restart game
```

---

## Deployment Steps

### Step 1: Backup Database

```bash
# Create backup (PostgreSQL example)
pg_dump -U your_user -d your_database > backup_$(date +%Y%m%d).sql
```

### Step 2: Pull Changes

```bash
git pull origin main
# or
git pull origin your-branch-name
```

### Step 3: Generate Prisma Client

```bash
npm run db:generate
```

### Step 4: Apply Database Migration

```bash
# Development
npm run db:migrate

# Production
npm run db:push
```

Expected output:
```
✔ Generated Prisma Client
✔ Applied migration
✔ Updated GameType enum with BINGO
✔ Updated TransactionType enum with TIP
```

### Step 5: Restart Server

```bash
# Kill existing process
pkill -f "node server.js"

# Start server
npm start

# Or with PM2
pm2 restart game
```

### Step 6: Verify Deployment

Test each feature:

1. **Bingo**
   - [ ] Create Bingo room
   - [ ] Buy a card
   - [ ] Observe ball calling
   - [ ] Claim BINGO

2. **Tip System**
   - [ ] Open info modal
   - [ ] Navigate to Tip tab
   - [ ] Submit a tip
   - [ ] Verify balance update

3. **Info Modal**
   - [ ] Click floating info button
   - [ ] Navigate all tabs
   - [ ] Close modal

4. **Logging**
   - [ ] Check server logs for request logging
   - [ ] Format: `[timestamp] METHOD URL - User: userId`

---

## Rollback Plan

If issues occur, follow these steps:

### 1. Revert Code

```bash
git revert HEAD
# or
git checkout previous-commit-hash
```

### 2. Rollback Database (if needed)

```bash
# Restore from backup
psql -U your_user -d your_database < backup_YYYYMMDD.sql

# Or manually remove enum values
psql -U your_user -d your_database
ALTER TYPE "GameType" DROP VALUE IF EXISTS 'BINGO';
ALTER TYPE "TransactionType" DROP VALUE IF EXISTS 'TIP';
```

**Note:** PostgreSQL doesn't allow removing enum values easily. Consider:
- Using migration down files
- Or keeping the values (they won't hurt if unused)

### 3. Restart Server

```bash
npm start
```

---

## Monitoring & Verification

### Check Server Logs

```bash
# Real-time logs
tail -f /path/to/logs/game.log

# Or with PM2
pm2 logs game

# Look for:
✅ "✅ Authentication initialized"
✅ "✅ All systems ready"
✅ "✅ Server listening on port XXXX"
```

### Check Database

```sql
-- Verify enum values added
SELECT enum_range(NULL::GameType);
-- Should include: WAR, BLACKJACK, BINGO

SELECT enum_range(NULL::TransactionType);
-- Should include: ...all existing..., TIP

-- Test tip transaction
SELECT * FROM "Transaction" WHERE type = 'TIP' LIMIT 1;
```

### Check Frontend

1. Open browser console (F12)
2. Load the game
3. Look for errors
4. Test Bingo room creation
5. Test info modal

### Performance Metrics

Monitor these after deployment:

- **Response Time**: API endpoints should respond < 200ms
- **Socket Latency**: Bingo events should be < 100ms
- **Memory Usage**: Should increase ~10-20MB per Bingo room
- **CPU Usage**: Ball drawing timer should be negligible

---

## Common Deployment Issues

### Issue 1: "Cannot find module 'BingoEngine'"

**Cause:** TypeScript not compiled or path incorrect

**Fix:**
```bash
# Server.js uses dynamic require
# No compilation needed - it loads .ts directly via Node
# Ensure path is correct in server.js
```

### Issue 2: Database Migration Fails

**Cause:** Enum values already exist or conflicting migrations

**Fix:**
```bash
# Reset database (CAUTION: Development only)
npm run db:push --force-reset

# Or manually check
psql -U user -d db
\dT+ GameType
```

### Issue 3: Speech Synthesis Not Working

**Cause:** Browser compatibility or permissions

**Fix:**
- Not a deployment issue - client-side browser feature
- Fallback: Numbers display visually
- Users can enable TTS in browser settings

### Issue 4: Socket Events Not Firing

**Cause:** Client-server version mismatch

**Fix:**
```bash
# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# Or bust cache with version query param
# index.html: <script src="client.js?v=5.0"></script>
```

### Issue 5: Info Button Not Showing

**Cause:** CSS not loaded or z-index conflict

**Fix:**
```bash
# Verify styles.css includes new styles
grep "floating-info-btn" styles.css

# Check browser console for 404 errors
# Ensure styles.css is served correctly
```

---

## Load Testing

Before full production deployment, test with load:

### Test 1: Multiple Bingo Rooms

```bash
# Create 10 concurrent Bingo rooms
# Monitor: Memory, CPU, Socket connections
```

Expected:
- Memory: +10MB per room (~100MB for 10 rooms)
- CPU: <5% per room
- Sockets: 50+ connections (5 players × 10 rooms)

### Test 2: Rapid Tips

```bash
# Send 100 tips in 1 minute
# Monitor: Database connection pool, response times
```

Expected:
- Response time: <200ms per request
- No database deadlocks
- All transactions logged

### Test 3: Socket Storm

```bash
# 50 players join same Bingo room
# All buy 5 cards simultaneously
```

Expected:
- Room creation: <500ms
- Card purchase: <100ms each
- Ball broadcasting: <50ms to all clients

---

## Security Considerations

### API Endpoints

✅ **Authentication checked** on all endpoints:
- `/api/tip-moe` requires `req.user`

✅ **Input validation**:
- Amount must be number > 0
- Note length limited (100 chars)

✅ **SQL Injection prevention**:
- Prisma parameterized queries

✅ **Rate limiting recommended**:
```javascript
// Add to server.js
const rateLimit = require('express-rate-limit');

const tipLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 tips per minute
  message: 'Too many tips, please slow down'
});

app.post('/api/tip-moe', tipLimiter, express.json(), async (req, res) => {
  // ... existing code
});
```

### Socket.io Security

✅ **Room isolation**:
- Bingo events only broadcast to room members

✅ **Authentication**:
- User validation on all socket events

⚠️ **Recommended additions**:
- Socket.io JWT authentication
- Rate limiting on socket events
- Disconnect inactive sockets

---

## Monitoring Dashboard

Set up monitoring for:

### Metrics to Track

1. **Bingo Rooms**
   - Active rooms count
   - Players per room
   - Average game duration
   - Win rate distribution

2. **Tips**
   - Total tips received
   - Average tip amount
   - Tips per user
   - Top tippers

3. **Performance**
   - API response times
   - Socket event latency
   - Database query times
   - Memory per room

4. **Errors**
   - Failed BINGO claims (false positives)
   - Tip transaction failures
   - Socket disconnections

### Example Prometheus Metrics

```javascript
// Add to server.js
const prometheus = require('prom-client');

const bingoRoomsGauge = new prometheus.Gauge({
  name: 'bingo_rooms_active',
  help: 'Number of active Bingo rooms'
});

const tipsCounter = new prometheus.Counter({
  name: 'tips_total',
  help: 'Total tips received'
});

// Update on events
```

---

## Post-Deployment Tasks

### Day 1

- [ ] Monitor error logs for 24 hours
- [ ] Check database for unusual transactions
- [ ] Verify speech synthesis works on major browsers
- [ ] Test mobile responsiveness

### Week 1

- [ ] Collect user feedback
- [ ] Monitor Bingo completion rates
- [ ] Check tip usage statistics
- [ ] Review performance metrics

### Month 1

- [ ] Analyze player engagement with Bingo
- [ ] Assess tip revenue potential
- [ ] Plan additional Bingo patterns
- [ ] Consider tournament mode

---

## Documentation Updates

After successful deployment, update:

- [ ] Main README.md (add Bingo section)
- [ ] API documentation (new endpoints)
- [ ] User guide (gameplay instructions)
- [ ] Change log (version 5.0 notes)

---

## Support Contact

For deployment issues:
1. Check server logs first
2. Review this guide's troubleshooting section
3. Test with `test-bingo.js` script
4. Contact development team with error logs

---

## Success Criteria

Deployment is successful when:

✅ Server starts without errors
✅ Database migration applied
✅ Bingo rooms can be created
✅ Cards can be purchased
✅ Balls are called automatically
✅ BINGO claims validate correctly
✅ Tips deduct chips properly
✅ Info modal displays all tabs
✅ Floating button is visible
✅ No console errors in browser
✅ Mobile layout works correctly

---

**Version:** 5.0.0
**Last Updated:** December 3, 2024
**Deployment Status:** Ready for Production ✅
