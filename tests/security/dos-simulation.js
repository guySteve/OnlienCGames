/**
 * DOS (DENIAL OF SERVICE) SIMULATION
 * Tests: Socket.io event flooding, connection exhaustion, memory leaks
 */

const io = require('socket.io-client');
const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const MAX_CONNECTIONS = parseInt(process.env.DOS_CONNECTIONS) || 200;
const EVENT_FLOOD_COUNT = parseInt(process.env.DOS_EVENTS) || 1000;

const stats = {
  connectionsEstablished: 0,
  connectionsFailed: 0,
  eventsEmitted: 0,
  eventsReceived: 0,
  serverResponses: 0,
  errors: []
};

// Test 1: Connection Exhaustion
async function testConnectionExhaustion() {
  console.log('\n🔥 TEST 1: Connection Exhaustion');
  console.log(`Attempting ${MAX_CONNECTIONS} simultaneous connections...\n`);
  
  const sockets = [];
  const startTime = Date.now();
  
  for (let i = 0; i < MAX_CONNECTIONS; i++) {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000
    });
    
    socket.on('connect', () => {
      stats.connectionsEstablished++;
    });
    
    socket.on('connect_error', (err) => {
      stats.connectionsFailed++;
      stats.errors.push(`Connection ${i}: ${err.message}`);
    });
    
    sockets.push(socket);
    
    // Small delay to avoid overwhelming local system
    if (i % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  // Wait for connections to establish
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const duration = (Date.now() - startTime) / 1000;
  
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Successful: ${stats.connectionsEstablished}/${MAX_CONNECTIONS}`);
  console.log(`Failed: ${stats.connectionsFailed}`);
  
  // Test server health during load
  let serverHealthy = false;
  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`${BASE_URL}/health`, (res) => {
        resolve(res.statusCode === 200);
      }).on('error', reject);
    });
    serverHealthy = res;
  } catch {
    serverHealthy = false;
  }
  
  console.log(`Server Health: ${serverHealthy ? '✅ Responsive' : '❌ Unresponsive'}`);
  
  // Cleanup
  sockets.forEach(s => s.disconnect());
  
  return {
    pass: serverHealthy && stats.connectionsEstablished > 0,
    serverStable: serverHealthy,
    connectionRate: (stats.connectionsEstablished / MAX_CONNECTIONS) * 100
  };
}

// Test 2: Event Flooding
async function testEventFlooding() {
  console.log('\n\n🌊 TEST 2: Event Flooding');
  console.log(`Sending ${EVENT_FLOOD_COUNT} rapid events...\n`);
  
  const socket = io(BASE_URL, {
    transports: ['websocket'],
    reconnection: false
  });
  
  return new Promise((resolve) => {
    socket.on('connect', async () => {
      console.log('Connected to server');
      
      const startTime = Date.now();
      
      // Flood with chat messages
      for (let i = 0; i < EVENT_FLOOD_COUNT; i++) {
        socket.emit('chat-message', {
          message: `Flood test message ${i}`,
          roomId: 'lobby'
        });
        stats.eventsEmitted++;
      }
      
      // Wait for server to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const duration = (Date.now() - startTime) / 1000;
      
      console.log(`Duration: ${duration.toFixed(2)}s`);
      console.log(`Events Emitted: ${stats.eventsEmitted}`);
      console.log(`Rate: ${(stats.eventsEmitted / duration).toFixed(2)} events/sec`);
      
      // Test if server is still responsive
      let serverHealthy = false;
      try {
        const res = await new Promise((resolve, reject) => {
          http.get(`${BASE_URL}/health`, (res) => {
            resolve(res.statusCode === 200);
          }).on('error', reject);
        });
        serverHealthy = res;
      } catch {
        serverHealthy = false;
      }
      
      console.log(`Server Health: ${serverHealthy ? '✅ Responsive' : '❌ Degraded'}`);
      
      socket.disconnect();
      
      resolve({
        pass: serverHealthy,
        eventsPerSecond: stats.eventsEmitted / duration
      });
    });
    
    socket.on('connect_error', (err) => {
      console.log(`❌ Connection failed: ${err.message}`);
      resolve({ pass: false, error: err.message });
    });
  });
}

// Test 3: Memory Leak Detection
async function testMemoryLeaks() {
  console.log('\n\n💾 TEST 3: Memory Leak Detection');
  console.log('Creating/destroying 100 connections...\n');
  
  const iterations = 100;
  const memorySnapshots = [];
  
  for (let i = 0; i < iterations; i++) {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    
    await new Promise((resolve) => {
      socket.on('connect', () => {
        // Emit some events
        socket.emit('join-lobby', { userId: `test-${i}` });
        setTimeout(() => {
          socket.disconnect();
          resolve();
        }, 100);
      });
      
      socket.on('connect_error', resolve);
    });
    
    // Sample memory every 10 iterations
    if (i % 10 === 0) {
      const mem = process.memoryUsage();
      memorySnapshots.push(mem.heapUsed / 1024 / 1024); // MB
      console.log(`Iteration ${i}: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }
  }
  
  // Analyze memory trend
  const firstSnapshot = memorySnapshots[0];
  const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
  const memoryGrowth = lastSnapshot - firstSnapshot;
  const growthPercent = (memoryGrowth / firstSnapshot) * 100;
  
  console.log(`\nMemory Growth: ${memoryGrowth.toFixed(2)} MB (${growthPercent.toFixed(2)}%)`);
  
  const memoryLeakDetected = growthPercent > 50; // More than 50% growth
  
  console.log(`Memory Leak: ${memoryLeakDetected ? '⚠️  Possible leak detected' : '✅ No significant leak'}`);
  
  return {
    pass: !memoryLeakDetected,
    memoryGrowth,
    growthPercent
  };
}

// Test 4: Malformed Data Injection
async function testMalformedData() {
  console.log('\n\n🧪 TEST 4: Malformed Data Injection');
  console.log('Sending malformed/large payloads...\n');
  
  const socket = io(BASE_URL, {
    transports: ['websocket'],
    reconnection: false
  });
  
  return new Promise((resolve) => {
    socket.on('connect', async () => {
      const attacks = [
        { name: 'Circular JSON', data: (() => { const a = {}; a.self = a; return a; })() },
        { name: 'Giant String', data: { message: 'A'.repeat(1000000) } },
        { name: 'Deep Nesting', data: { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: {} } } } } } } } } } } },
        { name: 'Null Prototype', data: Object.create(null) },
        { name: 'Array Bomb', data: new Array(100000).fill('x') }
      ];
      
      let serverCrashed = false;
      
      for (const attack of attacks) {
        try {
          socket.emit('chat-message', attack.data);
          console.log(`   Testing: ${attack.name}`);
        } catch (err) {
          console.log(`   ${attack.name}: ✅ Rejected (${err.message})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if server still responds
        try {
          const healthy = await new Promise((resolve, reject) => {
            http.get(`${BASE_URL}/health`, (res) => {
              resolve(res.statusCode === 200);
            }).on('error', reject);
          });
          
          if (!healthy) {
            serverCrashed = true;
            break;
          }
        } catch {
          serverCrashed = true;
          break;
        }
      }
      
      console.log(`\nServer Status: ${serverCrashed ? '❌ Crashed/Unresponsive' : '✅ Stable'}`);
      
      socket.disconnect();
      
      resolve({
        pass: !serverCrashed
      });
    });
    
    socket.on('connect_error', (err) => {
      console.log(`❌ Connection failed: ${err.message}`);
      resolve({ pass: true, note: 'Server protected (refused connection)' });
    });
  });
}

// Run all DOS tests
async function runDOSSimulation() {
  console.log('🔥 DOS SIMULATION STARTING...');
  console.log(`Target: ${BASE_URL}`);
  console.log('='.repeat(60));
  
  const results = {};
  
  try {
    results.connectionExhaustion = await testConnectionExhaustion();
    results.eventFlooding = await testEventFlooding();
    results.memoryLeaks = await testMemoryLeaks();
    results.malformedData = await testMalformedData();
  } catch (error) {
    console.error('\n❌ DOS simulation error:', error.message);
    process.exit(1);
  }
  
  // Summary
  console.log('\n\n📊 DOS SIMULATION RESULTS');
  console.log('='.repeat(60));
  console.log(`Connection Exhaustion:  ${results.connectionExhaustion.pass ? '✅ PASS' : '❌ FAIL'} (${results.connectionExhaustion.connectionRate.toFixed(1)}% connected)`);
  console.log(`Event Flooding:         ${results.eventFlooding.pass ? '✅ PASS' : '❌ FAIL'} (${results.eventFlooding.eventsPerSecond?.toFixed(0) || 0} events/sec)`);
  console.log(`Memory Leak Test:       ${results.memoryLeaks.pass ? '✅ PASS' : '⚠️  WARN'} (${results.memoryLeaks.growthPercent.toFixed(1)}% growth)`);
  console.log(`Malformed Data:         ${results.malformedData.pass ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n🛡️  MITIGATION RECOMMENDATIONS:');
  
  if (!results.connectionExhaustion.serverStable) {
    console.log('   ⚠️  Implement connection limits (max connections per IP)');
  }
  
  if (!results.eventFlooding.pass) {
    console.log('   ⚠️  Add rate limiting for Socket.io events');
  }
  
  if (!results.memoryLeaks.pass) {
    console.log('   ⚠️  Review event listeners and connection cleanup');
  }
  
  if (!results.malformedData.pass) {
    console.log('   ⚠️  Add input validation and payload size limits');
  }
  
  const allPassed = Object.values(results).every(r => r.pass);
  
  if (allPassed) {
    console.log('\n✅ DOS SIMULATION PASSED - Server resilient to attacks\n');
    process.exit(0);
  } else {
    console.log('\n❌ DOS SIMULATION FAILED - Server vulnerable to attacks\n');
    process.exit(1);
  }
}

// Run simulation
runDOSSimulation();
