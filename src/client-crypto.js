// Client-side encryption utilities
// Note: Include crypto-js in the HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>

const ClientCrypto = {
  roomKeys: new Map(),

  // Set room key (received from server)
  setRoomKey(roomId, key) {
    this.roomKeys.set(roomId, key);
  },

  // Get room key
  getRoomKey(roomId) {
    return this.roomKeys.get(roomId);
  },

  // Encrypt message
  encryptMessage(message, roomId) {
    try {
      const key = this.getRoomKey(roomId);
      if (!key) return message; // Fallback if no key
      const encrypted = CryptoJS.AES.encrypt(message, key).toString();
      return encrypted;
    } catch (error) {
      console.error('Client encryption failed:', error);
      return message;
    }
  },

  // Decrypt message
  decryptMessage(encryptedMessage, roomId) {
    try {
      const key = this.getRoomKey(roomId);
      if (!key) return encryptedMessage; // Fallback if no key
      const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Client decryption failed:', error);
      return '[Encrypted]';
    }
  },

  // Sanitize before display
  sanitize(text) {
    if (typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    // Fallback for non-browser environments (like tests) or explicit replacement
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;');
  }
};

if (typeof module !== 'undefined') {
  module.exports = ClientCrypto;
}

// Export for use in client.js
if (typeof window !== 'undefined') {
  window.ClientCrypto = ClientCrypto;
}
