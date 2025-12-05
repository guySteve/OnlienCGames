/**
 * LOAD TESTING - Simulate concurrent players
 * Tests: API endpoints, Socket.io connections, database load
 * Target: 100 concurrent users, 1000 requests over 60 seconds
 */

const http = require('http');
const io = require('socket.io-client');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const CONCURRENT_USERS = parseInt(process.env.LOAD_TEST_USERS) || 100;
const TEST_DURATION_MS = parseInt(process.env.LOAD_TEST_DURATION) || 60000;

const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  socketConnections: 0,
  socketDisconnects: 0,
  errors: []
};

// Simulate API request
function makeRequest(path, method = 'GET') {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const req = http.request({
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 3000,
      path: path,
      method: method
    }, (res) => {
      const duration = Date.now() - startTime;
      
      stats.totalRequests++;
      stats.totalResponseTime += duration;
      stats.minResponseTime = Math.min(stats.minResponseTime, duration);
      stats.maxResponseTime = Math.max(stats.maxResponseTime, duration);
      
      if (res.statusCode >= 200 && res.statusCode < 400) {
        stats.successfulRequests++;
      } else {
        stats.failedRequests++;
      }
      
      resolve({ statusCode: res.statusCode, duration });
    });
    
    req.on('error', (err) => {
      stats.failedRequests++;
      stats.errors.push(`Request error: ${err.message}`);
      resolve({ error: err.message });
    });
    
    req.end();
  });
}

// Simulate Socket.io user
function simulateUser(userId) {
  return new Promise((resolve) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    
    socket.on('connect', () => {
      stats.socketConnections++;
      
      // Simulate user actions
      socket.emit('join-lobby', { userId: `load-test-${userId}` });
      
      setTimeout(() => {
        socket.emit('chat-message', { 
          message: `Load test message ${userId}`,
          roomId: 'lobby'
        });
      }, Math.random() * 5000);
      
      // Random disconnect
      const disconnectTime = Math.random() * (TEST_DURATION_MS / 2);
      setTimeout(() => {
        socket.disconnect();
        stats.socketDisconnects++;
        resolve();
      }, disconnectTime);
    });
    
    socket.on('connect_error', (err) => {
      stats.errors.push(`Socket error: ${err.message}`);
      resolve();
    });
  });
}

// Run load test
async function runLoadTest() {
  console.log('🔥 LOAD TEST STARTING...');
  console.log(`Target: ${CONCURRENT_USERS} concurrent users`);
  console.log(`Duration: ${TEST_DURATION_MS / 1000}s`);
  console.log(`Base URL: ${BASE_URL}\n`);
  
  const startTime = Date.now();
  
  // Spawn concurrent users
  const userPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(i));
    
    // Stagger connections (10 users per second)
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Simulate continuous API requests
  const apiInterval = setInterval(async () => {
    await makeRequest('/health');
    await makeRequest('/');
  }, 500);
  
  // Wait for test duration
  await Promise.all([
    ...userPromises,
    new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS))
  ]);
  
  clearInterval(apiInterval);
  
  const endTime = Date.now();
  const totalDuration = (endTime - startTime) / 1000;
  
  // Calculate metrics
  const avgResponseTime = stats.totalResponseTime / stats.totalRequests;
  const successRate = (stats.successfulRequests / stats.totalRequests) * 100;
  const requestsPerSecond = stats.totalRequests / totalDuration;
  
  // Print results
  console.log('\n📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Duration:              ${totalDuration.toFixed(2)}s`);
  console.log(`Total Requests:        ${stats.totalRequests}`);
  console.log(`Successful:            ${stats.successfulRequests} (${successRate.toFixed(2)}%)`);
  console.log(`Failed:                ${stats.failedRequests}`);
  console.log(`Avg Response Time:     ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Min Response Time:     ${stats.minResponseTime}ms`);
  console.log(`Max Response Time:     ${stats.maxResponseTime}ms`);
  console.log(`Requests/Second:       ${requestsPerSecond.toFixed(2)}`);
  console.log(`Socket Connections:    ${stats.socketConnections}`);
  console.log(`Socket Disconnects:    ${stats.socketDisconnects}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
  }
  
  console.log('\n✅ PASS CRITERIA:');
  console.log(`   Avg Response Time < 200ms:  ${avgResponseTime < 200 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Success Rate > 95%:         ${successRate > 95 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Max Response Time < 2000ms: ${stats.maxResponseTime < 2000 ? '✅ PASS' : '❌ FAIL'}`);
  
  const passed = avgResponseTime < 200 && successRate > 95 && stats.maxResponseTime < 2000;
  
  if (passed) {
    console.log('\n✅ LOAD TEST PASSED\n');
    process.exit(0);
  } else {
    console.log('\n❌ LOAD TEST FAILED\n');
    process.exit(1);
  }
}

// Handle signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Load test interrupted');
  process.exit(1);
});

// Run
runLoadTest().catch((err) => {
  console.error('❌ Load test error:', err);
  process.exit(1);
});
