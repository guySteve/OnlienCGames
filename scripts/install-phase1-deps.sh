#!/bin/bash

# VegasCore v5.0.0 - Phase 1 Dependency Installation Script
#
# This script installs all required dependencies for:
# - Distributed Locking (Redlock)
# - Redis-First Architecture (ioredis)
# - TypeScript support

set -e

echo "🚀 VegasCore v5.0.0 - Phase 1 Dependency Installation"
echo "======================================================"

# Install production dependencies
echo ""
echo "📦 Installing production dependencies..."
npm install --save \
  redlock@^5.0.0-beta.2 \
  ioredis@^5.10.0 \
  @socket.io/redis-adapter@^8.3.0

# Install TypeScript types
echo ""
echo "📦 Installing TypeScript types..."
npm install --save-dev \
  @types/ioredis@^5.0.0

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "📋 Summary:"
echo "  - redlock: Distributed locking library (Redlock algorithm)"
echo "  - ioredis: High-performance Redis client"
echo "  - @socket.io/redis-adapter: Socket.IO horizontal scaling (Phase 2)"
echo ""
echo "🔧 Next Steps:"
echo "  1. Update .env with Redis URLs (see VEGASCORE_V5_PHASE1_SUMMARY.md)"
echo "  2. Initialize LockManager in server.js"
echo "  3. Refactor game engines to extend BaseGameEngine.v5"
echo ""
echo "📖 Documentation:"
echo "  - Implementation Guide: docs/PHASE1_IMPLEMENTATION_GUIDE.md"
echo "  - Summary: VEGASCORE_V5_PHASE1_SUMMARY.md"
echo ""
