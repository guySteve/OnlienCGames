# VegasCore Migration Checklist

## Pre-Migration (Setup)

### Infrastructure
- [ ] Install PostgreSQL (local: Docker, production: managed service)
- [ ] Install Redis (local: Docker, production: managed service)
- [ ] Create `.env` file from `.env.example`
- [ ] Set `DATABASE_URL` in `.env`
- [ ] Set `REDIS_URL` in `.env`
- [ ] Set `SESSION_SECRET` to random 32-char string
- [ ] Configure Google OAuth credentials (if using)

### Dependencies
```bash
npm install --save typescript @types/node @types/express ts-node
npm install --save @prisma/client ioredis
npm install --save-dev prisma @types/ioredis tsx nodemon
```

- [ ] Run `npm install` with above dependencies
- [ ] Copy `package.vegascore.json` contents to `package.json`
- [ ] Verify TypeScript installed: `npx tsc --version`
- [ ] Verify Prisma installed: `npx prisma --version`

### Database Initialization
```bash
npx prisma generate
npx prisma migrate dev --name init
```

- [ ] Run `npx prisma generate` (creates Prisma Client)
- [ ] Run `npx prisma migrate dev --name init` (creates tables)
- [ ] Verify tables created: `npx prisma studio` (opens GUI)
- [ ] Test Redis connection: `redis-cli ping` (should return PONG)

---

## Week 1: Core Infrastructure

### TypeScript Setup
- [ ] Create `src/` directory structure
- [ ] Move `tsconfig.json` to project root
- [ ] Create `src/server.ts` (empty skeleton)
- [ ] Test compilation: `npx tsc` (should compile without errors)
- [ ] Test watch mode: `npm run dev` (using tsx)

### Service Layer
- [ ] Review `src/services/EngagementService.ts`
- [ ] Test streak calculation logic (write unit test)
- [ ] Test mystery drop probability (0.5% = 1 in 200)
- [ ] Verify XP level formula: `Level^2 × 100`

### Database Testing
```typescript
// test/db.test.ts
const user = await prisma.user.create({
  data: {
    displayName: 'TestUser',
    chipBalance: 1000,
    currentStreak: 0
  }
});
```

- [ ] Create test user
- [ ] Create test transaction
- [ ] Verify transaction ledger works (balanceBefore/After)
- [ ] Test unique constraints (googleId, email)

---

## Week 2: Backend Migration

### Game Engine Abstraction
- [ ] Create `src/engines/GameEngine.ts` base class
- [ ] Implement player management methods
- [ ] Implement chip tracking (deduct/award)
- [ ] Test Redis state saving: `saveStateToRedis()`
- [ ] Test PostgreSQL persistence: `persistChipChanges()`

### War Engine Refactor
```typescript
// Extract from server.js
class WarEngine extends GameEngine {
  // Migrate existing War logic here
}
```

- [ ] Create `src/engines/WarEngine.ts`
- [ ] Move card dealing logic from `server.js`
- [ ] Move war resolution logic
- [ ] Integrate with `GameEngine` base class
- [ ] Test with mock players

### Blackjack Engine
- [ ] Review `src/engines/BlackjackEngine.ts`
- [ ] Test 6-deck shoe initialization
- [ ] Test hand evaluation (soft/hard totals)
- [ ] Test dealer logic (stand on 17)
- [ ] Test split/double/insurance actions
- [ ] Verify blackjack payout (3:2)

---

## Week 3: API Layer

### Route Setup
- [ ] Create `src/api/routes.ts`
- [ ] Implement authentication middleware
- [ ] Test all endpoints with Postman/Insomnia:

#### User Endpoints
- [ ] `GET /api/profile` - Returns user + retention metrics
- [ ] `POST /api/profile/update` - Updates nickname/avatar
- [ ] `GET /api/streak-status` - Returns streak without claiming
- [ ] `POST /api/claim-daily-reward` - Claims daily reward

#### Game Endpoints
- [ ] `GET /api/leaderboard/chips` - Top 100 by chips
- [ ] `GET /api/leaderboard/level` - Top 100 by level
- [ ] `GET /api/leaderboard/streak` - Top 100 by streak
- [ ] `GET /api/transactions` - User transaction history

#### Social Endpoints
- [ ] `GET /api/global-ticker` - Recent big events

#### Admin Endpoints
- [ ] `POST /api/admin/trigger-happy-hour` - Trigger event
- [ ] `POST /api/admin/adjust-chips` - Admin adjustment

### Integration Testing
```bash
npm install --save-dev jest supertest @types/jest
```

- [ ] Write API tests for each endpoint
- [ ] Test authentication flow
- [ ] Test error handling (400, 401, 404, 500)
- [ ] Test rate limiting

---

## Week 4: Socket.io Migration

### Event Handlers
- [ ] Create `src/socket/handlers.ts`
- [ ] Migrate `create-room` event
- [ ] Migrate `join-room` event
- [ ] Migrate `place-bet` event
- [ ] Migrate `player-action` event (hit/stand/etc.)
- [ ] Migrate `leave-room` event

### Real-Time Broadcasting
- [ ] Implement game state updates
- [ ] Implement mystery drop events
- [ ] Implement global ticker events
- [ ] Implement happy hour announcements

### Session Management
```typescript
// Attach user to socket
io.use((socket, next) => {
  socket.data.userId = req.user?.id;
  next();
});
```

- [ ] Integrate express-session with Socket.io
- [ ] Test authenticated socket connections
- [ ] Test room isolation (events only reach correct players)

---

## Week 5: Frontend Integration

### Component Architecture
```
components/
├── CasinoTable.tsx      # Main game view
├── PlayerSeat.tsx       # Individual seat
├── BettingControls.tsx  # Chip placement UI
├── StreakModal.tsx      # Daily reward claim
├── MysteryDrop.tsx      # Prize animation
├── GlobalTicker.tsx     # Event scroller
└── HUD.tsx             # Persistent UI (XP bar, chips)
```

- [ ] Create React/Next.js components (or refactor existing)
- [ ] Implement Socket.io client hooks
- [ ] Connect to new API endpoints
- [ ] Style with updated CSS (Vegas theme)

### Visual Feedback
```typescript
// Install animation library
npm install canvas-confetti react-spring
```

- [ ] Implement win celebration (confetti + sound)
- [ ] Implement near-miss effect (shake + red flash)
- [ ] Implement mystery drop modal (full-screen interrupt)
- [ ] Implement streak urgency indicator (countdown timer)

### Testing
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile (responsive design)
- [ ] Test with multiple concurrent users
- [ ] Test network disconnect/reconnect

---

## Week 6: Production Deployment

### Environment Configuration
- [ ] Set `NODE_ENV=production` in production
- [ ] Use strong `SESSION_SECRET` (not dev value)
- [ ] Enable HTTPS (Let's Encrypt or load balancer)
- [ ] Configure CORS for production domain
- [ ] Set secure cookie flags (`secure: true, sameSite: 'strict'`)

### Database
- [ ] Run `npx prisma migrate deploy` (apply migrations)
- [ ] Set up daily backups (pg_dump cron job)
- [ ] Configure connection pooling (Prisma Accelerate or pgBouncer)
- [ ] Set up read replicas (if high traffic)

### Redis
- [ ] Enable Redis persistence (AOF or RDB snapshots)
- [ ] Set up Redis Sentinel (high availability)
- [ ] Configure eviction policy: `maxmemory-policy allkeys-lru`

### Monitoring
```bash
npm install --save @sentry/node prom-client winston
```

- [ ] Set up error tracking (Sentry)
- [ ] Set up logging (Winston → CloudWatch/Datadog)
- [ ] Set up metrics (Prometheus + Grafana)
- [ ] Create health check endpoint: `GET /health`

### Load Testing
```bash
npm install --save-dev artillery
# artillery quick --count 1000 --num 100 http://localhost:3000
```

- [ ] Test with 100 concurrent users
- [ ] Test with 1,000 concurrent users
- [ ] Monitor CPU/memory usage
- [ ] Monitor database connection pool
- [ ] Optimize slow queries (add indexes if needed)

### Deployment Platforms

#### Option A: Railway
```bash
railway login
railway init
railway up
```

- [ ] Connect GitHub repo
- [ ] Add PostgreSQL plugin
- [ ] Add Redis plugin
- [ ] Set environment variables
- [ ] Deploy: `railway up`

#### Option B: Heroku
```bash
heroku create vegascore
heroku addons:create heroku-postgresql:mini
heroku addons:create heroku-redis:mini
git push heroku main
```

- [ ] Create app
- [ ] Add Postgres + Redis add-ons
- [ ] Set config vars: `heroku config:set SESSION_SECRET=...`
- [ ] Deploy: `git push heroku main`

#### Option C: Docker + VPS
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] Build Docker image: `docker build -t vegascore .`
- [ ] Push to registry: `docker push your-registry/vegascore`
- [ ] Deploy to VPS with docker-compose
- [ ] Set up Nginx reverse proxy
- [ ] Configure SSL (certbot)

---

## Post-Deployment

### Monitoring (First 24 Hours)
- [ ] Check error rate (target: <0.1%)
- [ ] Check average response time (target: <200ms)
- [ ] Check database connection pool usage
- [ ] Check Redis memory usage
- [ ] Monitor active WebSocket connections

### Analytics Setup
```typescript
// Track key events
analytics.track('daily_reward_claimed', { userId, day, chips });
analytics.track('mystery_drop_triggered', { userId, amount });
analytics.track('level_up', { userId, newLevel });
```

- [ ] Set up analytics (Mixpanel/Amplitude)
- [ ] Track daily active users (DAU)
- [ ] Track average session length
- [ ] Track streak completion rate
- [ ] Track revenue (if RMG)

### User Migration (if applicable)
```sql
-- Export old data
pg_dump old_database > backup.sql

-- Transform and import
-- Custom script to map old schema to new schema
```

- [ ] Export old user data
- [ ] Transform to new schema
- [ ] Import to PostgreSQL
- [ ] Verify chip balances match
- [ ] Send notification to existing users

### Feature Rollout
- [ ] Enable daily streaks (Week 1)
- [ ] Enable mystery drops (Week 2)
- [ ] Enable global ticker (Week 3)
- [ ] Enable happy hour (Week 4)
- [ ] Launch Blackjack (Week 5)

---

## Success Metrics Dashboard

### Daily Checks
```sql
-- Daily Active Users
SELECT COUNT(DISTINCT user_id) 
FROM "Transaction" 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Average Session Length
SELECT AVG(average_session_minutes) FROM "User"
WHERE last_login >= NOW() - INTERVAL '24 hours';

-- Revenue (if RMG)
SELECT SUM(amount) 
FROM "Transaction" 
WHERE type = 'BET' AND created_at >= NOW() - INTERVAL '24 hours';
```

- [ ] DAU trending up?
- [ ] Average session length > 20 min?
- [ ] Streak completion rate > 50%?
- [ ] Error rate < 0.1%?
- [ ] P99 latency < 500ms?

### Weekly Reviews
- [ ] Review top 10 errors in Sentry
- [ ] Analyze user retention (D1, D7, D30)
- [ ] Review transaction ledger for anomalies
- [ ] Check for SQL query performance issues
- [ ] Plan next feature releases

---

## Rollback Plan (If Issues Arise)

### Immediate Actions
1. [ ] Revert to previous deployment: `git revert && railway up`
2. [ ] Notify users via banner: "Maintenance mode"
3. [ ] Export current database state: `pg_dump > emergency_backup.sql`

### Root Cause Analysis
- [ ] Check error logs (Sentry, CloudWatch)
- [ ] Check database query performance (slow queries?)
- [ ] Check Redis connection (timeout errors?)
- [ ] Check Socket.io events (missing handlers?)

### Recovery
- [ ] Fix bug in staging environment
- [ ] Write regression test
- [ ] Deploy hotfix
- [ ] Monitor for 2 hours
- [ ] Send "All clear" notification

---

## Final Verification

### Functional Tests
- [ ] User can register/login
- [ ] User can join a game
- [ ] User can place a bet
- [ ] Game deals cards correctly
- [ ] Chips deducted/awarded correctly
- [ ] Transactions recorded in ledger
- [ ] Daily streak claimable once per day
- [ ] Mystery drops trigger randomly
- [ ] Global ticker shows recent events
- [ ] Leaderboards update in real-time

### Performance Tests
- [ ] Page load < 2 seconds
- [ ] API response time < 200ms (median)
- [ ] WebSocket latency < 100ms
- [ ] Database queries < 50ms
- [ ] Redis operations < 5ms

### Security Tests
- [ ] SQL injection protected (Prisma handles this)
- [ ] XSS protected (React escapes by default)
- [ ] CSRF protected (express-session + sameSite cookies)
- [ ] Rate limiting works (100 req/min)
- [ ] Admin routes protected (requireAdmin middleware)

---

## 🎉 Launch Day Checklist

### Pre-Launch (T-1 hour)
- [ ] Database backups enabled ✅
- [ ] Error monitoring active ✅
- [ ] Redis persistence enabled ✅
- [ ] SSL certificate valid ✅
- [ ] Health check endpoint responding ✅

### Launch (T=0)
- [ ] Deploy to production
- [ ] Run smoke tests
- [ ] Monitor logs for errors
- [ ] Check real user traffic

### Post-Launch (T+1 hour)
- [ ] Verify first users can play
- [ ] Verify transactions recording
- [ ] Verify streak claims working
- [ ] Check for any error spikes

### Post-Launch (T+24 hours)
- [ ] Review analytics dashboard
- [ ] Check DAU vs. target
- [ ] Check session length vs. target
- [ ] Iterate on pain points

---

## 🏆 Congratulations!

**You've successfully migrated to VegasCore.**

Your platform now features:
✅ Type-safe TypeScript codebase  
✅ Scalable architecture (Postgres + Redis)  
✅ Aggressive retention mechanics  
✅ Professional Blackjack engine  
✅ Complete audit trail  
✅ Production-ready deployment

**Next:** Focus on player acquisition and A/B testing engagement mechanics.

---

**Questions?** Review the main documentation files:
- `VEGASCORE_SUMMARY.md` - Overview
- `ARCHITECTURE.md` - Technical deep dive
- `VEGASCORE_REFACTORING_PLAN.md` - Week-by-week guide

**Issues?** Check error logs and refer to "Common Issues" section in VEGASCORE_SUMMARY.md
