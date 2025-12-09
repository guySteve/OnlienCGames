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
export declare function setupRedisAdapter(io: SocketIOServer, config: RedisAdapterConfig): Promise<void>;
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
export declare function createScalableSocketIO(httpServer: HttpServer, redisConfig: RedisAdapterConfig, socketConfig?: Partial<ServerOptions>): Promise<SocketIOServer>;
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
export declare function getAdapterStats(io: SocketIOServer): any;
/**
 * Example: Health check using adapter stats
 *
 * ADD THIS to your /health endpoint
 */
export declare function checkAdapterHealth(io: SocketIOServer): {
    healthy: boolean;
    stats?: any;
    error?: string;
};
export {};
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
//# sourceMappingURL=SocketIOAdapter.d.ts.map