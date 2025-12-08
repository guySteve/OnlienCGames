/**
 * Secret Comms Encryption - AES-256-GCM for Dead Drop Messages
 *
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Unique IV per message (prevents replay attacks)
 * - Server-side encryption key derived from environment secret
 * - Authenticated encryption prevents tampering
 *
 * Why not use the existing encryption.js?
 * - That module uses per-room keys with expiration (meant for ephemeral chat)
 * - Dead Drops need persistent encryption with a master key
 * - Dead Drops need to be retrievable after the "room" expires
 */

const crypto = require('crypto');

// Constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes auth tag
const SALT_LENGTH = 32; // 32 bytes for key derivation

/**
 * Get the master encryption key from environment
 * Falls back to a generated key (NOT production safe - should be set in env)
 */
function getMasterKey() {
  if (!process.env.SECRET_COMMS_MASTER_KEY) {
    console.warn('⚠️  SECRET_COMMS_MASTER_KEY not set! Using fallback (NOT PRODUCTION SAFE)');
    // In production, this should throw an error
    // For now, generate a deterministic key from NODE_ENV
    return crypto
      .createHash('sha256')
      .update(process.env.NODE_ENV || 'development')
      .digest();
  }

  // Derive 32-byte key from environment secret
  return crypto
    .createHash('sha256')
    .update(process.env.SECRET_COMMS_MASTER_KEY)
    .digest();
}

/**
 * Encrypt a message for Dead Drop storage
 *
 * @param {string} plaintext - The message to encrypt
 * @returns {string} - Base64-encoded encrypted data (IV + ciphertext + authTag)
 */
function encryptDeadDrop(plaintext) {
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine IV + ciphertext + authTag
    const combined = Buffer.concat([
      iv,
      Buffer.from(ciphertext, 'base64'),
      authTag
    ]);

    return combined.toString('base64');
  } catch (error) {
    console.error('❌ Dead Drop encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt a Dead Drop message
 *
 * @param {string} encryptedData - Base64-encoded encrypted data
 * @returns {string} - Decrypted plaintext message
 */
function decryptDeadDrop(encryptedData) {
  try {
    const key = getMasterKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract IV, ciphertext, and authTag
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    console.error('❌ Dead Drop decryption failed:', error);
    throw new Error('Decryption failed - message may be corrupted or tampered');
  }
}

/**
 * Sanitize message content (prevent XSS)
 *
 * @param {string} message - Raw message input
 * @returns {string} - Sanitized message
 */
function sanitizeMessage(message) {
  if (typeof message !== 'string') return '';

  return message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .substring(0, 1000); // Max 1000 chars for Dead Drops
}

/**
 * Validate message content before encryption
 *
 * @param {string} message - Message to validate
 * @returns {boolean} - True if valid
 */
function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  if (message.trim().length === 0) {
    return false;
  }

  if (message.length > 1000) {
    return false;
  }

  return true;
}

module.exports = {
  encryptDeadDrop,
  decryptDeadDrop,
  sanitizeMessage,
  validateMessage
};
