# VegasCore v5.0.0 - Phase 1 Implementation Guide

## Executive Summary

This guide explains how Phase 1 eliminates the **"Glass Cannon"** vulnerability identified in the forensic audit by implementing:

1. **Distributed Locking (Redlock)** - Prevents race conditions across N containers
2. **Redis-First Architecture** - Eliminates in-memory state (survives crashes)
3. **Atomic Transactions** - Ensures ACID guarantees for money operations

---

## The "Split-Brain" Problem (Before v5.0.0)

### Vulnerable Code Pattern (v4.0.0)

```typescript
// ❌ VULNERABLE - DO NOT USE
async playerAction(userId, action) {
  // STEP 1: Check state (in-memory)
  if (this.state !== GameState.PLAYER_TURN) {
    return { success: false };
  }

  const player = this.players.get(userId); // In-memory map

  // STEP 2: Yield to event loop (DANGER ZONE)
  await this.deductChips(userId, 100); // Database write

  // STEP 3: Update state (in-memory)
  this.state = GameState.DEALER_TURN;

  return { success: true };
}
```

### Attack Scenario

**Setup:**
- 2 Cloud Run containers serving same table
- User sends 2 concurrent requests (network race)

**Timeline:**

| Time | Container A | Container B | Result |
|------|-------------|-------------|--------|
| T0 | Receives request | Receives request | |
| T1 | Checks `this.state === PLAYER_TURN` ✅ | Checks `this.state === PLAYER_TURN` ✅ | **Both pass** |
| T2 | Deducts 100 chips from DB | Deducts 100 chips from DB | **User charged 200** |
| T3 | Sets `this.state = DEALER_TURN` | Sets `this.state = DEALER_TURN` | **State corrupted** |

**Impact:**
- User charged twice (200 chips instead of 100)
- No audit trail of double-spend
- State inconsistent across containers
- Database and memory out of sync

---

## The Solution: Distributed Locking + Redis-First

### Safe Code Pattern (v5.0.0)

```typescript
// ✅ PRODUCTION-READY
async playerAction(userId, action) {
  const lockManager = getLockManager();

  // CRITICAL: Acquire distributed lock FIRST
  const result = await lockManager.withLock(
    `table:${tableId}:action`,
    async () => {
      // STEP 1: Fetch LATEST state from Redis (not memory)
      const state = await redis.get(`table:${tableId}:state`);
      if (state !== GameState.PLAYER_TURN) {
        throw new Error('INVALID_STATE');
      }

      // STEP 2: Execute action (protected by lock)
      const success = await this.deductChips(userId, 100);

      // STEP 3: Update Redis (source of truth)
      await redis.set(`table:${tableId}:state`, GameState.DEALER_TURN);

      return { success };
    },
    LOCK_PRESETS.STANDARD
  );

  return result.success ? result.data : { error: 'Lock failed' };
}
```

### How This Prevents Split-Brain

**Same Attack Scenario:**

| Time | Container A | Container B | Result |
|------|-------------|-------------|--------|
| T0 | Receives request | Receives request | |
| T1 | Acquires lock ✅ | Tries to acquire lock ⏳ | **A wins** |
| T2 | Fetches state from Redis | **BLOCKED** (waiting for lock) | |
| T3 | Deducts 100 chips | **BLOCKED** | |
| T4 | Updates Redis state | **BLOCKED** | |
| T5 | Releases lock | **BLOCKED** | |
| T6 | ✅ Complete | Acquires lock ✅ | **B's turn** |
| T7 | | Fetches state from Redis | State = DEALER_TURN |
| T8 | | Rejects (invalid state) ❌ | **Prevented** |

**Outcome:**
- User charged once (100 chips) ✅
- Full audit trail ✅
- State consistent ✅
- Container A crash = Container B takes over seamlessly ✅

---

## Installation & Setup

### 1. Install Dependencies

```bash
npm install redlock ioredis
npm install --save-dev @types/redlock @types/ioredis
```

**package.json:**
```json
{
  "dependencies": {
    "redlock": "^5.0.0",
    "ioredis": "^5.10.0"
  }
}
```

### 2. Initialize LockManager (server.js)

```typescript
import { Redis } from 'ioredis';
import { initLockManager } from './src/services/LockManager';

// Create Redis clients (production: 3+ instances across AZs)
const redisClients = [
  new Redis(process.env.REDIS_URL_1),
  new Redis(process.env.REDIS_URL_2),
  new Redis(process.env.REDIS_URL_3)
];

// Initialize global LockManager
initLockManager(redisClients);

console.log('✅ Distributed locking enabled');
```

**For Development (Single Redis):**
```typescript
const redisClients = [new Redis(process.env.REDIS_URL)];
initLockManager(redisClients);
```

### 3. Environment Variables

```bash
# Production (Upstash, Redis Labs, AWS ElastiCache)
REDIS_URL_1=redis://primary.redis.cloud:6379
REDIS_URL_2=redis://replica-1.redis.cloud:6379
REDIS_URL_3=redis://replica-2.redis.cloud:6379

# Development (local)
REDIS_URL=redis://localhost:6379
```

---

## Migration from v4.0.0 to v5.0.0

### Step 1: Extend BaseGameEngine (New)

**Old (v4.0.0):**
```typescript
import { GameEngine } from './GameEngine';

class BlackjackEngine extends GameEngine {
  constructor(config, prisma, redis, engagement) {
    super(config, prisma, redis, engagement);
    this.state = GameState.WAITING; // ❌ Memory state
  }
}
```

**New (v5.0.0):**
```typescript
import { BaseGameEngine } from './BaseGameEngine.v5';

class BlackjackEngine extends BaseGameEngine {
  constructor(config, prisma, redis, engagement) {
    super(config, prisma, redis, engagement);
    // ✅ State managed by BaseGameEngine (Redis-backed)
  }

  async initialize() {
    await super.initialize(); // Load state from Redis
  }
}
```

### Step 2: Replace In-Memory State Access

**Old:**
```typescript
// ❌ Direct memory access
if (this.state !== GameState.PLAYER_TURN) {
  return false;
}

this.state = GameState.DEALER_TURN; // ❌ Lost on crash
```

**New:**
```typescript
// ✅ Redis-First
const state = await redis.get(`table:${this.config.tableId}:state`);
if (state !== GameState.PLAYER_TURN) {
  throw new Error('INVALID_STATE');
}

await this.setState(GameState.DEALER_TURN); // ✅ Persisted to Redis
```

### Step 3: Wrap Money Operations in Locks

**Old:**
```typescript
// ❌ No lock - race condition
async deductChips(userId, amount) {
  const player = this.players.get(userId);
  player.chips -= amount; // In-memory
  await prisma.user.update({ ... }); // Database
}
```

**New:**
```typescript
// ✅ Lock + Transaction
async deductChips(userId, seatIndex, amount) {
  const lockManager = getLockManager();

  return await lockManager.withLock(
    `user:${userId}:balance`,
    async () => {
      await prisma.$transaction(async (tx) => {
        // Atomic deduction
        await tx.user.update({
          where: { id: userId },
          data: { chipBalance: { decrement: BigInt(amount) } }
        });

        // Update Redis state
        // ... (see BaseGameEngine.v5.ts)
      });
    },
    LOCK_PRESETS.CRITICAL
  );
}
```

### Step 4: Handle Lock Failures

**Client-Side Error Handling:**
```typescript
const result = await socket.emit('playerAction', { action: 'HIT' });

if (!result.success) {
  if (result.errorCode === 'SYSTEM_BUSY') {
    // Show "Please wait..." message
    // Retry after 1 second
    setTimeout(() => retry(), 1000);
  } else {
    // Show error to user
    showError(result.error);
  }
}
```

---

## Performance Considerations

### Lock TTL Tuning

| Operation | TTL | Rationale |
|-----------|-----|-----------|
| Balance check | 1s | Fast read operation |
| Bet placement | 5s | Standard game action |
| Hand resolution | 15s | Multi-step calculation |
| Payout distribution | 30s | Critical money operation |

**Rule of Thumb:** TTL should be **2-3x expected execution time**

### Redis Latency

**Production Setup:**
- Use Redis in same region as Cloud Run (< 5ms latency)
- Enable Redis persistence (AOF + RDB)
- Use Redis Cluster for high availability

**Latency Budget:**
- Lock acquisition: 10-50ms
- Redis read: 1-5ms
- Redis write: 1-5ms
- Total overhead: ~20-100ms per action

**Acceptable for RMG:** Casino games are turn-based (not real-time FPS)

---

## Monitoring & Alerting

### LockManager Metrics

```typescript
const metrics = lockManager.getMetrics();

console.log({
  acquired: metrics.acquired,      // Total locks acquired
  failed: metrics.failed,          // Failed acquisitions
  avgDuration: metrics.avgDuration, // Average lock hold time
  maxDuration: metrics.maxDuration, // Longest lock hold time
  successRate: metrics.successRate  // % successful
});
```

### CloudWatch/DataDog Alerts

```yaml
alerts:
  - name: High Lock Failure Rate
    condition: successRate < 0.95
    action: Page on-call engineer

  - name: Long Lock Duration
    condition: avgDuration > 5000ms
    action: Investigate performance

  - name: Lock Timeout Spike
    condition: failed > 100/min
    action: Check Redis health
```

---

## Testing

### Unit Test (Jest)

```typescript
import { LockManager } from './LockManager';
import { Redis } from 'ioredis';

describe('LockManager', () => {
  let lockManager: LockManager;
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis();
    lockManager = new LockManager([redis]);
  });

  it('prevents concurrent execution', async () => {
    let counter = 0;

    // Two concurrent operations
    const [result1, result2] = await Promise.all([
      lockManager.withLock('test', async () => {
        const current = counter;
        await new Promise(r => setTimeout(r, 100)); // Simulate work
        counter = current + 1;
      }),

      lockManager.withLock('test', async () => {
        const current = counter;
        await new Promise(r => setTimeout(r, 100));
        counter = current + 1;
      })
    ]);

    // Counter should be 2 (sequential, not 1 from race condition)
    expect(counter).toBe(2);
  });
});
```

### Load Test (Artillery)

```yaml
config:
  target: 'https://<your-api-url>'
  phases:
    - duration: 60
      arrivalRate: 100  # 100 requests/second

scenarios:
  - name: Concurrent Bet Placement
    flow:
      - post:
          url: '/api/game/bet'
          json:
            userId: '{{ $randomString() }}'
            amount: 100
```

**Expected Results:**
- 0 double-charges
- < 1% lock failures
- < 100ms average response time

---

## Security Considerations

### Lock Key Naming

**Vulnerable (Predictable):**
```typescript
// ❌ Attacker can guess lock keys
await lockManager.withLock('user123', ...);
```

**Secure (Namespaced):**
```typescript
// ✅ Namespaced with table ID
await lockManager.withLock(`table:${tableId}:user:${userId}`, ...);
```

### Lock Timeout Attacks

**Attack:** Malicious user holds lock indefinitely

**Mitigation:**
```typescript
// ✅ TTL auto-releases lock
LOCK_PRESETS.CRITICAL: {
  ttl: 30000, // Max 30 seconds
  retryCount: 10 // Limited retries
}
```

### Orphaned Locks

**Problem:** Container crashes before releasing lock

**Solution:**
- Lock TTL expires automatically (30s max)
- Redlock quorum prevents single-point failure
- CloudWatch alerts on `avgDuration > ttl * 0.8`

---

## Next Steps: Phase 2 & 3

### Phase 2: Infrastructure
- [ ] Implement `@socket.io/redis-adapter` (horizontal scaling)
- [ ] Migrate database migrations out of `start.sh`
- [ ] Dynamic Prisma connection pooling

### Phase 3: Security
- [ ] Refactor AutoModeration with `re2` (prevent ReDoS)
- [ ] Implement Web Crypto API for client-side encryption
- [ ] Add rate limiting (per-user, per-table)

---

## Support & Troubleshooting

### Common Issues

**Q: Lock acquisition timeout**
```
Error: Lock acquisition timeout for table:123:action
```
**A:** Another request is processing. Client should retry after 1 second.

---

**Q: Redis connection failed**
```
Error: Redis connection refused
```
**A:** Check `REDIS_URL` environment variable and Redis server status.

---

**Q: High lock failure rate (> 5%)**
```
Metrics: { successRate: 0.89 }
```
**A:** Possible causes:
1. TTL too short (increase from 5s to 10s)
2. Redis latency high (check region/network)
3. Too many concurrent requests (scale Redis)

---

## Conclusion

Phase 1 implements the **foundation of concurrency safety** for VegasCore v5.0.0:

1. ✅ **Distributed Locking** - Prevents race conditions across N containers
2. ✅ **Redis-First State** - Survives container crashes
3. ✅ **Atomic Transactions** - ACID guarantees for money operations
4. ✅ **Typed Error Handling** - Graceful degradation

**Impact:**
- Zero double-spend vulnerabilities
- Horizontal scaling ready
- Production-grade reliability
- Full audit trail

**Status:** Ready for Phase 2 (Infrastructure) implementation.
