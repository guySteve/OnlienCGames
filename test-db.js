// System connection test - Database + Redis + OAuth Config
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');

const prisma = new PrismaClient();

async function testConnections() {
  console.log('🔍 VegasCore System Check\n');
  let allGood = true;

  // Test 1: Database
  try {
    console.log('🔄 Testing Supabase Database...');
    const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
    const userCount = await prisma.user.count();
    const achievementCount = await prisma.achievement.count();
    
    console.log('✅ Database connected successfully!');
    console.log(`   📊 Database: ${result[0].current_database}`);
    console.log(`   👤 User: ${result[0].current_user}`);
    console.log(`   📋 Users: ${userCount} | Achievements: ${achievementCount}`);
  } catch (error) {
    console.error('❌ Database failed:', error.message);
    allGood = false;
  }

  // Test 2: Redis
  try {
    console.log('\n🔄 Testing Upstash Redis...');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    // Test write and read
    const testKey = 'vegascore:test';
    await redis.set(testKey, 'connected', { ex: 10 });
    const value = await redis.get(testKey);
    await redis.del(testKey);
    
    if (value === 'connected') {
      console.log('✅ Redis connected successfully!');
      console.log('   ⚡ Read/Write operations working');
    } else {
      throw new Error('Redis test failed');
    }
  } catch (error) {
    console.error('❌ Redis failed:', error.message);
    allGood = false;
  }

  // Test 3: Environment Config
  console.log('\n🔄 Checking configuration...');
  const checks = [
    { name: 'Database URL', key: 'DATABASE_URL', required: true },
    { name: 'Direct URL', key: 'DIRECT_URL', required: true },
    { name: 'Session Secret', key: 'SESSION_SECRET', required: true },
    { name: 'Redis URL', key: 'UPSTASH_REDIS_REST_URL', required: true },
    { name: 'Redis Token', key: 'UPSTASH_REDIS_REST_TOKEN', required: true },
    { name: 'Google Client ID', key: 'GOOGLE_CLIENT_ID', required: true },
    { name: 'Google Secret', key: 'GOOGLE_CLIENT_SECRET', required: false },
  ];

  checks.forEach(check => {
    const value = process.env[check.key];
    const isSet = value && !value.includes('your_') && !value.includes('YOUR_');
    
    if (isSet) {
      console.log(`✅ ${check.name} configured`);
    } else if (check.required) {
      console.log(`⚠️  ${check.name} not configured`);
      if (check.key === 'GOOGLE_CLIENT_SECRET') {
        allGood = false;
      }
    } else {
      console.log(`⏳ ${check.name} pending`);
    }
  });

  // Final status
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('✨ All systems operational! Ready to deploy.');
  } else {
    console.log('⚠️  Some systems need attention (see above)');
  }
  console.log('='.repeat(50) + '\n');

  await prisma.$disconnect();
  process.exit(allGood ? 0 : 1);
}

testConnections();
