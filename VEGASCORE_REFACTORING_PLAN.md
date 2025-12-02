# VegasCore Refactoring Plan
## From Prototype to Production RMG Platform

---

## Executive Summary

This document outlines the step-by-step migration from the current Node.js/Socket.io prototype to **VegasCore**, a production-grade Real-Money Gaming platform with aggressive retention mechanics.

**Key Improvements:**
- Type-safe TypeScript codebase
- PostgreSQL + Redis persistence
- Modular game engine architecture
- "North End" engagement mechanics (streaks, mystery drops, social proof)
- Complete audit trail for regulatory compliance

---

## Phase 1: Infrastructure Setup (Week 1)

### 1.1 Install Dependencies

```bash
npm install --save typescript @types/node @types/express ts-node
npm install --save @prisma/client ioredis
npm install --save-dev prisma @types/ioredis tsx nodemon

# Optional: Production monitoring
npm install --save @sentry/node prom-client
```

### 1.2 TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.3 Database Setup

**Install PostgreSQL:**
- Local: Use Docker (`docker run --name vegascore-db -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres`)
- Production: Use managed service (AWS RDS, Heroku Postgres, Supabase)

**Install Redis:**
- Local: `docker run --name vegascore-redis -p 6379:6379 -d redis`
- Production: AWS ElastiCache, Redis Cloud, Upstash

**Environment Variables** (`.env`):

```env
DATABASE_URL="postgresql://postgres:dev@localhost:5432/vegascore?schema=public"
REDIS_URL="redis://localhost:6379"

SESSION_SECRET="production_secret_change_me"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_secret"

NODE_ENV="development"
PORT=3000
```

**Initialize Prisma:**

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed # Optional: Seed achievements
```

---

## Phase 2: Code Migration (Week 2-3)

### 2.1 Migrate Core Server Logic

**Create `src/server.ts`** (TypeScript version of `server.js`):

```typescript
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { initEngagementService, EngagementService } from './services/EngagementService';
import { createApiRouter } from './api/routes';
import { setupSocketHandlers } from './socket/handlers';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

// Initialize services
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);
initEngagementService(prisma, redis);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.use('/api', createApiRouter(prisma, engagementService));

// Socket.io Handlers
setupSocketHandlers(io, prisma, redis);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`VegasCore running on port ${PORT}`);
});
```

### 2.2 Socket.io Migration

**Create `src/socket/handlers.ts`:**

```typescript
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { WarEngine } from '../engines/WarEngine';
import { BlackjackEngine } from '../engines/BlackjackEngine';

export function setupSocketHandlers(
  io: SocketIOServer,
  prisma: PrismaClient,
  redis: Redis
) {
  const rooms = new Map<string, WarEngine | BlackjackEngine>();

  io.on('connection', (socket: Socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create room
    socket.on('create-room', async (data: { gameType: 'WAR' | 'BLACKJACK', startingChips: number }) => {
      const roomId = crypto.randomUUID();
      const config = {
        roomId,
        minBet: 10,
        maxBet: 1000,
        maxPlayers: 5
      };

      if (data.gameType === 'WAR') {
        rooms.set(roomId, new WarEngine(config, prisma, redis, engagementService));
      } else {
        rooms.set(roomId, new BlackjackEngine(config, prisma, redis, engagementService));
      }

      socket.emit('room-created', { roomId, gameType: data.gameType });
    });

    // Join room
    socket.on('join-room', async (data: { roomId: string, seatIndex: number }) => {
      const room = rooms.get(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const userId = socket.data.userId; // Set during auth
      const success = await room.addPlayer(userId, data.seatIndex);

      if (success) {
        socket.join(data.roomId);
        io.to(data.roomId).emit('player-joined', room.getGameState());
      }
    });

    // Place bet
    socket.on('place-bet', async (data: { roomId: string, amount: number, seatIndex: number }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;

      const userId = socket.data.userId;
      const success = await room.placeBet(userId, data.amount, data.seatIndex);

      if (success) {
        io.to(data.roomId).emit('bet-placed', room.getGameState());
      }
    });

    // Additional handlers for game actions...
  });
}
```

### 2.3 War Engine Migration

**Create `src/engines/WarEngine.ts`** (refactor existing War logic):

```typescript
import { GameEngine, GameState } from './GameEngine';
// ... implement War-specific logic using existing server.js code
// Key: Extend GameEngine abstract class and integrate engagement hooks
```

---

## Phase 3: Frontend Integration (Week 4)

### 3.1 Component-Based Architecture

**Recommended:** Migrate to **Next.js** or **React** for better state management.

**Key Components:**
- `<CasinoTable>`: Visual table rendering
- `<PlayerSeat>`: Individual player position
- `<BettingControls>`: Chip placement UI
- `<StreakModal>`: Daily reward claim modal
- `<MysteryDropAnimation>`: Full-screen prize reveal
- `<GlobalTicker>`: Scrolling event feed
- `<HUD>`: XP bar, streak timer, chip count

### 3.2 Socket.io Client Updates

```typescript
// client/hooks/useSocket.ts
import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io('/', { auth: { token: getAuthToken() } });
    setSocket(s);

    s.on('mystery-drop', (data) => {
      // Show full-screen modal
      showMysteryDropModal(data.amount);
    });

    s.on('global:ticker', (event) => {
      // Update ticker component
      addTickerEvent(event);
    });

    return () => s.disconnect();
  }, []);

  return socket;
}
```

### 3.3 Visual Feedback ("Juicy" UI)

```typescript
// client/utils/animations.ts

export function celebrateWin(amount: number) {
  const intensity = Math.min(amount / 1000, 5);
  
  // Particle effects (use canvas-confetti library)
  confetti({
    particleCount: 100 * intensity,
    spread: 70,
    origin: { y: 0.6 }
  });
  
  // Sound effect
  playSound(`win_${intensity > 3 ? 'big' : 'small'}.mp3`);
  
  // Screen shake for big wins
  if (intensity > 3) {
    shakeScreen(500);
  }
}

export function showNearMissEffect() {
  // Red screen flash + shake
  flashScreen('#ff0000', 300);
  shakeScreen(200);
  playSound('near_miss.mp3');
}
```

---

## Phase 4: Engagement Mechanics Integration (Week 5)

### 4.1 Daily Streak UI

**Modal Design:**
```
┌─────────────────────────────────────┐
│        🔥 DAILY STREAK 🔥           │
│                                     │
│         Day 5 of 7                  │
│    ███████░░░░░░░░░░░░              │
│                                     │
│   Tomorrow's Reward: 2,500 chips    │
│                                     │
│  ⚠️  Resets in 18 hours!            │
│                                     │
│   [Claim 2,000 Chips + 100 XP]     │
└─────────────────────────────────────┘
```

**Implementation:**
```typescript
// Show on login
useEffect(() => {
  fetch('/api/streak-status')
    .then(r => r.json())
    .then(data => {
      if (data.urgency === 'HIGH') {
        showStreakModal(data, true); // Urgent styling
      }
    });
}, []);
```

### 4.2 Mystery Drop Animation

**Full-screen interrupt:**
```typescript
function MysteryDropModal({ amount }: { amount: number }) {
  return (
    <div className="mystery-drop-overlay">
      <div className="treasure-chest" onClick={openChest}>
        🎁
      </div>
      <h1 className="reveal-text">
        SECRET PRIZE!<br/>
        +{amount} CHIPS
      </h1>
    </div>
  );
}
```

### 4.3 Global Ticker

**Bottom-of-screen scroller:**
```typescript
function GlobalTicker() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    socket.on('global:ticker', (event) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
    });
  }, [socket]);

  return (
    <div className="ticker">
      {events.map(e => (
        <div key={e.timestamp} className="ticker-item">
          🎰 {e.data.userName} won {e.data.amount} chips on {e.data.gameType}!
        </div>
      ))}
    </div>
  );
}
```

---

## Phase 5: Testing & Deployment (Week 6)

### 5.1 Testing Strategy

**Unit Tests:**
```bash
npm install --save-dev jest @types/jest ts-jest
```

Test critical logic:
- EngagementService streak calculations
- BlackjackEngine hand evaluation
- Transaction ledger integrity

**Load Testing:**
```bash
npm install --save-dev artillery
```

Simulate 1000 concurrent users to test Redis/Socket.io performance.

### 5.2 Database Migrations

**Before production:**
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5.3 Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use secure session secrets (not hardcoded)
- [ ] Enable HTTPS (Let's Encrypt or load balancer)
- [ ] Set up database backups (daily snapshots)
- [ ] Configure Redis persistence (AOF or RDB)
- [ ] Add error tracking (Sentry)
- [ ] Set up logging (Winston + CloudWatch)
- [ ] Implement rate limiting (express-rate-limit)
- [ ] Add CORS whitelist for production domains
- [ ] Enable Prisma connection pooling

---

## Phase 6: Regulatory Compliance (Ongoing)

### 6.1 Audit Trail

**Every transaction is logged:**
- User ID
- Transaction type (BET, WIN, MYSTERY_DROP)
- Amount
- Timestamp
- Game session reference

**Generate audit reports:**
```sql
-- Daily chip flow
SELECT 
  DATE(created_at) as date,
  type,
  SUM(amount) as total
FROM "Transaction"
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY date, type
ORDER BY date DESC;
```

### 6.2 Provably Fair Gaming

**Deck seed commitment:**
```typescript
// Store SHA-256 hash of deck before dealing
const deckSeed = crypto.randomBytes(32).toString('hex');
const deckHash = crypto.createHash('sha256').update(deckSeed).digest('hex');

await prisma.gameSession.create({
  data: {
    initialDeckSeed: deckHash,
    // ... other fields
  }
});

// Reveal seed after hand completes
await prisma.gameSession.update({
  where: { id: sessionId },
  data: { finalState: { deckSeed, cards: [...] } }
});
```

---

## Success Metrics

**Key Performance Indicators (KPIs):**

| Metric | Target | Current |
|--------|--------|---------|
| Daily Active Users (DAU) | 10,000 | TBD |
| Avg Session Length | 25 min | TBD |
| Streak Completion Rate | 60% | TBD |
| Day 7 Retention | 40% | TBD |
| Mystery Drop Engagement | 95% claim | TBD |

**Track in dashboard:**
```typescript
// Analytics endpoint
router.get('/api/admin/analytics', async (req, res) => {
  const dau = await prisma.user.count({
    where: { lastLogin: { gte: new Date(Date.now() - 86400000) } }
  });
  
  const streakCompletions = await prisma.user.count({
    where: { currentStreak: { gte: 7 } }
  });
  
  res.json({ dau, streakCompletions });
});
```

---

## Rollback Plan

**If critical issues arise:**

1. Revert to `server.js` by changing Dockerfile/Procfile entry point
2. Export current database state: `npx prisma db pull && npx prisma generate`
3. Restore Redis snapshot
4. Monitor error logs for root cause
5. Fix in staging environment before re-deploying

---

## Next Steps

1. **Week 1:** Infrastructure setup + dependency installation
2. **Week 2:** Migrate `server.js` → TypeScript
3. **Week 3:** Implement Blackjack engine
4. **Week 4:** Frontend component refactor
5. **Week 5:** Engagement mechanics integration
6. **Week 6:** Production deployment

**Questions?** Review schema.prisma, EngagementService.ts, and BlackjackEngine.ts for implementation details.
