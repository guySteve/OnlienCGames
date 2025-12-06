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
import { PrismaClient } from '@prisma/client';
/**
 * Database configuration interface
 */
export interface DatabaseConfig {
    /** Connection pool size (for pgBouncer/pooled connections) */
    poolSize: number;
    /** Direct connection limit (for migrations, admin tasks) */
    directLimit: number;
    /** Connection timeout in milliseconds */
    connectTimeout: number;
    /** Query timeout in milliseconds */
    queryTimeout: number;
    /** Enable query logging (development only) */
    logging: boolean;
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
export declare function calculatePoolSize(): number;
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
export declare function calculateDirectLimit(): number;
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
export declare function generateDatabaseConfig(): DatabaseConfig;
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
export declare function buildDatabaseUrl(config: DatabaseConfig, type?: 'pooled' | 'direct'): string;
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
export declare function createOptimizedPrismaClient(): PrismaClient;
/**
 * Test database connection and pool configuration
 *
 * USE THIS in /health endpoint to verify database connectivity
 *
 * @param prisma - Prisma Client instance
 * @returns Health check result
 */
export declare function testDatabaseConnection(prisma: PrismaClient): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
    poolInfo?: any;
}>;
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
//# sourceMappingURL=DatabaseConfig.d.ts.map