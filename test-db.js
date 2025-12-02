// Quick database connection test
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Test query
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    console.log('✅ Database connected successfully!');
    console.log('📊 Database:', result[0].current_database);
    console.log('👤 User:', result[0].current_user);
    
    // Count existing tables
    const userCount = await prisma.user.count();
    const achievementCount = await prisma.achievement.count();
    
    console.log('\n📋 Tables verified:');
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Achievements: ${achievementCount}`);
    
    console.log('\n✨ All systems ready!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
