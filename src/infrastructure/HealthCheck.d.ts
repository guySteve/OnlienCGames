/**
 * Comprehensive Health Check System
 *
 * PURPOSE: Verify all critical systems are operational
 *
 * WHY HEALTH CHECKS MATTER:
 * - Cloud Run needs this to know when container is ready for traffic
 * - Load balancer uses this for routing decisions
 * - Prevents routing traffic to unhealthy containers
 * - Enables zero-downtime deployments
 *
 * CHECKS PERFORMED:
 * 1. Redis connectivity (ping test)
 * 2. Database connectivity (query test)
 * 3. Socket.IO adapter status
 * 4. Memory usage (prevent OOM)
 * 5. CPU usage (detect high load)
 *
 * RESPONSE CODES:
 * - 200: All systems operational
 * - 503: Critical system failure (container should be restarted)
 * - 429: System under high load (backoff recommended)
 *
 * @version 5.0.0
 */
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { Request, Response } from 'express';
/**
 * Health status levels
 */
export declare enum HealthStatus {
    HEALTHY = "healthy",
    DEGRADED = "degraded",
    UNHEALTHY = "unhealthy"
}
/**
 * Individual component health
 */
interface ComponentHealth {
    status: HealthStatus;
    latency?: number;
    message?: string;
    details?: any;
    error?: string;
}
/**
 * Complete health check result
 */
export interface HealthCheckResult {
    status: HealthStatus;
    timestamp: string;
    uptime: number;
    version: string;
    components: {
        redis: ComponentHealth;
        database: ComponentHealth;
        socketio: ComponentHealth;
        system: ComponentHealth;
    };
    metrics?: {
        memory: {
            used: number;
            total: number;
            percentage: number;
        };
        cpu: {
            usage: number;
        };
    };
}
/**
 * Health check configuration
 */
interface HealthCheckConfig {
    /** Redis client for connectivity checks */
    redis: Redis;
    /** Prisma client for database checks */
    prisma: PrismaClient;
    /** Socket.IO server (optional, for adapter checks) */
    io?: SocketIOServer;
    /** Timeout for each check in milliseconds */
    timeout?: number;
    /** Include detailed metrics (disable in production for performance) */
    includeMetrics?: boolean;
    /** Application version string */
    version?: string;
}
/**
 * Perform complete health check
 *
 * RUNS ALL CHECKS IN PARALLEL (fastest execution)
 *
 * @param config - Health check configuration
 * @returns Complete health check result
 */
export declare function performHealthCheck(config: HealthCheckConfig): Promise<HealthCheckResult>;
/**
 * Express middleware for /health endpoint
 *
 * USE THIS in server.js:
 * ```typescript
 * app.get('/health', createHealthCheckHandler({
 *   redis: redisClient,
 *   prisma,
 *   io
 * }));
 * ```
 *
 * @param config - Health check configuration
 * @returns Express request handler
 */
export declare function createHealthCheckHandler(config: HealthCheckConfig): (_req: Request, res: Response) => Promise<void>;
/**
 * Lightweight readiness check (Cloud Run startup probe)
 *
 * USE THIS for /ready endpoint (faster than /health)
 *
 * Only checks critical components (Redis + Database)
 * Does NOT include metrics (performance)
 *
 * @param config - Health check configuration
 * @returns Express request handler
 */
export declare function createReadinessHandler(config: HealthCheckConfig): (_req: Request, res: Response) => Promise<void>;
export {};
/**
 * USAGE EXAMPLE (server.js):
 *
 * ```typescript
 * import { createHealthCheckHandler, createReadinessHandler } from './infrastructure/HealthCheck';
 * import { Redis } from 'ioredis';
 * import { PrismaClient } from '@prisma/client';
 * import { Server } from 'socket.io';
 *
 * const redis = new Redis(process.env.REDIS_URL);
 * const prisma = new PrismaClient();
 * const io = new Server(httpServer);
 *
 * // Comprehensive health check (for monitoring)
 * app.get('/health', createHealthCheckHandler({
 *   redis,
 *   prisma,
 *   io,
 *   timeout: 5000,
 *   includeMetrics: true,
 *   version: '5.0.0'
 * }));
 *
 * // Fast readiness check (for Cloud Run)
 * app.get('/ready', createReadinessHandler({
 *   redis,
 *   prisma
 * }));
 * ```
 *
 * CLOUD RUN CONFIGURATION:
 *
 * ```yaml
 * # cloudbuild.yaml
 * - '--health-check-path=/ready'
 * - '--startup-probe-period=10'
 * - '--startup-probe-timeout=3'
 * - '--startup-probe-failure-threshold=3'
 * ```
 *
 * MONITORING:
 *
 * ```typescript
 * // Periodic health check logging
 * setInterval(async () => {
 *   const health = await performHealthCheck({ redis, prisma, io });
 *   if (health.status !== HealthStatus.HEALTHY) {
 *     console.error('⚠️ Health check failed:', health);
 *   }
 * }, 60000); // Every minute
 * ```
 */
//# sourceMappingURL=HealthCheck.d.ts.map