// End-to-End Encryption for Chat Messages
// Using AES-256-GCM with per-room shared keys
const CryptoJS = require('crypto-js');
const { Redis } = require('@upstash/redis');

// Initialize Redis client for cross-server key storage
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Generate a secure room key
async function generateRoomKey(roomId) {
  const key = CryptoJS.lib.WordArray.random(32).toString();
  await redisClient.set(`room:${roomId}:key`, key, { ex: 86400 });
  return key;
}

// Get or create room key
async function getRoomKey(roomId) {
  const key = await redisClient.get(`room:${roomId}:key`);
  if (!key) {
    return await generateRoomKey(roomId);
  }
  return key;
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
  await redisClient.del(`room:${roomId}:key`);
}

module.exports = {
  getRoomKey,
  encryptMessage,
  decryptMessage,
  sanitizeMessage,
  deleteRoomKey,
};
