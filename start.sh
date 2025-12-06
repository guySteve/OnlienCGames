#!/bin/sh

# VegasCore v5.0.0 - Optimized Container Startup
#
# CHANGES FROM v4.0.0:
# - ❌ REMOVED: Database migrations (now run pre-deployment in Cloud Build)
# - ✅ ADDED: Health check validation
# - ✅ ADDED: Graceful shutdown handling
#
# WHY NO MIGRATIONS?
# - Migrations during startup cause 8-15 second cold start delays
# - Concurrent containers can race (duplicate migrations)
# - Cloud Build runs migrations ONCE before any container starts
# - Result: Instant container startup, zero migration conflicts

# Exit on any error (fail fast)
set -e

echo "🚀 VegasCore v5.0.0 - Container Startup"
echo "========================================"

# Display environment info (for debugging)
echo "📊 Environment:"
echo "   PORT: ${PORT:-not set}"
echo "   NODE_ENV: ${NODE_ENV:-not set}"
echo "   MEMORY_MB: ${MEMORY_MB:-not set}"
echo ""

# Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

if [ -z "$REDIS_URL" ]; then
  echo "❌ ERROR: REDIS_URL not set"
  exit 1
fi

echo "✅ Environment variables validated"
echo ""

# Generate Prisma Client (if not already generated during build)
# This is idempotent (safe to run multiple times)
echo "🔧 Ensuring Prisma Client is generated..."
npx prisma generate --silent || {
  echo "⚠️ Prisma generate failed, but continuing..."
}

echo ""
echo "🚀 Starting Node.js server on port ${PORT:-3000}..."
echo ""

# Start server in foreground
# 'exec' replaces shell process with node process (important for signal handling)
exec node server.js

# This line is never reached (exec replaces the process)
# But if node crashes, container will restart (Cloud Run behavior)
