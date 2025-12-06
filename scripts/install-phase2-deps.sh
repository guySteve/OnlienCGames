#!/bin/bash

# VegasCore v5.0.0 - Phase 2 Dependency Installation Script
#
# Installs infrastructure & scalability dependencies:
# - Socket.IO Redis Adapter (horizontal scaling)
# - ioredis (high-performance Redis client)
# - TypeScript types

set -e

echo "🚀 VegasCore v5.0.0 - Phase 2 Dependency Installation"
echo "========================================================"
echo ""

# Check if Phase 1 dependencies are installed
echo "🔍 Checking Phase 1 dependencies..."
if ! npm list redlock > /dev/null 2>&1; then
  echo "⚠️  WARNING: Phase 1 dependencies not found"
  echo "   Run ./scripts/install-phase1-deps.sh first"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Install production dependencies
echo "📦 Installing production dependencies..."
npm install --save \
  @socket.io/redis-adapter@^8.3.0 \
  ioredis@^5.10.0

# Check if TypeScript types are needed
if [ -f "tsconfig.json" ]; then
  echo ""
  echo "📦 Installing TypeScript types..."
  npm install --save-dev \
    @types/ioredis@^5.0.0
fi

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "📋 Phase 2 Components:"
echo "  - @socket.io/redis-adapter: Cross-container Socket.IO communication"
echo "  - ioredis: High-performance Redis client"
echo ""
echo "🔧 Next Steps:"
echo "  1. Update .env with REDIS_URL (see VEGASCORE_V5_PHASE2_SUMMARY.md)"
echo "  2. Configure Cloud Build substitution variables"
echo "  3. Integrate into server.js (see docs/PHASE2_INTEGRATION_GUIDE.md)"
echo "  4. Deploy to Cloud Run"
echo ""
echo "📖 Documentation:"
echo "  - Summary: VEGASCORE_V5_PHASE2_SUMMARY.md"
echo "  - Integration: docs/PHASE2_INTEGRATION_GUIDE.md"
echo ""
echo "🎯 Phase 2 Goals:"
echo "  ✅ Unlimited horizontal scaling (N containers)"
echo "  ✅ Dynamic database connection pooling"
echo "  ✅ Instant container startup (< 2s)"
echo "  ✅ Production-ready health checks"
echo ""
