#!/bin/sh

# Don't exit on errors - let server handle them
echo "🚀 Container starting..."
echo "PORT is set to: ${PORT:-not set}"
echo "NODE_ENV is set to: ${NODE_ENV:-not set}"

# Run migrations in background (non-blocking, fire and forget)
# Delayed by 15 seconds to let server establish initial connection first
(
  sleep 15
  echo "🔄 Running database migrations in background..."
  npx prisma migrate deploy > /tmp/migrate.log 2>&1 && echo "✅ Migrations completed" || echo "⚠️ Migration skipped or failed"
) &

# Start server in foreground
echo "✅ Starting server on port ${PORT:-3000}..."
exec node server.js
