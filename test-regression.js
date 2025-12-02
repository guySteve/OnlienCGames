// Comprehensive regression test for deployment issues
require('dotenv').config();

const tests = [];
let failedTests = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test 1: Prisma Client Import
test('Prisma Client can be imported', async () => {
  const { PrismaClient } = require('@prisma/client');
  assert(PrismaClient !== undefined, 'PrismaClient is undefined');
  console.log('  ✅ @prisma/client imported successfully');
});

// Test 2: Prisma Client Initialization
test('Prisma Client can be initialized', async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  assert(prisma !== null, 'Prisma instance is null');
  console.log('  ✅ PrismaClient initialized');
  await prisma.$disconnect();
});

// Test 3: Database Connection
test('Database connection works', async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    assert(result[0].test === 1, 'Query failed');
    console.log('  ✅ Database connected and queryable');
  } finally {
    await prisma.$disconnect();
  }
});

// Test 4: Environment Variables
test('Required environment variables are set', async () => {
  const required = [
    'DATABASE_URL',
    'DIRECT_URL',
    'SESSION_SECRET',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
  ];
  
  for (const key of required) {
    assert(process.env[key], `${key} is not set`);
    assert(!process.env[key].includes('your_'), `${key} contains placeholder value`);
  }
  console.log('  ✅ All required environment variables set');
});

// Test 5: Server Dependencies
test('Server can load all dependencies', async () => {
  const express = require('express');
  const http = require('http');
  const socketIo = require('socket.io');
  const cors = require('cors');
  const session = require('express-session');
  const passport = require('passport');
  
  assert(express !== undefined, 'express not loaded');
  assert(http !== undefined, 'http not loaded');
  assert(socketIo !== undefined, 'socket.io not loaded');
  assert(cors !== undefined, 'cors not loaded');
  assert(session !== undefined, 'express-session not loaded');
  assert(passport !== undefined, 'passport not loaded');
  
  console.log('  ✅ All server dependencies loaded');
});

// Test 6: Database Module
test('Database module exports work', async () => {
  const db = require('./src/db');
  
  assert(db.prisma !== undefined, 'prisma not exported');
  assert(db.checkDailyReset !== undefined, 'checkDailyReset not exported');
  assert(db.getOrCreateUser !== undefined, 'getOrCreateUser not exported');
  assert(db.updateUserChips !== undefined, 'updateUserChips not exported');
  assert(db.canUserPlay !== undefined, 'canUserPlay not exported');
  
  console.log('  ✅ Database module exports verified');
});

// Test 7: Prisma Schema Verification
test('Prisma schema models are accessible', async () => {
  const { prisma } = require('./src/db');
  
  // Check that all models can be accessed
  assert(prisma.user !== undefined, 'User model not found');
  assert(prisma.transaction !== undefined, 'Transaction model not found');
  assert(prisma.gameSession !== undefined, 'GameSession model not found');
  assert(prisma.achievement !== undefined, 'Achievement model not found');
  
  console.log('  ✅ All Prisma models accessible');
  await prisma.$disconnect();
});

// Test 8: Server can start (basic)
test('Express app can be created', async () => {
  const express = require('express');
  const app = express();
  
  app.get('/test', (req, res) => res.json({ ok: true }));
  
  assert(app !== null, 'Express app is null');
  console.log('  ✅ Express app created successfully');
});

// Test 9: Redis Connection
test('Redis connection works', async () => {
  const { Redis } = require('@upstash/redis');
  
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  
  const testKey = 'regression:test:' + Date.now();
  await redis.set(testKey, 'test-value', { ex: 10 });
  const value = await redis.get(testKey);
  await redis.del(testKey);
  
  assert(value === 'test-value', 'Redis read/write failed');
  console.log('  ✅ Redis connection verified');
});

// Test 10: File System Access
test('Required files are accessible', async () => {
  const fs = require('fs');
  const path = require('path');
  
  const files = [
    'server.js',
    'client.js',
    'index.html',
    'welcome.html',
    'package.json',
    'prisma/schema.prisma'
  ];
  
  for (const file of files) {
    const fullPath = path.join(__dirname, file);
    assert(fs.existsSync(fullPath), `${file} not found`);
  }
  
  console.log('  ✅ All required files accessible');
});

// Run all tests
async function runTests() {
  console.log('\n🔬 Running Regression Tests\n');
  console.log('='.repeat(60));
  
  for (const { name, fn } of tests) {
    try {
      console.log(`\n📋 ${name}`);
      await fn();
    } catch (error) {
      console.error(`  ❌ FAILED: ${error.message}`);
      console.error(`     ${error.stack}`);
      failedTests++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${tests.length - failedTests}/${tests.length} tests passed`);
  
  if (failedTests > 0) {
    console.log(`\n⚠️  ${failedTests} test(s) failed`);
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('\n💥 Test runner error:', err);
  process.exit(1);
});
