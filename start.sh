#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy || echo "⚠️ Migration skipped or failed (may already be applied)"

echo "✅ Starting server..."
exec node server.js
