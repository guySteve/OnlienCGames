#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma db push --skip-generate --accept-data-loss

echo "✅ Migrations complete, starting server..."
exec node server.js
