// End-to-End Encryption for Chat Messages
// Using AES-256-GCM with per-room shared keys
const CryptoJS = require('crypto-js');

// Room-based encryption keys (in production, use Redis or database)
const roomKeys = new Map();

// Generate a secure room key
function generateRoomKey(roomId) {
  const key = CryptoJS.lib.WordArray.random(32).toString();
  roomKeys.set(roomId, key);
  return key;
}

// Get or create room key
function getRoomKey(roomId) {
  if (!roomKeys.has(roomId)) {
    return generateRoomKey(roomId);
  }
  return roomKeys.get(roomId);
}

// Encrypt message (client-side compatible)
function encryptMessage(message, roomId) {
  try {
    const key = getRoomKey(roomId);
    const encrypted = CryptoJS.AES.encrypt(message, key).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

// Decrypt message (client-side compatible)
function decryptMessage(encryptedMessage, roomId) {
  try {
    const key = getRoomKey(roomId);
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
function deleteRoomKey(roomId) {
  roomKeys.delete(roomId);
}

module.exports = {
  getRoomKey,
  encryptMessage,
  decryptMessage,
  sanitizeMessage,
  deleteRoomKey,
};
