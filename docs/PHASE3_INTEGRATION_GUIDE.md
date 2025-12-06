# VegasCore v5.0.0 - Phase 3 Integration Guide

## Overview

This guide walks you through integrating Phase 3 security components into your existing VegasCore server.

**Prerequisites**:
- Phase 1 (Distributed Locking) integrated ✅
- Phase 2 (Infrastructure & Scaling) integrated ✅
- Redis connection working ✅
- Prisma client initialized ✅

---

## Table of Contents

1. [Server.js Integration](#1-serverjs-integration)
2. [Frontend Integration (E2E Chat)](#2-frontend-integration)
3. [Configuration](#3-configuration)
4. [Testing](#4-testing)
5. [Deployment](#5-deployment)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Server.js Integration

### Step 1.1: Import Services

Add these imports at the top of `server.js`:

```typescript
// Phase 3: Security Services
import { ModerationService } from './src/security/ModerationService';
import { CircuitBreakerService } from './src/security/CircuitBreakerService';
import { AdminAlertService, AlertSeverity, AlertCategory } from './src/security/AdminAlertService';
import { BlindRelayService } from './src/security/CommsRelay';
```

### Step 1.2: Initialize Services

After Prisma and Redis initialization, add:

```typescript
// ============================================================================
// PHASE 3: SECURITY SERVICES INITIALIZATION
// ============================================================================

console.log('🔐 Initializing Phase 3 Security Services...');

// 1. Moderation Service (ReDoS Protection)
const moderationService = new ModerationService({
  poolSize: 4,                // 4 worker threads
  taskTimeout: 100,           // 100ms timeout (fail-safe)
  maxQueueSize: 1000,         // Max 1000 pending tasks
  workerPath: path.join(__dirname, 'src/security/moderation.worker.js')
});

// 2. Circuit Breaker Service (Economic Protection)
const circuitBreaker = new CircuitBreakerService(prisma, redis, {
  monitoringIntervalMs: 10000,      // Check every 10 seconds
  slidingWindowMinutes: 5,          // 5-minute window
  outflowThreshold: 1_000_000,      // 1 million chips
  highStakesThreshold: 10_000,      // 10k chips normal limit
  lockdownBetLimit: 1_000,          // 1k chips during lockdown
  enabled: true
});

// 3. Admin Alert Service (Multi-Channel Notifications)
const adminAlerts = new AdminAlertService(prisma, redis, {
  channels: [
    { type: 'console', enabled: true },
    { type: 'database', enabled: true },
    {
      type: 'webhook',
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        url: process.env.SLACK_WEBHOOK_URL,
        format: 'slack'
      }
    },
    {
      type: 'email',
      enabled: process.env.NODE_ENV === 'production' && !!process.env.SENDGRID_API_KEY,
      config: {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
        from: process.env.ALERT_EMAIL_FROM || 'alerts@moescasino.com',
        to: [process.env.ADMIN_EMAIL || 'admin@moescasino.com']
      }
    }
  ],
  rateLimitPerMinute: 10,
  aggregateWindow: 60,
  minSeverityForEmail: AlertSeverity.WARNING,
  minSeverityForSMS: AlertSeverity.CRITICAL
});

// 4. Blind Relay Service (E2E Encryption)
const blindRelay = new BlindRelayService(io, redis, {
  maxMessagesPerMinute: 60,
  maxKeyExchangesPerHour: 10,
  blockDuration: 300  // 5 minutes
});

// Initialize services
await moderationService.initialize();
await circuitBreaker.startMonitoring();
blindRelay.initializeHandlers();

console.log('✅ Phase 3 Security Services initialized');
```

### Step 1.3: Connect Alert Routing

Add event listeners to connect services to alert system:

```typescript
// ============================================================================
// PHASE 3: ALERT ROUTING
// ============================================================================

// Circuit Breaker → Admin Alerts
circuitBreaker.on('economic:alert', async (event) => {
  await adminAlerts.sendAlert({
    severity: event.severity,
    category: AlertCategory.ECONOMIC,
    title: 'Economic Circuit Breaker Alert',
    message: event.message,
    metadata: {
      analysis: event.analysis,
      lockdownActivated: event.lockdownActivated,
      timestamp: event.timestamp
    }
  });
});

// Moderation Service → Admin Alerts
moderationService.on('security:redos_attempt', async (event) => {
  await adminAlerts.sendAlert({
    severity: AlertSeverity.WARNING,
    category: AlertCategory.SECURITY,
    title: 'Possible ReDoS Attack Detected',
    message: `User ${event.userId} triggered moderation worker timeout (message length: ${event.messageLength} chars)`,
    metadata: event
  });
});

// Blind Relay → Admin Alerts (optional, for monitoring)
blindRelay.on('error', async (error) => {
  await adminAlerts.sendAlert({
    severity: AlertSeverity.WARNING,
    category: AlertCategory.SECURITY,
    title: 'E2E Relay Error',
    message: error.message,
    metadata: { error: error.stack }
  });
});

console.log('✅ Phase 3 Alert routing configured');
```

### Step 1.4: Integrate Chat Moderation

Find your existing chat message handler (example: `socket.on('chat_message', ...)`):

**BEFORE (Phase 2)**:
```typescript
socket.on('chat_message', async (message) => {
  // Broadcast to all users
  io.emit('chat_message', {
    user: socket.user.name,
    message: message,
    timestamp: Date.now()
  });
});
```

**AFTER (Phase 3)**:
```typescript
socket.on('chat_message', async (message) => {
  const userId = socket.request?.session?.passport?.user?.id;

  if (!userId) {
    socket.emit('error', { message: 'Authentication required' });
    return;
  }

  try {
    // PHASE 3: Moderate message (thread-safe)
    const moderationResult = await moderationService.moderateMessage(userId, message);

    if (moderationResult.approved) {
      // Broadcast sanitized message
      io.emit('chat_message', {
        user: socket.user.name,
        message: moderationResult.sanitized,
        timestamp: Date.now()
      });
    } else {
      // Reject message and notify sender
      socket.emit('message_rejected', {
        reason: moderationResult.flags.join(', '),
        message: 'Your message was blocked by content moderation'
      });

      // Log rejection
      console.warn(`🚫 Message rejected: User ${userId}, Flags: ${moderationResult.flags.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Moderation error:', error);
    socket.emit('error', { message: 'Failed to process message' });
  }
});
```

### Step 1.5: Integrate Circuit Breaker (Withdrawals)

Find your withdrawal handler (example: `/api/withdraw`):

**BEFORE (Phase 2)**:
```typescript
app.post('/api/withdraw', requireAuth, async (req, res) => {
  const { amount } = req.body;

  // Process withdrawal...
});
```

**AFTER (Phase 3)**:
```typescript
app.post('/api/withdraw', requireAuth, async (req, res) => {
  const { amount } = req.body;

  try {
    // PHASE 3: Check circuit breaker
    const canProceed = await circuitBreaker.checkOperation('WITHDRAWAL', amount);

    if (!canProceed) {
      return res.status(503).json({
        error: 'System maintenance in progress',
        message: 'Withdrawals are temporarily unavailable. Please try again later.',
        code: 'CIRCUIT_BREAKER_ACTIVE'
      });
    }

    // Process withdrawal...
    // (existing withdrawal logic here)

  } catch (error) {
    console.error('❌ Withdrawal error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});
```

### Step 1.6: Integrate Circuit Breaker (Game Bets)

Find your game bet handlers (example: Blackjack, Roulette, etc.):

**Example for Blackjack**:
```typescript
socket.on('blackjack:bet', async (data) => {
  const { tableId, betAmount } = data;
  const userId = socket.request?.session?.passport?.user?.id;

  if (!userId) {
    socket.emit('error', { message: 'Authentication required' });
    return;
  }

  try {
    // PHASE 3: Check circuit breaker
    const canProceed = await circuitBreaker.checkOperation('BET', betAmount);

    if (!canProceed) {
      socket.emit('bet_rejected', {
        reason: 'CIRCUIT_BREAKER_ACTIVE',
        message: 'High-stakes bets are temporarily restricted. Please try a smaller amount.',
        maxAllowed: 1000  // Lockdown bet limit
      });
      return;
    }

    // Process bet...
    // (existing bet logic here)

  } catch (error) {
    console.error('❌ Bet error:', error);
    socket.emit('error', { message: 'Bet failed' });
  }
});
```

**Apply same pattern to all game engines**: Roulette, War, Crash, etc.

### Step 1.7: Admin Endpoints (Alert Management)

Add these admin-only endpoints:

```typescript
// ============================================================================
// PHASE 3: ADMIN ENDPOINTS
// ============================================================================

// Middleware: Require admin role
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Get recent alerts
app.get('/admin/alerts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await adminAlerts.getRecentAlerts(limit);
    res.json(alerts);
  } catch (error) {
    console.error('❌ Failed to fetch alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge alert
app.post('/admin/alerts/:alertId/acknowledge', requireAuth, requireAdmin, async (req, res) => {
  try {
    const success = await adminAlerts.acknowledgeAlert(req.params.alertId, req.user.id);
    res.json({ success });
  } catch (error) {
    console.error('❌ Failed to acknowledge alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Get circuit breaker status
app.get('/admin/circuit-breaker/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const lockdownActive = await circuitBreaker.isLockdownActive();
    const lockdownState = await circuitBreaker.getLockdownState();
    const metrics = circuitBreaker.getMetrics();
    const config = circuitBreaker.getConfiguration();

    res.json({
      lockdownActive,
      lockdownState,
      metrics,
      config
    });
  } catch (error) {
    console.error('❌ Failed to get circuit breaker status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Deactivate lockdown (manual override)
app.post('/admin/circuit-breaker/unlock', requireAuth, requireAdmin, async (req, res) => {
  try {
    await circuitBreaker.deactivateLockdown(req.user.id);
    res.json({ success: true, message: 'Lockdown deactivated' });
  } catch (error) {
    console.error('❌ Failed to deactivate lockdown:', error);
    res.status(500).json({ error: 'Failed to deactivate lockdown' });
  }
});

// Manual lockdown (force lockdown)
app.post('/admin/circuit-breaker/lock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    await circuitBreaker.manualLockdown(req.user.id, reason || 'Manual admin lockdown');
    res.json({ success: true, message: 'Lockdown activated' });
  } catch (error) {
    console.error('❌ Failed to activate lockdown:', error);
    res.status(500).json({ error: 'Failed to activate lockdown' });
  }
});

// Get moderation metrics
app.get('/admin/moderation/metrics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const metrics = moderationService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('❌ Failed to get moderation metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Manual alert trigger
app.post('/admin/alerts/send', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, message, severity } = req.body;

    const alertId = await adminAlerts.sendAlert({
      severity: severity || AlertSeverity.INFO,
      category: AlertCategory.MANUAL,
      title: title || 'Manual Admin Alert',
      message: message || 'Alert triggered by admin',
      metadata: { triggeredBy: req.user.id }
    });

    res.json({ success: true, alertId });
  } catch (error) {
    console.error('❌ Failed to send alert:', error);
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

console.log('✅ Phase 3 Admin endpoints registered');
```

### Step 1.8: Graceful Shutdown

Update your existing shutdown handlers:

```typescript
// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received - Starting graceful shutdown...`);

  // Phase 3: Shutdown security services
  console.log('🔐 Shutting down security services...');
  moderationService.shutdown();
  circuitBreaker.stopMonitoring();
  adminAlerts.shutdown();

  // Phase 2: Close connections (existing)
  await prisma.$disconnect();
  await redis.quit();

  console.log('✅ Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## 2. Frontend Integration

### Step 2.1: Create SecretComs Component

Create `frontend/src/components/SecretComs.jsx`:

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { E2EEncryptionManager } from '../security/E2EEncryption';

/**
 * SecretComs - True End-to-End Encrypted Chat Component
 *
 * FEATURES:
 * - Client-side key generation (server never sees private keys)
 * - ECDH + AES-GCM encryption
 * - Perfect forward secrecy (new keys per session)
 */
export function SecretComs({ socket, currentUser, peerId, peerName }) {
  const [e2e] = useState(() => new E2EEncryptionManager(currentUser.id));
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);

  // ========================================================================
  // ENCRYPTION SETUP
  // ========================================================================

  useEffect(() => {
    const initEncryption = async () => {
      try {
        console.log('🔐 Initializing E2E encryption...');

        // 1. Generate ephemeral key pair (client-side)
        const publicKey = await e2e.generateKeyPair();
        console.log('✅ Key pair generated');

        // 2. Send public key to peer via server (blind relay)
        socket.emit('exchange_keys', {
          peerId,
          publicKey
        });

        console.log('📤 Public key sent to peer');
      } catch (error) {
        console.error('❌ Failed to initialize encryption:', error);
        addSystemMessage('Failed to initialize encryption. Please refresh.');
      }
    };

    // 3. Receive peer's public key
    socket.on('peer_public_key', async ({ senderId, publicKey }) => {
      try {
        console.log('📥 Received peer public key from:', senderId);

        // Import peer's public key and derive shared secret
        await e2e.importPeerPublicKey(publicKey);

        console.log('✅ E2E encryption ready!');
        setEncryptionReady(true);
        addSystemMessage('🔐 Secure connection established');
      } catch (error) {
        console.error('❌ Failed to import peer public key:', error);
        addSystemMessage('Failed to establish secure connection.');
      }
    });

    // 4. Handle key exchange errors
    socket.on('error', (error) => {
      console.error('🚨 Key exchange error:', error);
      if (error.code === 'PEER_OFFLINE') {
        addSystemMessage(`${peerName} is offline. Please try again later.`);
      } else {
        addSystemMessage(`Error: ${error.message}`);
      }
    });

    // 5. Receive encrypted message
    socket.on('encrypted_message', async ({ senderId, encrypted }) => {
      try {
        // Decrypt message (only we can decrypt it!)
        const plaintext = await e2e.decrypt(encrypted);

        addMessage({
          sender: peerName,
          text: plaintext,
          timestamp: new Date(),
          encrypted: true
        });
      } catch (error) {
        console.error('❌ Failed to decrypt message:', error);
        addSystemMessage('⚠️ Failed to decrypt message (possible tampering detected)');
      }
    });

    // Initialize encryption
    initEncryption();

    // Cleanup: Destroy session on unmount (forward secrecy)
    return () => {
      e2e.destroySession();
      console.log('🗑️ Encryption session destroyed');
    };
  }, []);

  // ========================================================================
  // MESSAGE HANDLING
  // ========================================================================

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!encryptionReady) {
      addSystemMessage('⚠️ Encryption not ready yet. Please wait...');
      return;
    }

    try {
      // Encrypt message client-side
      const encrypted = await e2e.encrypt(inputMessage);

      // Send encrypted blob to server (server cannot read it!)
      socket.emit('encrypted_message', {
        peerId,
        encrypted
      });

      // Add to local message list
      addMessage({
        sender: 'You',
        text: inputMessage,
        timestamp: new Date(),
        encrypted: true
      });

      setInputMessage('');
    } catch (error) {
      console.error('❌ Failed to send encrypted message:', error);
      addSystemMessage('⚠️ Failed to send message. Please try again.');
    }
  };

  const addMessage = (message) => {
    setMessages((prev) => [...prev, message]);
    scrollToBottom();
  };

  const addSystemMessage = (text) => {
    addMessage({
      sender: 'System',
      text,
      timestamp: new Date(),
      encrypted: false,
      isSystem: true
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="secret-coms">
      <div className="header">
        <h2>🔐 Secure Chat with {peerName}</h2>
        <div className={`status ${encryptionReady ? 'ready' : 'initializing'}`}>
          {encryptionReady ? '✅ Encrypted' : '⏳ Initializing...'}
        </div>
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.isSystem ? 'system' : ''}`}>
            <div className="sender">{msg.sender}</div>
            <div className="text">{msg.text}</div>
            <div className="timestamp">
              {msg.timestamp.toLocaleTimeString()}
              {msg.encrypted && <span className="encrypted-badge">🔒</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={encryptionReady ? 'Type a message...' : 'Initializing encryption...'}
          disabled={!encryptionReady}
        />
        <button onClick={sendMessage} disabled={!encryptionReady}>
          Send
        </button>
      </div>

      <div className="info">
        ℹ️ This chat uses true end-to-end encryption. The server cannot read your messages.
      </div>
    </div>
  );
}
```

### Step 2.2: Add Styling

Create `frontend/src/components/SecretComs.css`:

```css
.secret-coms {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}

.secret-coms .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.secret-coms .header h2 {
  margin: 0;
  font-size: 18px;
}

.secret-coms .status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.secret-coms .status.ready {
  background: #10b981;
  color: white;
}

.secret-coms .status.initializing {
  background: #f59e0b;
  color: white;
}

.secret-coms .messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f9fafb;
}

.secret-coms .message {
  margin-bottom: 16px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.secret-coms .message.system {
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
}

.secret-coms .message .sender {
  font-weight: bold;
  color: #6366f1;
  margin-bottom: 4px;
}

.secret-coms .message .text {
  color: #1f2937;
  word-wrap: break-word;
}

.secret-coms .message .timestamp {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.secret-coms .message .encrypted-badge {
  font-size: 10px;
}

.secret-coms .input-area {
  display: flex;
  padding: 16px;
  background: white;
  border-top: 1px solid #e5e7eb;
}

.secret-coms .input-area input {
  flex: 1;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.secret-coms .input-area input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.secret-coms .input-area button {
  margin-left: 8px;
  padding: 10px 20px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.secret-coms .input-area button:hover:not(:disabled) {
  background: #4f46e5;
}

.secret-coms .input-area button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}

.secret-coms .info {
  padding: 12px;
  background: #eff6ff;
  border-top: 1px solid #dbeafe;
  font-size: 12px;
  color: #1e40af;
  text-align: center;
}
```

---

## 3. Configuration

### Step 3.1: Environment Variables

Add to `.env`:

```bash
# Phase 3: Security Configuration

# Alert Service - Slack Webhook (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Alert Service - Email (optional)
SENDGRID_API_KEY=SG.xxx
ALERT_EMAIL_FROM=alerts@moescasino.com
ADMIN_EMAIL=admin@moescasino.com

# Alert Service - SMS (optional)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+15551234567
ADMIN_PHONE_NUMBER=+15559876543

# Circuit Breaker Configuration
CIRCUIT_BREAKER_OUTFLOW_THRESHOLD=1000000  # 1 million chips
CIRCUIT_BREAKER_SLIDING_WINDOW_MINUTES=5
CIRCUIT_BREAKER_LOCKDOWN_BET_LIMIT=1000

# Moderation Configuration
MODERATION_POOL_SIZE=4
MODERATION_TASK_TIMEOUT=100  # milliseconds
MODERATION_MAX_QUEUE_SIZE=1000
```

### Step 3.2: Update cloudbuild.yaml

Add Phase 3 environment variables:

```yaml
# Step 4: Deploy to Cloud Run
- name: 'gcr.io/cloud-builders/gcloud'
  args:
    - 'run'
    - 'deploy'
    - 'moes-casino'
    - '--image=gcr.io/$PROJECT_ID/moes-casino:$COMMIT_SHA'
    - '--region=us-central1'
    - '--platform=managed'
    - '--allow-unauthenticated'
    - '--memory=512Mi'
    - '--cpu=2'  # IMPORTANT: Increase CPU for worker threads
    - '--port=8080'
    - '--set-env-vars=PORT=8080'
    - '--set-env-vars=NODE_ENV=production'
    - '--set-env-vars=DATABASE_URL=${_DATABASE_URL}'
    - '--set-env-vars=DIRECT_URL=${_DIRECT_URL}'
    - '--set-env-vars=REDIS_URL=${_REDIS_URL}'
    - '--set-env-vars=SESSION_SECRET=${_SESSION_SECRET}'
    - '--set-env-vars=SLACK_WEBHOOK_URL=${_SLACK_WEBHOOK_URL}'
    - '--set-env-vars=SENDGRID_API_KEY=${_SENDGRID_API_KEY}'
    - '--set-env-vars=ALERT_EMAIL_FROM=${_ALERT_EMAIL_FROM}'
    - '--set-env-vars=ADMIN_EMAIL=${_ADMIN_EMAIL}'
```

Add substitution variables in Cloud Build settings:
- `_SLACK_WEBHOOK_URL`
- `_SENDGRID_API_KEY`
- `_ALERT_EMAIL_FROM`
- `_ADMIN_EMAIL`

---

## 4. Testing

### Step 4.1: Test Moderation Service

Create test file `test-moderation.js`:

```javascript
import { ModerationService } from './src/security/ModerationService.js';

async function testModeration() {
  console.log('🧪 Testing Moderation Service...\n');

  const service = new ModerationService();
  await service.initialize();

  // Test 1: Normal message
  const test1 = await service.moderateMessage('user1', 'Hello, world!');
  console.log('Test 1 (Normal):', test1);

  // Test 2: Profanity
  const test2 = await service.moderateMessage('user2', 'This is fucking bullshit!');
  console.log('Test 2 (Profanity):', test2);

  // Test 3: Spam
  const test3 = await service.moderateMessage('user3', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  console.log('Test 3 (Spam):', test3);

  // Test 4: HTML injection
  const test4 = await service.moderateMessage('user4', '<script>alert("XSS")</script>');
  console.log('Test 4 (HTML):', test4);

  await service.shutdown();
  console.log('\n✅ Moderation tests complete');
}

testModeration();
```

Run: `node test-moderation.js`

### Step 4.2: Test Circuit Breaker

Create test file `test-circuit-breaker.js`:

```javascript
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { CircuitBreakerService } from './src/security/CircuitBreakerService.js';

async function testCircuitBreaker() {
  console.log('🧪 Testing Circuit Breaker...\n');

  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL);

  const service = new CircuitBreakerService(prisma, redis, {
    outflowThreshold: 1000,  // Low threshold for testing
    slidingWindowMinutes: 1   // 1-minute window for testing
  });

  await service.startMonitoring();

  // Simulate transactions
  console.log('Creating test transactions...');
  await prisma.transaction.create({
    data: {
      userId: 'test-user',
      type: 'WITHDRAWAL',
      amount: 1500,  // Exceeds threshold
      createdAt: new Date()
    }
  });

  // Wait for monitoring cycle
  await new Promise(resolve => setTimeout(resolve, 15000));

  const isLocked = await service.isLockdownActive();
  console.log('Lockdown active:', isLocked);

  service.stopMonitoring();
  await prisma.$disconnect();
  await redis.quit();

  console.log('\n✅ Circuit breaker test complete');
}

testCircuitBreaker();
```

Run: `node test-circuit-breaker.js`

### Step 4.3: Test E2E Encryption

Open browser console on SecretComs component:

```javascript
// Should see console logs:
// 🔐 Initializing E2E encryption...
// ✅ Key pair generated
// 📤 Public key sent to peer
// 📥 Received peer public key from: [peer-id]
// ✅ E2E encryption ready!
```

---

## 5. Deployment

### Step 5.1: Compile TypeScript

```bash
npm run build
# or
tsc
```

Verify compiled files exist:
- `src/security/ModerationService.js`
- `src/security/moderation.worker.js`
- `src/security/CircuitBreakerService.js`
- `src/security/AdminAlertService.js`
- `src/security/CommsRelay.js`

### Step 5.2: Deploy to Cloud Run

```bash
gcloud builds submit --config cloudbuild.yaml
```

### Step 5.3: Verify Deployment

Check Cloud Run logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=moes-casino" --limit 50 --format json
```

Look for:
```
✅ Phase 3 Security Services initialized
✅ Moderation Service initialized
✅ Circuit Breaker monitoring started
✅ Admin Alert Service initialized
✅ Blind Relay handlers registered
```

---

## 6. Troubleshooting

### Issue: Worker threads not spawning

**Symptom**: `❌ Failed to create worker` errors

**Solution**:
1. Verify compiled worker file exists: `src/security/moderation.worker.js`
2. Check file permissions: `chmod +x src/security/moderation.worker.js`
3. Ensure CPU > 1 vCPU in Cloud Run (`--cpu=2`)

### Issue: Circuit breaker not triggering

**Symptom**: High outflow but no lockdown

**Solution**:
1. Check monitoring is started: `circuitBreaker.startMonitoring()`
2. Verify Transaction table has records
3. Check Redis connection: `await redis.ping()`
4. Lower threshold for testing: `outflowThreshold: 1000`

### Issue: E2E encryption fails

**Symptom**: `Failed to import peer public key`

**Solution**:
1. Verify both clients generate keys before exchange
2. Check Socket.IO connection is authenticated
3. Verify blind relay handlers registered: `blindRelay.initializeHandlers()`
4. Check browser console for Web Crypto API errors

### Issue: Alerts not sending

**Symptom**: No Slack/Email alerts

**Solution**:
1. Verify webhook URL: `console.log(process.env.SLACK_WEBHOOK_URL)`
2. Test webhook manually: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test"}'`
3. Check email API key: `console.log(process.env.SENDGRID_API_KEY)`
4. Verify severity threshold: `minSeverityForEmail: AlertSeverity.WARNING`

---

## Next Steps

After successful integration:

1. ✅ Monitor worker thread health in production
2. ✅ Tune circuit breaker threshold based on actual traffic
3. ✅ Set up Slack workspace for alerts
4. ✅ Configure SendGrid account for email alerts
5. ✅ Create admin dashboard for alert management
6. ✅ Add user reputation system (ban repeat offenders)
7. ✅ Install RE2 library for safer regex (`npm install re2`)

---

## Support

- Phase 3 Summary: `VEGASCORE_V5_PHASE3_SUMMARY.md`
- Worker Thread Docs: https://nodejs.org/api/worker_threads.html
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

For issues, check logs and metrics endpoints created in Step 1.7.
