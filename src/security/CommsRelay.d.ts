/**
 * Blind Relay Server for E2E Encrypted Communications
 *
 * SECURITY PRINCIPLE: "Zero Knowledge Relay"
 * - Server NEVER sees plaintext messages
 * - Server NEVER stores private keys (they don't exist here)
 * - Server ONLY relays encrypted blobs between authenticated users
 *
 * RESPONSIBILITIES:
 * 1. Authenticate sender (via Passport session)
 * 2. Verify recipient exists
 * 3. Relay public keys (key exchange)
 * 4. Relay encrypted messages (no decryption)
 * 5. Rate limiting (prevent spam/DoS)
 *
 * WHAT SERVER CANNOT DO:
 * ❌ Read message content (it's encrypted)
 * ❌ Modify messages (authenticated encryption detects tampering)
 * ❌ Replay old messages (timestamp validation on client)
 * ❌ Impersonate users (session authentication required)
 *
 * @version 5.0.0
 * @security CRITICAL
 */
import { Server as SocketIOServer } from 'socket.io';
import { Redis } from 'ioredis';
/**
 * Rate limit configuration
 */
interface RateLimitConfig {
    maxMessagesPerMinute: number;
    maxKeyExchangesPerHour: number;
    blockDuration: number;
}
/**
 * Blind Relay Service
 *
 * IMPLEMENTATION:
 * - Socket.IO event handlers for key exchange and message relay
 * - Redis-backed rate limiting
 * - Session-based authentication
 * - Zero message inspection
 */
export declare class BlindRelayService {
    private io;
    private redis;
    private rateLimits;
    private activeSessions;
    constructor(io: SocketIOServer, redis: Redis, rateLimits?: RateLimitConfig);
    /**
     * Initialize Socket.IO event handlers
     *
     * CALL THIS in server.js after Socket.IO setup
     */
    initializeHandlers(): void;
    /**
     * Handle public key exchange
     *
     * SECURITY:
     * - Verify sender is authenticated (session)
     * - Verify recipient exists
     * - Rate limit (prevent key exchange spam)
     * - Relay public key only (no private keys involved)
     *
     * WHAT WE RELAY:
     * - Public key (safe to transmit, it's public!)
     * - User ID (authenticated by session)
     * - Timestamp (freshness verification)
     *
     * @param socket - Socket connection
     * @param senderId - Authenticated sender ID
     * @param data - Key exchange message
     */
    private handleKeyExchange;
    /**
     * Relay encrypted message (blind relay)
     *
     * SECURITY:
     * - Server CANNOT read message content (it's encrypted)
     * - Verify sender is authenticated
     * - Verify recipient exists
     * - Rate limit (prevent spam)
     * - NO decryption attempt (we don't have keys)
     *
     * WHAT WE DO:
     * - Verify sender authentication (session)
     * - Verify encrypted.senderId matches session user
     * - Relay encrypted blob to recipient
     *
     * WHAT WE DON'T DO:
     * ❌ Read message content
     * ❌ Store message (no database)
     * ❌ Modify encrypted data
     * ❌ Log message content
     *
     * @param socket - Socket connection
     * @param senderId - Authenticated sender ID
     * @param data - Encrypted message relay
     */
    private handleEncryptedMessage;
    /**
     * Handle encryption session termination
     *
     * SECURITY: Forward secrecy
     * - Notifies peer to destroy session
     * - Clears session tracking
     * - Next communication requires new key exchange
     *
     * @param userId - User ID
     * @param peerId - Peer ID
     */
    private handleSessionEnd;
    /**
     * Handle user disconnect
     *
     * CLEANUP:
     * - End all active encryption sessions
     * - Notify peers
     *
     * @param userId - User ID
     */
    private handleDisconnect;
    /**
     * Find socket for user ID
     *
     * @param userId - User ID to find
     * @returns Socket if found, null otherwise
     */
    private findUserSocket;
    /**
     * Get relay statistics (for monitoring)
     *
     * @returns Relay statistics
     */
    getStatistics(): {
        activeSessions: number;
        totalUsers: number;
    };
}
export {};
/**
 * INTEGRATION EXAMPLE (server.js):
 *
 * ```typescript
 * import { BlindRelayService } from './security/CommsRelay';
 *
 * // After Socket.IO initialization
 * const relayService = new BlindRelayService(io, redis, {
 *   maxMessagesPerMinute: 60,
 *   maxKeyExchangesPerHour: 10,
 *   blockDuration: 300
 * });
 *
 * relayService.initializeHandlers();
 *
 * // Monitoring
 * setInterval(() => {
 *   const stats = relayService.getStatistics();
 *   console.log('E2E Relay Stats:', stats);
 * }, 60000);
 * ```
 *
 * SECURITY AUDIT CHECKLIST:
 * ✅ Server never sees plaintext (blind relay)
 * ✅ Server never stores private keys (they don't exist here)
 * ✅ Session authentication (prevents impersonation)
 * ✅ Rate limiting (prevents spam/DoS)
 * ✅ Input validation (prevents forgery)
 * ✅ Forward secrecy (session cleanup)
 * ✅ No message logging (privacy)
 * ✅ No message storage (zero retention)
 *
 * THREAT MODEL VERIFICATION:
 * 1. Compromised Server: ✅ Cannot read messages (they're encrypted)
 * 2. MITM Attack: ✅ Authenticated encryption detects tampering
 * 3. Replay Attack: ✅ Timestamp validation on client
 * 4. Impersonation: ✅ Session authentication required
 * 5. DoS: ✅ Rate limiting prevents abuse
 */
//# sourceMappingURL=CommsRelay.d.ts.map