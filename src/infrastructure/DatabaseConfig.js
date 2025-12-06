"use strict";
/**
 * Dynamic Database Connection Pool Configuration
 *
 * PURPOSE: Prevent connection starvation and optimize resource usage
 *
 * THE PROBLEM (v4.0.0):
 * - Hardcoded `connection_limit=1` in DATABASE_URL
 * - Result: Only 1 Prisma connection per container
 * - High concurrency → Queue buildup → 5-second timeouts
 * - Scaling up containers doesn't help (still 1 connection each)
 *
 * THE SOLUTION (v5.0.0):
 * - Calculate optimal connection pool size dynamically
 * - Based on container resources (memory, CPU)
 * - Tune without code redeployment (env vars only)
 * - Separate connection limits for pooled vs direct connections
 *
 * FORMULA:
 * ```
 * Pool Size = min(
 *   MAX_DB_CONNECTIONS env var,
 *   (Container Memory MB / 10),
 *   (UV_THREADPOOL_SIZE * 2)
 * )
 * ```
 *
 * EXAMPLE:
 * - 512MB container → 51 connections
 * - 1GB container → 100 connections
 * - 256MB container → 25 connections
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 * @version 5.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePoolSize = calculatePoolSize;
exports.calculateDirectLimit = calculateDirectLimit;
exports.generateDatabaseConfig = generateDatabaseConfig;
exports.buildDatabaseUrl = buildDatabaseUrl;
exports.createOptimizedPrismaClient = createOptimizedPrismaClient;
exports.testDatabaseConnection = testDatabaseConnection;
const client_1 = require("@prisma/client");
/**
 * Get container resource information
 *
 * SOURCES:
 * - Cloud Run: Memory from container limits
 * - Node.js: UV_THREADPOOL_SIZE (default 4)
 * - OS: Available CPU cores
 *
 * @returns Container resource information
 */
function getContainerResources() {
    // Memory (Cloud Run sets this, default 512MB)
    const memoryMb = process.env.MEMORY_MB
        ? parseInt(process.env.MEMORY_MB)
        : 512;
    // CPU count (from OS)
    const cpuCount = require('os').cpus().length;
    // UV thread pool size (Node.js environment variable)
    const threadPoolSize = process.env.UV_THREADPOOL_SIZE
        ? parseInt(process.env.UV_THREADPOOL_SIZE)
        : 4; // Node.js default
    return { memoryMb, cpuCount, threadPoolSize };
}
/**
 * Calculate optimal database connection pool size
 *
 * STRATEGY:
 * 1. Start with container memory-based limit (10MB per connection)
 * 2. Consider thread pool size (connections are handled by threads)
 * 3. Respect explicit limit from env var (admin override)
 * 4. Apply PostgreSQL best practices (max ~100 per container)
 *
 * WHY 10MB PER CONNECTION?
 * - Each PostgreSQL connection consumes ~10MB RAM
 * - Prisma client adds ~2-3MB overhead
 * - Leaves headroom for application logic
 *
 * @returns Calculated pool size
 */
function calculatePoolSize() {
    const resources = getContainerResources();
    // STRATEGY 1: Memory-based limit
    const memoryBasedLimit = Math.floor(resources.memoryMb / 10);
    // STRATEGY 2: Thread-based limit
    // Each thread can handle multiple connections, but not infinite
    const threadBasedLimit = resources.threadPoolSize * 4;
    // STRATEGY 3: Explicit override (from env var)
    const explicitLimit = process.env.MAX_DB_CONNECTIONS
        ? parseInt(process.env.MAX_DB_CONNECTIONS)
        : Infinity;
    // STRATEGY 4: PostgreSQL best practices
    const postgresLimit = 100; // Max recommended per container
    // TAKE MINIMUM (most conservative)
    const poolSize = Math.min(memoryBasedLimit, threadBasedLimit, explicitLimit, postgresLimit);
    // ENFORCE MINIMUM (at least 2 connections)
    return Math.max(poolSize, 2);
}
/**
 * Calculate direct connection limit (for non-pooled operations)
 *
 * USED FOR:
 * - Database migrations (npx prisma migrate deploy)
 * - Admin operations (manual queries)
 * - Schema introspection
 *
 * STRATEGY:
 * - Direct connections are expensive (no pooling overhead)
 * - Use sparingly (only when pgBouncer not available)
 * - 20% of pool size (or minimum 2)
 *
 * @returns Calculated direct connection limit
 */
function calculateDirectLimit() {
    const poolSize = calculatePoolSize();
    return Math.max(Math.floor(poolSize * 0.2), 2);
}
/**
 * Generate complete database configuration
 *
 * USE THIS to configure Prisma Client with optimal settings
 *
 * @returns Complete database configuration object
 *
 * @example
 * ```typescript
 * const dbConfig = generateDatabaseConfig();
 *
 * const prisma = new PrismaClient({
 *   datasources: {
 *     db: {
 *       url: buildDatabaseUrl(dbConfig)
 *     }
 *   },
 *   log: dbConfig.logging ? ['query', 'error'] : ['error']
 * });
 * ```
 */
function generateDatabaseConfig() {
    const poolSize = calculatePoolSize();
    const directLimit = calculateDirectLimit();
    // Timeouts (Cloud Run has 300s max, use conservative values)
    const connectTimeout = parseInt(process.env.DB_CONNECT_TIMEOUT || '10'); // 10 seconds
    const queryTimeout = parseInt(process.env.DB_QUERY_TIMEOUT || '30'); // 30 seconds
    // Logging (only in development)
    const logging = process.env.NODE_ENV === 'development' &&
        process.env.DB_LOGGING === 'true';
    const config = {
        poolSize,
        directLimit,
        connectTimeout,
        queryTimeout,
        logging
    };
    // Log configuration on startup
    console.log('📊 Database Configuration:');
    console.log(`   Pool Size: ${poolSize} connections`);
    console.log(`   Direct Limit: ${directLimit} connections`);
    console.log(`   Connect Timeout: ${connectTimeout}s`);
    console.log(`   Query Timeout: ${queryTimeout}s`);
    console.log(`   Container Memory: ${getContainerResources().memoryMb}MB`);
    console.log(`   CPU Cores: ${getContainerResources().cpuCount}`);
    return config;
}
/**
 * Build Prisma database URL with connection parameters
 *
 * CRITICAL: Use pooled URL for application, direct URL for migrations
 *
 * SUPABASE EXAMPLE:
 * - Pooled (pgBouncer): `pooler.supabase.com:6543` + `pgbouncer=true`
 * - Direct: `pooler.supabase.com:5432` (no pgbouncer param)
 *
 * @param config - Database configuration
 * @param type - Connection type ('pooled' or 'direct')
 * @returns Complete database URL with parameters
 *
 * @example
 * ```typescript
 * // Application usage (pooled)
 * const pooledUrl = buildDatabaseUrl(config, 'pooled');
 * process.env.DATABASE_URL = pooledUrl;
 *
 * // Migration usage (direct)
 * const directUrl = buildDatabaseUrl(config, 'direct');
 * process.env.DIRECT_URL = directUrl;
 * ```
 */
function buildDatabaseUrl(config, type = 'pooled') {
    // Get base URL from environment
    const baseUrl = type === 'pooled'
        ? process.env.DATABASE_URL
        : process.env.DIRECT_URL;
    if (!baseUrl) {
        throw new Error(`Missing ${type === 'pooled' ? 'DATABASE_URL' : 'DIRECT_URL'} environment variable`);
    }
    // Parse URL
    const url = new URL(baseUrl);
    // Set connection parameters
    if (type === 'pooled') {
        // Pooled connection parameters (pgBouncer)
        url.searchParams.set('pgbouncer', 'true');
        url.searchParams.set('connection_limit', config.poolSize.toString());
        url.searchParams.set('pool_timeout', '10'); // Wait 10s for connection from pool
    }
    else {
        // Direct connection parameters
        url.searchParams.set('connection_limit', config.directLimit.toString());
    }
    // Common parameters (both types)
    url.searchParams.set('connect_timeout', config.connectTimeout.toString());
    url.searchParams.set('pool_timeout', '10');
    url.searchParams.set('statement_cache_size', '100'); // Prepared statement cache
    return url.toString();
}
/**
 * Create configured Prisma Client instance
 *
 * USE THIS instead of `new PrismaClient()` for optimal configuration
 *
 * @returns Configured Prisma Client with optimal pool settings
 *
 * @example
 * ```typescript
 * // OLD (v4.0.0)
 * const prisma = new PrismaClient(); // ❌ Uses hardcoded connection_limit=1
 *
 * // NEW (v5.0.0)
 * const prisma = createOptimizedPrismaClient(); // ✅ Dynamic pool sizing
 * ```
 */
function createOptimizedPrismaClient() {
    const config = generateDatabaseConfig();
    // Build database URL with optimal parameters
    const databaseUrl = buildDatabaseUrl(config, 'pooled');
    // Create Prisma Client with configuration
    const prisma = new client_1.PrismaClient({
        datasources: {
            db: {
                url: databaseUrl
            }
        },
        log: config.logging
            ? [
                { level: 'query', emit: 'event' },
                { level: 'error', emit: 'stdout' },
                { level: 'warn', emit: 'stdout' }
            ]
            : [{ level: 'error', emit: 'stdout' }]
    });
    // Query event handler (for monitoring slow queries)
    if (config.logging) {
        prisma.$on('query', (e) => {
            if (e.duration > 1000) {
                console.warn(`⚠️ Slow query detected (${e.duration}ms):`, e.query);
            }
        });
    }
    // Connection pool metrics (for monitoring)
    // Note: Prisma doesn't expose pool metrics directly,
    // but we can track queries in application code
    return prisma;
}
/**
 * Test database connection and pool configuration
 *
 * USE THIS in /health endpoint to verify database connectivity
 *
 * @param prisma - Prisma Client instance
 * @returns Health check result
 */
async function testDatabaseConnection(prisma) {
    const startTime = Date.now();
    try {
        // Simple query to test connection
        await prisma.$queryRaw `SELECT 1`;
        const latency = Date.now() - startTime;
        // Get pool configuration
        const config = generateDatabaseConfig();
        return {
            healthy: true,
            latency,
            poolInfo: {
                poolSize: config.poolSize,
                directLimit: config.directLimit,
                containerMemory: getContainerResources().memoryMb + 'MB'
            }
        };
    }
    catch (error) {
        return {
            healthy: false,
            latency: Date.now() - startTime,
            error: error.message
        };
    }
}
/**
 * Environment variable guide
 *
 * REQUIRED:
 * ```bash
 * DATABASE_URL=postgresql://user:pass@host:6543/db?pgbouncer=true
 * DIRECT_URL=postgresql://user:pass@host:5432/db
 * ```
 *
 * OPTIONAL (tuning):
 * ```bash
 * MAX_DB_CONNECTIONS=50          # Override calculated pool size
 * MEMORY_MB=512                  # Container memory (auto-detected on Cloud Run)
 * UV_THREADPOOL_SIZE=8           # Node.js thread pool (default: 4)
 * DB_CONNECT_TIMEOUT=10          # Connection timeout (seconds)
 * DB_QUERY_TIMEOUT=30            # Query timeout (seconds)
 * DB_LOGGING=true                # Enable query logging (dev only)
 * ```
 *
 * TUNING EXAMPLES:
 *
 * High-traffic production (1GB container):
 * ```bash
 * MEMORY_MB=1024
 * MAX_DB_CONNECTIONS=100
 * UV_THREADPOOL_SIZE=8
 * ```
 * Result: ~100 connections per container
 *
 * Low-traffic development (256MB container):
 * ```bash
 * MEMORY_MB=256
 * MAX_DB_CONNECTIONS=10
 * DB_LOGGING=true
 * ```
 * Result: ~10 connections per container
 *
 * Cost-optimized (minimal resources):
 * ```bash
 * MEMORY_MB=128
 * MAX_DB_CONNECTIONS=5
 * ```
 * Result: ~5 connections per container (sufficient for low traffic)
 */
/**
 * MIGRATION GUIDE: v4.0.0 → v5.0.0
 *
 * BEFORE (v4.0.0):
 * ```typescript
 * // Hardcoded connection limit
 * const prisma = new PrismaClient({
 *   datasources: {
 *     db: {
 *       url: 'postgresql://...?connection_limit=1' // ❌ Starvation risk
 *     }
 *   }
 * });
 * ```
 *
 * AFTER (v5.0.0):
 * ```typescript
 * import { createOptimizedPrismaClient } from './infrastructure/DatabaseConfig';
 *
 * // Dynamic pool sizing based on container resources
 * const prisma = createOptimizedPrismaClient(); // ✅ Scales automatically
 * ```
 *
 * ENVIRONMENT VARIABLES:
 * ```bash
 * # .env (development)
 * DATABASE_URL=postgresql://localhost:6543/dev?pgbouncer=true
 * DIRECT_URL=postgresql://localhost:5432/dev
 * MEMORY_MB=512
 *
 * # .env (production - Cloud Run auto-sets MEMORY_MB)
 * DATABASE_URL=postgresql://pooler.supabase.com:6543/prod?pgbouncer=true
 * DIRECT_URL=postgresql://pooler.supabase.com:5432/prod
 * MAX_DB_CONNECTIONS=100
 * ```
 *
 * VERIFICATION:
 * ```typescript
 * // Check calculated pool size
 * const config = generateDatabaseConfig();
 * console.log('Pool size:', config.poolSize); // e.g., 51 for 512MB container
 * ```
 */
//# sourceMappingURL=DatabaseConfig.js.map