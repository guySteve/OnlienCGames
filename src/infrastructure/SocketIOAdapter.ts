/**
 * Socket.IO Redis Adapter - Horizontal Scaling Infrastructure
 *
 * PURPOSE: Enables Socket.IO to work across multiple Cloud Run containers
 *
 * WHY THIS IS CRITICAL:
 * - Without this, Socket.IO events only work within a single container
 * - User on Container A cannot communicate with User on Container B
 * - Load balancer distributes users across containers randomly
 * - Result: Messages lost, games broken, "phantom players"
 *
 * HOW IT WORKS:
 * - All Socket.IO events are published to Redis Pub/Sub
 * - All containers subscribe to the same Redis channels
 * - Event on Container A → Redis → All containers (including B)
 * - Result: Seamless cross-container communication
 *
 * CRITICAL SEPARATION:
 * - Uses separate Redis clients (pubClient, subClient)
 * - DO NOT reuse game state Redis client (prevents blocking)
 * - Pub/Sub is fire-and-forget (won't block game logic)
 *
 * @see https://socket.io/docs/v4/redis-adapter/
 * @version 5.0.0
 */

import { Server as SocketIOServer, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import type { Server as HttpServer } from 'http';

/**
 * Redis Adapter Configuration
 */
interface RedisAdapterConfig {
  /** Primary Redis URL (for publishing events) */
  pubUrl: string;

  /** Secondary Redis URL (for subscribing to events)
   * Can be same as pubUrl, but separate client required by adapter */
  subUrl?: string;

  /** Enable detailed logging (development only) */
  verbose?: boolean;

  /** Retry strategy for connection failures */
  retryStrategy?: {
    maxAttempts: number;
    delayMs: number;
  };
}

/**
 * Default retry strategy (exponential backoff)
 */
const DEFAULT_RETRY_STRATEGY = {
  maxAttempts: 10,
  delayMs: 1000
};

/**
 * Setup Socket.IO with Redis Adapter for horizontal scaling
 *
 * CALL THIS ONCE during server initialization (before io.on('connection'))
 *
 * @param io - Socket.IO server instance
 * @param config - Redis adapter configuration
 * @returns Promise<void> - Resolves when adapter is ready
 *
 * @example
 * ```typescript
 * const io = new Server(httpServer);
 * await setupRedisAdapter(io, {
 *   pubUrl: process.env.REDIS_URL!,
 *   verbose: process.env.NODE_ENV === 'development'
 * });
 *
 * io.on('connection', (socket) => {
 *   // Events now work across all containers ✅
 *   io.emit('broadcast', 'All containers receive this');
 * });
 * ```
 */
export async function setupRedisAdapter(
  io: SocketIOServer,
  config: RedisAdapterConfig
): Promise<void> {
  const { pubUrl, subUrl, verbose, retryStrategy } = config;
  const retry = retryStrategy || DEFAULT_RETRY_STRATEGY;

  console.log('🔌 Setting up Socket.IO Redis Adapter for horizontal scaling...');

  try {
    // CRITICAL: Create TWO separate Redis clients
    // Why? The adapter uses pub/sub, which requires dedicated connections
    // Mixing pub/sub with regular commands causes blocking

    // Publisher client (sends events to Redis)
    const pubClient = createClient({
      url: pubUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > retry.maxAttempts) {
            console.error('❌ Redis Pub client: Max reconnection attempts exceeded');
            return new Error('Max reconnection attempts exceeded');
          }
          const delay = Math.min(retry.delayMs * Math.pow(2, retries), 30000);
          if (verbose) {
            console.log(`🔄 Redis Pub client: Reconnecting in ${delay}ms (attempt ${retries})`);
          }
          return delay;
        }
      }
    }) as RedisClientType;

    // Subscriber client (receives events from Redis)
    const subClient = createClient({
      url: subUrl || pubUrl, // Can use same URL, but must be separate client
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > retry.maxAttempts) {
            console.error('❌ Redis Sub client: Max reconnection attempts exceeded');
            return new Error('Max reconnection attempts exceeded');
          }
          const delay = Math.min(retry.delayMs * Math.pow(2, retries), 30000);
          if (verbose) {
            console.log(`🔄 Redis Sub client: Reconnecting in ${delay}ms (attempt ${retries})`);
          }
          return delay;
        }
      }
    }) as RedisClientType;

    // Error handlers (prevent crash on connection issues)
    pubClient.on('error', (err) => {
      console.error('❌ Redis Pub client error:', err.message);
    });

    subClient.on('error', (err) => {
      console.error('❌ Redis Sub client error:', err.message);
    });

    // Connection event handlers (for monitoring)
    pubClient.on('connect', () => {
      if (verbose) console.log('✅ Redis Pub client connected');
    });

    subClient.on('connect', () => {
      if (verbose) console.log('✅ Redis Sub client connected');
    });

    pubClient.on('reconnecting', () => {
      console.warn('⚠️ Redis Pub client reconnecting...');
    });

    subClient.on('reconnecting', () => {
      console.warn('⚠️ Redis Sub client reconnecting...');
    });

    // CONNECT to Redis (with timeout)
    const connectionTimeout = 10000; // 10 seconds
    await Promise.race([
      Promise.all([pubClient.connect(), subClient.connect()]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), connectionTimeout)
      )
    ]);

    // ATTACH adapter to Socket.IO
    io.adapter(createAdapter(pubClient, subClient));

    console.log('✅ Socket.IO Redis Adapter enabled - Horizontal scaling ready');

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      console.log('🔌 Disconnecting Redis Adapter clients...');
      await Promise.all([
        pubClient.quit().catch(() => {}),
        subClient.quit().catch(() => {})
      ]);
    });

  } catch (error: any) {
    console.error('❌ Failed to setup Redis Adapter:', error.message);

    // FALLBACK: Continue without adapter (single-container mode)
    // This prevents total failure but logs a critical warning
    console.warn('⚠️ CRITICAL: Socket.IO running in SINGLE-CONTAINER mode');
    console.warn('⚠️ Users on different containers CANNOT communicate');
    console.warn('⚠️ This is acceptable for development but NOT for production');

    // In production, you might want to throw here to prevent deployment
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis Adapter is REQUIRED in production');
    }
  }
}

/**
 * Create Socket.IO server with Redis Adapter (convenience wrapper)
 *
 * USE THIS for new projects (handles initialization in one call)
 *
 * @param httpServer - HTTP server instance
 * @param redisConfig - Redis adapter configuration
 * @param socketConfig - Socket.IO server configuration
 * @returns Configured Socket.IO server
 *
 * @example
 * ```typescript
 * const io = await createScalableSocketIO(httpServer, {
 *   pubUrl: process.env.REDIS_URL!
 * }, {
 *   cors: { origin: '*' }
 * });
 * ```
 */
export async function createScalableSocketIO(
  httpServer: HttpServer,
  redisConfig: RedisAdapterConfig,
  socketConfig?: Partial<ServerOptions>
): Promise<SocketIOServer> {
  // Create Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Configure based on your security requirements
      methods: ['GET', 'POST']
    },
    ...socketConfig
  });

  // Attach Redis adapter
  await setupRedisAdapter(io, redisConfig);

  return io;
}

/**
 * Get adapter statistics (for monitoring)
 *
 * USE THIS to track cross-container communication health
 *
 * @param io - Socket.IO server instance
 * @returns Adapter stats or null if adapter not available
 *
 * @example
 * ```typescript
 * const stats = getAdapterStats(io);
 * if (stats) {
 *   console.log('Sockets:', stats.sockets);
 *   console.log('Rooms:', stats.rooms);
 * }
 * ```
 */
export function getAdapterStats(io: SocketIOServer): any {
  const adapter = io.of('/').adapter as any;

  if (!adapter || typeof adapter.serverCount !== 'function') {
    return null; // No adapter or stats not available
  }

  return {
    // Number of Socket.IO servers (containers) in the cluster
    serverCount: adapter.serverCount?.() || 1,

    // Number of connected sockets
    sockets: io.of('/').sockets.size,

    // Number of rooms
    rooms: adapter.rooms?.size || 0,

    // Adapter type
    type: adapter.constructor.name
  };
}

/**
 * Example: Health check using adapter stats
 *
 * ADD THIS to your /health endpoint
 */
export function checkAdapterHealth(io: SocketIOServer): {
  healthy: boolean;
  stats?: any;
  error?: string;
} {
  const stats = getAdapterStats(io);

  if (!stats) {
    return {
      healthy: false,
      error: 'No adapter available (single-container mode)'
    };
  }

  // Check if we're in a cluster (production)
  const isProduction = process.env.NODE_ENV === 'production';
  const hasMultipleServers = stats.serverCount > 1;

  if (isProduction && !hasMultipleServers) {
    return {
      healthy: true, // Not critical, but worth monitoring
      stats,
      error: 'WARNING: Running single container in production'
    };
  }

  return {
    healthy: true,
    stats
  };
}

/**
 * MIGRATION GUIDE: v4.0.0 → v5.0.0
 *
 * OLD (v4.0.0):
 * ```typescript
 * const io = socketIo(httpServer, { cors: { origin: '*' } });
 *
 * io.on('connection', (socket) => {
 *   // Events only work within this container ❌
 *   io.to('room123').emit('event', data);
 * });
 * ```
 *
 * NEW (v5.0.0):
 * ```typescript
 * const io = socketIo(httpServer, { cors: { origin: '*' } });
 *
 * // ADD THIS - Initialize adapter BEFORE connection handlers
 * await setupRedisAdapter(io, {
 *   pubUrl: process.env.REDIS_URL!,
 *   verbose: process.env.NODE_ENV === 'development'
 * });
 *
 * io.on('connection', (socket) => {
 *   // Events now work across ALL containers ✅
 *   io.to('room123').emit('event', data);
 *   // User in Container A receives events from Container B
 * });
 * ```
 *
 * TESTING:
 * 1. Deploy 2 Cloud Run containers
 * 2. User A connects to Container 1
 * 3. User B connects to Container 2
 * 4. User A emits event to room → User B receives it ✅
 *
 * MONITORING:
 * ```typescript
 * setInterval(() => {
 *   const stats = getAdapterStats(io);
 *   console.log('Cluster size:', stats?.serverCount || 1);
 * }, 60000); // Log every minute
 * ```
 */
