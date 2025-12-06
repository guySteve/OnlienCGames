/**
 * Thread-Safe Moderation Service
 *
 * PURPOSE: Protect main event loop from ReDoS attacks
 *
 * ARCHITECTURE:
 * - Main thread: Express server, Socket.IO, game logic
 * - Worker pool: N isolated threads running regex/moderation
 * - Timeout: Kill worker if takes > 100ms
 *
 * BENEFITS:
 * - Malicious regex → Only kills worker (main thread unaffected)
 * - Worker pool → Parallel processing
 * - Timeout → Fail-safe (reject message if too slow)
 *
 * @version 5.0.0
 * @security CRITICAL
 */
import { EventEmitter } from 'events';
/**
 * Moderation result
 */
interface ModerationResult {
    taskId: string;
    approved: boolean;
    sanitized: string;
    flags: string[];
    processingTime: number;
    error?: string;
}
/**
 * Worker pool configuration
 */
interface WorkerPoolConfig {
    poolSize: number;
    taskTimeout: number;
    maxQueueSize: number;
    workerPath: string;
}
/**
 * Thread-Safe Moderation Service
 *
 * USAGE:
 * ```typescript
 * const moderationService = new ModerationService();
 * await moderationService.initialize();
 *
 * const result = await moderationService.moderateMessage(
 *   'user123',
 *   'Hello world!'
 * );
 *
 * if (result.approved) {
 *   // Send message
 * } else {
 *   // Reject message
 * }
 * ```
 */
export declare class ModerationService extends EventEmitter {
    private config;
    private workers;
    private taskQueue;
    private taskCallbacks;
    private taskIdCounter;
    private metrics;
    constructor(config?: Partial<WorkerPoolConfig>);
    /**
     * Initialize worker pool
     *
     * CALL THIS ONCE during server startup
     */
    initialize(): Promise<void>;
    /**
     * Create worker thread
     *
     * @returns Worker instance
     */
    private createWorker;
    /**
     * Moderate message (thread-safe)
     *
     * PROCESS:
     * 1. Find available worker
     * 2. Send task to worker
     * 3. Set timeout (100ms default)
     * 4. If timeout → Kill worker, reject message
     * 5. If success → Return result
     *
     * @param userId - User ID (for tracking)
     * @param message - Message to moderate
     * @returns Moderation result
     */
    moderateMessage(userId: string, message: string): Promise<ModerationResult>;
    /**
     * Get service metrics
     *
     * @returns Service metrics
     */
    getMetrics(): typeof this.metrics;
    /**
     * Graceful shutdown
     *
     * CALL THIS on server shutdown
     */
    shutdown(): Promise<void>;
    /**
     * Process task queue
     *
     * STRATEGY:
     * - Find idle worker
     * - Assign task
     * - Set timeout
     */
    private processQueue;
    /**
     * Handle worker result
     *
     * @param result - Moderation result from worker
     */
    private handleWorkerResult;
    /**
     * Handle worker timeout (CRITICAL: ReDoS protection)
     *
     * ACTIONS:
     * 1. Kill worker (prevent event loop freeze)
     * 2. Reject message (fail-safe)
     * 3. Create new worker (restore pool capacity)
     * 4. Log incident (security monitoring)
     *
     * @param state - Worker state
     * @param task - Task that timed out
     */
    private handleWorkerTimeout;
    /**
     * Update service metrics
     *
     * @param result - Moderation result
     */
    private updateMetrics;
    /**
     * Generate unique task ID
     *
     * @returns Task ID
     */
    private generateTaskId;
}
export {};
/**
 * USAGE EXAMPLE (server.js):
 *
 * ```typescript
 * import { ModerationService } from './security/ModerationService';
 *
 * // Initialize during startup
 * const moderationService = new ModerationService({
 *   poolSize: 4,
 *   taskTimeout: 100
 * });
 * await moderationService.initialize();
 *
 * // Listen for security events
 * moderationService.on('security:redos_attempt', (event) => {
 *   console.error('🚨 Possible ReDoS attack:', event);
 *   // Send alert to admin, ban user, etc.
 * });
 *
 * // Use in chat handler
 * io.on('connection', (socket) => {
 *   socket.on('chat_message', async (message) => {
 *     const result = await moderationService.moderateMessage(
 *       socket.user.id,
 *       message
 *     );
 *
 *     if (result.approved) {
 *       // Broadcast sanitized message
 *       io.emit('chat_message', {
 *         user: socket.user.name,
 *         message: result.sanitized
 *       });
 *     } else {
 *       // Reject message
 *       socket.emit('message_rejected', {
 *         reason: result.flags.join(', ')
 *       });
 *     }
 *   });
 * });
 *
 * // Graceful shutdown
 * process.on('SIGTERM', async () => {
 *   await moderationService.shutdown();
 * });
 * ```
 *
 * SECURITY BENEFITS:
 * ✅ ReDoS attacks isolated to worker threads
 * ✅ Main event loop protected (server stays responsive)
 * ✅ Automatic worker replacement
 * ✅ Fail-safe timeout (reject message if too slow)
 * ✅ Security event monitoring
 * ✅ Queue size limits (prevent DoS via queue exhaustion)
 */
//# sourceMappingURL=ModerationService.d.ts.map