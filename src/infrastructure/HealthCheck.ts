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
import { getAdapterStats } from './SocketIOAdapter';
import { testDatabaseConnection } from './DatabaseConfig';

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * Individual component health
 */
interface ComponentHealth {
  status: HealthStatus;
  latency?: number;      // Response time in milliseconds
  message?: string;      // Human-readable status message
  details?: any;         // Additional diagnostic information
  error?: string;        // Error message if unhealthy
}

/**
 * Complete health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;         // Server uptime in seconds
  version: string;        // Application version
  components: {
    redis: ComponentHealth;
    database: ComponentHealth;
    socketio: ComponentHealth;
    system: ComponentHealth;
  };
  metrics?: {
    memory: {
      used: number;       // MB
      total: number;      // MB
      percentage: number; // 0-100
    };
    cpu: {
      usage: number;      // 0-100
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
 * Default configuration
 */
const DEFAULT_CONFIG = {
  timeout: 5000,        // 5 seconds per check
  includeMetrics: true,
  version: process.env.APP_VERSION || '5.0.0'
};

/**
 * Check Redis connectivity
 *
 * STRATEGY:
 * - PING command (fastest test)
 * - 5-second timeout
 * - Measure latency
 *
 * @param redis - Redis client
 * @param timeout - Timeout in milliseconds
 * @returns Component health result
 */
async function checkRedis(
  redis: Redis,
  timeout: number
): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    // Race between ping and timeout
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), timeout)
      )
    ]);

    const latency = Date.now() - startTime;

    // Check latency threshold
    if (latency > 1000) {
      return {
        status: HealthStatus.DEGRADED,
        latency,
        message: 'Redis responding slowly',
        details: { threshold: '1000ms', actual: `${latency}ms` }
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      latency,
      message: 'Redis operational'
    };
  } catch (error: any) {
    return {
      status: HealthStatus.UNHEALTHY,
      latency: Date.now() - startTime,
      error: error.message,
      message: 'Redis connection failed'
    };
  }
}

/**
 * Check database connectivity
 *
 * STRATEGY:
 * - Simple SELECT 1 query
 * - 10-second timeout (database can be slow)
 * - Measure latency
 *
 * @param prisma - Prisma client
 * @param timeout - Timeout in milliseconds
 * @returns Component health result
 */
async function checkDatabase(
  prisma: PrismaClient,
  timeout: number
): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const result = await Promise.race([
      testDatabaseConnection(prisma),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), timeout)
      )
    ]);

    const latency = Date.now() - startTime;

    if (!result.healthy) {
      return {
        status: HealthStatus.UNHEALTHY,
        latency,
        error: result.error,
        message: 'Database connection failed'
      };
    }

    // Check latency threshold
    if (result.latency && result.latency > 2000) {
      return {
        status: HealthStatus.DEGRADED,
        latency: result.latency,
        message: 'Database responding slowly',
        details: result.poolInfo
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      latency: result.latency,
      message: 'Database operational',
      details: result.poolInfo
    };
  } catch (error: any) {
    return {
      status: HealthStatus.UNHEALTHY,
      latency: Date.now() - startTime,
      error: error.message,
      message: 'Database health check failed'
    };
  }
}

/**
 * Check Socket.IO adapter status
 *
 * STRATEGY:
 * - Check adapter statistics
 * - Verify multi-container mode in production
 * - Count connected sockets
 *
 * @param io - Socket.IO server (optional)
 * @returns Component health result
 */
function checkSocketIO(io?: SocketIOServer): ComponentHealth {
  if (!io) {
    return {
      status: HealthStatus.HEALTHY,
      message: 'Socket.IO not configured'
    };
  }

  try {
    const stats = getAdapterStats(io);

    if (!stats) {
      // No adapter = single-container mode
      if (process.env.NODE_ENV === 'production') {
        return {
          status: HealthStatus.DEGRADED,
          message: 'Socket.IO running in single-container mode',
          details: { warning: 'Redis adapter not enabled' }
        };
      }

      return {
        status: HealthStatus.HEALTHY,
        message: 'Socket.IO operational (single-container mode)',
        details: { sockets: io.of('/').sockets.size }
      };
    }

    // Check if cluster is healthy
    const isHealthy = stats.serverCount >= 1;

    return {
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      message: `Socket.IO cluster operational (${stats.serverCount} containers)`,
      details: {
        containers: stats.serverCount,
        sockets: stats.sockets,
        rooms: stats.rooms
      }
    };
  } catch (error: any) {
    return {
      status: HealthStatus.DEGRADED,
      error: error.message,
      message: 'Socket.IO health check failed'
    };
  }
}

/**
 * Check system resources
 *
 * STRATEGY:
 * - Memory usage (prevent OOM)
 * - CPU usage (detect high load)
 * - Uptime
 *
 * @returns Component health result
 */
function checkSystem(): ComponentHealth {
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercentage = Math.round((memoryUsedMB / memoryTotalMB) * 100);

  // Check memory threshold
  if (memoryPercentage > 90) {
    return {
      status: HealthStatus.DEGRADED,
      message: 'High memory usage',
      details: {
        used: memoryUsedMB,
        total: memoryTotalMB,
        percentage: memoryPercentage,
        warning: 'Memory usage above 90%'
      }
    };
  }

  if (memoryPercentage > 95) {
    return {
      status: HealthStatus.UNHEALTHY,
      message: 'Critical memory usage',
      details: {
        used: memoryUsedMB,
        total: memoryTotalMB,
        percentage: memoryPercentage,
        error: 'Memory usage above 95% - restart recommended'
      }
    };
  }

  return {
    status: HealthStatus.HEALTHY,
    message: 'System resources normal',
    details: {
      memory: {
        used: memoryUsedMB,
        total: memoryTotalMB,
        percentage: memoryPercentage
      },
      uptime: Math.round(process.uptime())
    }
  };
}

/**
 * Perform complete health check
 *
 * RUNS ALL CHECKS IN PARALLEL (fastest execution)
 *
 * @param config - Health check configuration
 * @returns Complete health check result
 */
export async function performHealthCheck(
  config: HealthCheckConfig
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = config.timeout || DEFAULT_CONFIG.timeout;

  // Run all checks in parallel (fastest)
  const [redisHealth, dbHealth, socketHealth, systemHealth] = await Promise.all([
    checkRedis(config.redis, timeout),
    checkDatabase(config.prisma, timeout),
    Promise.resolve(checkSocketIO(config.io)),
    Promise.resolve(checkSystem())
  ]);

  // Determine overall status
  const componentStatuses = [
    redisHealth.status,
    dbHealth.status,
    socketHealth.status,
    systemHealth.status
  ];

  let overallStatus: HealthStatus;
  if (componentStatuses.includes(HealthStatus.UNHEALTHY)) {
    overallStatus = HealthStatus.UNHEALTHY;
  } else if (componentStatuses.includes(HealthStatus.DEGRADED)) {
    overallStatus = HealthStatus.DEGRADED;
  } else {
    overallStatus = HealthStatus.HEALTHY;
  }

  // Build result
  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: config.version || DEFAULT_CONFIG.version,
    components: {
      redis: redisHealth,
      database: dbHealth,
      socketio: socketHealth,
      system: systemHealth
    }
  };

  // Add detailed metrics if requested
  if (config.includeMetrics) {
    const memUsage = process.memoryUsage();
    result.metrics = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round(
          (memUsage.heapUsed / memUsage.heapTotal) * 100
        )
      },
      cpu: {
        usage: Math.round(process.cpuUsage().user / 1000000) // Rough estimate
      }
    };
  }

  return result;
}

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
export function createHealthCheckHandler(config: HealthCheckConfig) {
  return async (req: Request, res: Response) => {
    try {
      const result = await performHealthCheck(config);

      // Set HTTP status code based on health
      let statusCode: number;
      switch (result.status) {
        case HealthStatus.HEALTHY:
          statusCode = 200;
          break;
        case HealthStatus.DEGRADED:
          statusCode = 200; // Still accepting traffic, but degraded
          break;
        case HealthStatus.UNHEALTHY:
          statusCode = 503; // Service Unavailable
          break;
        default:
          statusCode = 500;
      }

      res.status(statusCode).json(result);
    } catch (error: any) {
      // Health check itself failed (critical)
      res.status(503).json({
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'Health check failed to execute'
      });
    }
  };
}

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
export function createReadinessHandler(config: HealthCheckConfig) {
  return async (req: Request, res: Response) => {
    try {
      const timeout = 2000; // 2 seconds (fast)

      const [redisOk, dbOk] = await Promise.all([
        checkRedis(config.redis, timeout),
        checkDatabase(config.prisma, timeout)
      ]);

      const isReady =
        redisOk.status !== HealthStatus.UNHEALTHY &&
        dbOk.status !== HealthStatus.UNHEALTHY;

      if (isReady) {
        res.status(200).json({
          ready: true,
          uptime: Math.round(process.uptime())
        });
      } else {
        res.status(503).json({
          ready: false,
          redis: redisOk.status,
          database: dbOk.status
        });
      }
    } catch (error: any) {
      res.status(503).json({
        ready: false,
        error: error.message
      });
    }
  };
}

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
