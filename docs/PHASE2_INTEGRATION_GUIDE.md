# Phase 2 Integration Guide - Complete server.js Refactor

## Overview

This guide shows **exactly** how to integrate Phase 2 infrastructure into your existing `server.js` file.

---

## Step 1: Add Required Imports

**Add to top of server.js (after existing imports):**

```typescript
// Phase 2: Infrastructure & Scalability
const { setupRedisAdapter, getAdapterStats } = require('./src/infrastructure/SocketIOAdapter');
const {
  createOptimizedPrismaClient,
  generateDatabaseConfig
} = require('./src/infrastructure/DatabaseConfig');
const {
  createHealthCheckHandler,
  createReadinessHandler,
  performHealthCheck
} = require('./src/infrastructure/HealthCheck');
const { Redis } = require('ioredis');
```

---

## Step 2: Replace Prisma Initialization

**FIND (around line 13-14):**
```javascript
const { getOrCreateUser, checkDailyReset, updateUserChips, canUserPlay, prisma } = require('./src/db');
```

**REPLACE WITH:**
```javascript
// Phase 2: Use optimized Prisma client with dynamic connection pooling
const prisma = createOptimizedPrismaClient();
const { getOrCreateUser, checkDailyReset, updateUserChips, canUserPlay } = require('./src/db');

// Log database configuration on startup
generateDatabaseConfig(); // Logs pool size, memory, etc.
```

---

## Step 3: Create Redis Clients

**ADD (before Socket.IO initialization, around line 1430):**

```javascript
// =============================================================================
// PHASE 2: REDIS CLIENTS FOR SCALABILITY
// =============================================================================

/**
 * Create Redis clients for different purposes:
 * 1. Game State Redis - For LockManager and game data
 * 2. Socket.IO Pub/Sub - For cross-container communication
 *
 * WHY SEPARATE CLIENTS?
 * - Pub/Sub requires dedicated connections
 * - Game state operations shouldn't block Socket.IO
 * - Allows independent scaling and monitoring
 */

// Game state Redis (for LockManager, game data, sessions)
const gameStateRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

gameStateRedis.on('connect', () => {
  console.log('✅ Game State Redis connected');
});

gameStateRedis.on('error', (err) => {
  console.error('❌ Game State Redis error:', err.message);
});

// Socket.IO Pub/Sub Redis (separate client for adapter)
const socketIoPubRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const socketIOSubRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

console.log('📡 Redis clients initialized for horizontal scaling');
```

---

## Step 4: Update Socket.IO Initialization

**FIND (around line 1432-1434):**
```javascript
const serverHttp = http.createServer(app);
const io = socketIo(serverHttp, { cors: { origin: '*', methods: ['GET', 'POST'] } });
io.engine.use(sessionMiddleware);
```

**REPLACE WITH:**
```javascript
const serverHttp = http.createServer(app);
const io = socketIo(serverHttp, { cors: { origin: '*', methods: ['GET', 'POST'] } });
io.engine.use(sessionMiddleware);

// Phase 2: Initialize Socket.IO Redis Adapter for horizontal scaling
(async () => {
  try {
    await setupRedisAdapter(io, {
      pubUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      verbose: process.env.NODE_ENV === 'development'
    });
    console.log('✅ Socket.IO Redis Adapter enabled - Ready for multi-container deployment');

    // Log cluster stats periodically (for monitoring)
    if (process.env.NODE_ENV === 'production') {
      setInterval(() => {
        const stats = getAdapterStats(io);
        if (stats) {
          console.log(`📊 Socket.IO Cluster: ${stats.serverCount} containers, ${stats.sockets} connections`);
        }
      }, 60000); // Log every minute
    }
  } catch (error) {
    console.error('❌ Failed to initialize Socket.IO adapter:', error);
    // Continue without adapter (single-container mode)
  }
})();
```

---

## Step 5: Add Health Check Endpoints

**FIND (around line 441-444):**
```javascript
// Health check endpoint (lightweight - prevents cold starts)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
```

**REPLACE WITH:**
```javascript
// =============================================================================
// PHASE 2: COMPREHENSIVE HEALTH CHECK SYSTEM
// =============================================================================

/**
 * /health - Full health check (for monitoring dashboards)
 * - Checks: Redis, Database, Socket.IO, System resources
 * - Response time: ~100ms
 * - Use for: DataDog, CloudWatch, Grafana
 */
app.get('/health', createHealthCheckHandler({
  redis: gameStateRedis,
  prisma,
  io,
  timeout: 5000,
  includeMetrics: true,
  version: APP_VERSION
}));

/**
 * /ready - Fast readiness check (for Cloud Run startup probe)
 * - Checks: Redis, Database only (critical components)
 * - Response time: ~50ms
 * - Use for: Cloud Run health checks, load balancer routing
 */
app.get('/ready', createReadinessHandler({
  redis: gameStateRedis,
  prisma
}));

/**
 * /live - Liveness check (for container restart detection)
 * - Checks: Basic server responsiveness
 * - Response time: < 10ms
 * - Use for: Kubernetes liveness probes
 */
app.get('/live', (req, res) => {
  res.status(200).json({
    alive: true,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Health check endpoints configured (/health, /ready, /live)');
```

---

## Step 6: Add Graceful Shutdown Handler

**ADD (at the very end of server.js, after `startServer()` call):**

```javascript
// =============================================================================
// PHASE 2: GRACEFUL SHUTDOWN HANDLING
// =============================================================================

/**
 * Graceful shutdown for zero-downtime deployments
 *
 * PROCESS:
 * 1. Cloud Run sends SIGTERM (30s before forceful shutdown)
 * 2. Stop accepting new connections
 * 3. Finish processing active requests
 * 4. Close database and Redis connections
 * 5. Exit cleanly
 */

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 ${signal} received - Starting graceful shutdown...`);

  // Stop accepting new connections
  serverHttp.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close Socket.IO connections
  io.close(() => {
    console.log('✅ Socket.IO server closed');
  });

  // Give active requests 25 seconds to finish (Cloud Run gives 30s total)
  setTimeout(async () => {
    try {
      // Close database connections
      await prisma.$disconnect();
      console.log('✅ Database connections closed');

      // Close Redis connections
      await gameStateRedis.quit();
      await socketIoPubRedis.quit();
      await socketIOSubRedis.quit();
      console.log('✅ Redis connections closed');

      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }, 25000); // 25 seconds (allows 5s buffer before Cloud Run kills process)
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Log startup completion
console.log('');
console.log('🚀 VegasCore v5.0.0 - Phase 2 Infrastructure Active');
console.log('   ✅ Horizontal scaling enabled (Socket.IO Redis Adapter)');
console.log('   ✅ Dynamic connection pooling configured');
console.log('   ✅ Health checks operational (/health, /ready, /live)');
console.log('   ✅ Graceful shutdown handlers registered');
console.log('');
```

---

## Step 7: Update Cloud Run Configuration

**Add to cloudbuild.yaml (in the deploy step args):**

```yaml
# Step 4: Deploy to Cloud Run
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
    # ... existing args ...

    # Phase 2: Add health check configuration
    - '--startup-cpu-boost'                # Fast startup
    - '--min-instances=1'                  # Keep 1 warm (optional)
    - '--max-instances=10'                 # Allow scaling

    # Health check endpoints
    - '--startup-probe-http-get-path=/ready'
    - '--startup-probe-initial-delay=0'
    - '--startup-probe-period=5'
    - '--startup-probe-timeout=3'
    - '--startup-probe-failure-threshold=3'

    # Liveness probe
    - '--liveness-probe-http-get-path=/live'
    - '--liveness-probe-period=10'
    - '--liveness-probe-timeout=3'

    # Set environment variables
    - '--set-env-vars=PORT=8080,NODE_ENV=production,MEMORY_MB=512'
```

---

## Step 8: Environment Variables Checklist

**Update your .env file:**

```bash
# Phase 2: Required Environment Variables

# Redis (for Socket.IO Adapter + Game State)
REDIS_URL=redis://<your-redis-host>:6379

# Database URLs
DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/db

# Container Resources (Cloud Run auto-sets, but can override)
MEMORY_MB=512
MAX_DB_CONNECTIONS=51

# Application Configuration
NODE_ENV=production
APP_VERSION=5.0.0
PORT=8080

# Optional: Database Configuration
DB_CONNECT_TIMEOUT=10
DB_QUERY_TIMEOUT=30
DB_LOGGING=false
```

---

## Step 9: Verify Integration

### Test 1: Local Development

```bash
# Start server locally
npm run dev

# Check health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/live
```

**Expected:**
- `/health` returns 200 with full diagnostics
- `/ready` returns 200 with `{"ready": true}`
- `/live` returns 200 with `{"alive": true}`

### Test 2: Socket.IO Adapter

```bash
# In Node.js console
const { getAdapterStats } = require('./src/infrastructure/SocketIOAdapter');
const stats = getAdapterStats(io);
console.log(stats);
```

**Expected (single container):**
```json
{
  "serverCount": 1,
  "sockets": 0,
  "rooms": 0,
  "type": "RedisAdapter"
}
```

**Expected (production with 3 containers):**
```json
{
  "serverCount": 3,
  "sockets": 127,
  "rooms": 45,
  "type": "RedisAdapter"
}
```

### Test 3: Database Pool Size

```bash
# Check logs during startup
npm run dev
```

**Expected output:**
```
📊 Database Configuration:
   Pool Size: 51 connections
   Direct Limit: 10 connections
   Connect Timeout: 10s
   Query Timeout: 30s
   Container Memory: 512MB
   CPU Cores: 8
```

### Test 4: Deployment

```bash
# Commit and push
git add .
git commit -m "Phase 2: Infrastructure & Scalability"
git push origin main

# Watch Cloud Build logs
gcloud builds log --stream

# Verify deployment
curl https://moes-casino-212973396288.us-central1.run.app/health
```

**Expected:**
- Build completes successfully
- Migrations run before deployment
- Health check returns 200
- Socket.IO cluster size > 0

---

## Complete server.js Structure (Summary)

```
server.js
├── Imports
│   ├── Standard Node.js modules
│   ├── Phase 1: LockManager, BaseGameEngine
│   └── Phase 2: SocketIOAdapter, DatabaseConfig, HealthCheck
│
├── Constants & Configuration
│   ├── PORT, NODE_ENV, APP_VERSION
│   └── Admin email, session secret
│
├── Redis Clients (Phase 2)
│   ├── gameStateRedis (for LockManager)
│   └── socketIoPubRedis, socketIOSubRedis (for adapter)
│
├── Prisma Client (Phase 2)
│   └── createOptimizedPrismaClient() with dynamic pooling
│
├── Express App Setup
│   ├── Middleware (CORS, session, passport)
│   └── checkOperatingHours (with admin bypass)
│
├── Health Check Endpoints (Phase 2)
│   ├── /health (comprehensive)
│   ├── /ready (fast)
│   └── /live (basic)
│
├── API Routes
│   ├── Authentication (/auth/*)
│   ├── Game logic (/api/*)
│   └── Admin (/admin/*)
│
├── Socket.IO Setup
│   ├── Initialize server
│   ├── Setup Redis Adapter (Phase 2)
│   └── Event handlers
│
├── Server Startup
│   └── startServer() function
│
└── Graceful Shutdown (Phase 2)
    ├── SIGTERM handler
    └── SIGINT handler
```

---

## Troubleshooting

### Issue: Socket.IO adapter not initializing

**Symptom:**
```
⚠️ CRITICAL: Socket.IO running in SINGLE-CONTAINER mode
```

**Solution:**
```bash
# Check Redis connectivity
redis-cli -h <your-redis-host> -p 6379 ping
# Should return: PONG

# Check environment variable
echo $REDIS_URL
# Should return: redis://...
```

---

### Issue: Database pool exhausted

**Symptom:**
```
Error: Timed out fetching a new connection from the pool
```

**Solution:**
```bash
# Increase pool size
MAX_DB_CONNECTIONS=100

# Or increase container memory
MEMORY_MB=1024
```

---

### Issue: Health check failing

**Symptom:**
```
{"status": "unhealthy", "components": {"database": {"status": "unhealthy"}}}
```

**Solution:**
```bash
# Check database connectivity
curl http://localhost:8080/health | jq '.components.database'

# Increase timeout
DB_CONNECT_TIMEOUT=30
```

---

## Next Steps

After completing Phase 2 integration:

1. ✅ Deploy to Cloud Run
2. ✅ Scale to multiple containers
3. ✅ Monitor health endpoints
4. ✅ Verify Socket.IO events work across containers
5. → Proceed to Phase 3 (Security Hardening)

---

**Questions?** Review `VEGASCORE_V5_PHASE2_SUMMARY.md` for detailed explanations.
