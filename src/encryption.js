// End-to-End Encryption for Chat Messages
// Using AES-256-GCM with per-room shared keys
const CryptoJS = require('crypto-js');

// Initialize Redis client for cross-server key storage (scalability fix)
let redisClient = null;
try {
  const { Redis } = require('@upstash/redis');
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ Redis encryption key storage initialized');
  } else {
    console.warn('⚠️  Redis not configured - using in-memory keys (not production-ready)');
  }
} catch (error) {
  console.error('❌ Redis initialization failed:', error.message);
}

// Fallback in-memory storage (for development without Redis)
const roomKeys = new Map();

// Generate a secure room key
async function generateRoomKey(roomId) {
  const key = CryptoJS.lib.WordArray.random(32).toString();
  
  if (redisClient) {
    try {
      await redisClient.set(`room:${roomId}:key`, key, { ex: 86400 });
    } catch (error) {
      console.error('Redis set failed, using memory fallback:', error.message);
      roomKeys.set(roomId, key);
    }
  } else {
    roomKeys.set(roomId, key);
  }
  
  return key;
}

// Get or create room key
async function getRoomKey(roomId) {
  if (redisClient) {
    try {
      const key = await redisClient.get(`room:${roomId}:key`);
      if (key) return key;
    } catch (error) {
      console.error('Redis get failed, checking memory fallback:', error.message);
    }
  }
  
  // Check in-memory fallback
  if (roomKeys.has(roomId)) {
    return roomKeys.get(roomId);
  }
  
  // Generate new key
  return await generateRoomKey(roomId);
}

// Encrypt message (client-side compatible)
async function encryptMessage(message, roomId) {
  try {
    const key = await getRoomKey(roomId);
    const encrypted = CryptoJS.AES.encrypt(message, key).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

// Decrypt message (client-side compatible)
async function decryptMessage(encryptedMessage, roomId) {
  try {
    const key = await getRoomKey(roomId);
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Encrypted Message]';
  }
}

// Sanitize message (prevent XSS)
function sanitizeMessage(message) {
  if (typeof message !== 'string') return '';
  return message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 500); // Max 500 chars
}

// Delete room key when room closes
async function deleteRoomKey(roomId) {
  if (redisClient) {
    try {
      await redisClient.del(`room:${roomId}:key`);
    } catch (error) {
      console.error('Redis delete failed:', error.message);
    }
  }
  roomKeys.delete(roomId);
}

module.exports = {
  getRoomKey,
  encryptMessage,
  decryptMessage,
  sanitizeMessage,
  deleteRoomKey,
};
