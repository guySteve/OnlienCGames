#!/bin/sh
set -e

echo "✅ Starting server..."

# Start server in background so it can accept health checks
node server.js &
SERVER_PID=$!

# Give server 5 seconds to start listening
sleep 5

# Run migrations in background (non-blocking)
echo "🔄 Running database migrations in background..."
npx prisma migrate deploy > /tmp/migrate.log 2>&1 && echo "✅ Migrations completed" || echo "⚠️ Migration skipped or failed" &

# Wait for server process
wait $SERVER_PID
