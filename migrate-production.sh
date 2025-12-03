#!/bin/bash
# One-time migration script for production database
# Run this BEFORE deploying the new code

echo "🔄 Connecting to production database..."
echo "⚠️  This will update the database schema"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Cancelled"
    exit 1
fi

echo "🔄 Running migrations..."
npx prisma db push --skip-generate --accept-data-loss

echo "✅ Migration complete!"
echo ""
echo "Now you can deploy with: git push origin main"
