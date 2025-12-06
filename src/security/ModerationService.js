"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationService = void 0;
const worker_threads_1 = require("worker_threads");
const path = __importStar(require("path"));
const events_1 = require("events");
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    poolSize: 4, // 4 worker threads
    taskTimeout: 100, // 100ms timeout (fail-safe)
    maxQueueSize: 1000, // Max 1000 pending tasks
    workerPath: path.join(__dirname, 'moderation.worker.js') // Compiled worker
};
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
class ModerationService extends events_1.EventEmitter {
    config;
    workers = [];
    taskQueue = [];
    taskCallbacks = new Map();
    taskIdCounter = 0;
    // Metrics
    metrics = {
        tasksProcessed: 0,
        tasksRejected: 0,
        tasksTimedOut: 0,
        averageProcessingTime: 0,
        maxProcessingTime: 0
    };
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('👮 Moderation Service initializing...');
        console.log('   Pool size:', this.config.poolSize);
        console.log('   Timeout:', this.config.taskTimeout, 'ms');
    }
    /**
     * Initialize worker pool
     *
     * CALL THIS ONCE during server startup
     */
    async initialize() {
        console.log('👮 Creating moderation worker pool...');
        for (let i = 0; i < this.config.poolSize; i++) {
            try {
                const worker = await this.createWorker();
                this.workers.push({
                    worker,
                    busy: false,
                    taskId: null,
                    startTime: 0
                });
                console.log(`✅ Worker ${i + 1}/${this.config.poolSize} created`);
            }
            catch (error) {
                console.error(`❌ Failed to create worker ${i + 1}:`, error.message);
                throw error;
            }
        }
        console.log('✅ Moderation Service initialized');
    }
    /**
     * Create worker thread
     *
     * @returns Worker instance
     */
    async createWorker() {
        const worker = new worker_threads_1.Worker(this.config.workerPath);
        // Setup message handler
        worker.on('message', (result) => {
            this.handleWorkerResult(result);
        });
        // Setup error handler
        worker.on('error', (error) => {
            console.error('❌ Worker error:', error);
            // Find worker state and mark as not busy
            const state = this.workers.find(w => w.worker === worker);
            if (state && state.taskId) {
                const callbacks = this.taskCallbacks.get(state.taskId);
                if (callbacks) {
                    callbacks.reject(new Error('Worker crashed'));
                    this.taskCallbacks.delete(state.taskId);
                }
                state.busy = false;
                state.taskId = null;
            }
        });
        // Setup exit handler
        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`❌ Worker exited with code ${code}`);
            }
        });
        return worker;
    }
    // ==========================================================================
    // PUBLIC API
    // ==========================================================================
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
    async moderateMessage(userId, message) {
        const taskId = this.generateTaskId();
        const task = { taskId, message, userId };
        return new Promise((resolve, reject) => {
            // Check queue size (prevent DoS via queue exhaustion)
            if (this.taskQueue.length >= this.config.maxQueueSize) {
                console.warn('⚠️ Moderation queue full, rejecting message');
                resolve({
                    taskId,
                    approved: false,
                    sanitized: '',
                    flags: ['QUEUE_FULL'],
                    processingTime: 0
                });
                return;
            }
            // Add to queue
            this.taskQueue.push({ task, resolve, reject });
            // Try to process immediately
            this.processQueue();
        });
    }
    /**
     * Get service metrics
     *
     * @returns Service metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Graceful shutdown
     *
     * CALL THIS on server shutdown
     */
    async shutdown() {
        console.log('👮 Shutting down Moderation Service...');
        for (const state of this.workers) {
            await state.worker.terminate();
        }
        this.workers = [];
        console.log('✅ Moderation Service shut down');
    }
    // ==========================================================================
    // INTERNAL METHODS
    // ==========================================================================
    /**
     * Process task queue
     *
     * STRATEGY:
     * - Find idle worker
     * - Assign task
     * - Set timeout
     */
    processQueue() {
        if (this.taskQueue.length === 0) {
            return;
        }
        // Find idle worker
        const idleWorker = this.workers.find(w => !w.busy);
        if (!idleWorker) {
            // All workers busy, wait for one to finish
            return;
        }
        // Get next task
        const queueItem = this.taskQueue.shift();
        if (!queueItem) {
            return;
        }
        const { task, resolve, reject } = queueItem;
        // Mark worker as busy
        idleWorker.busy = true;
        idleWorker.taskId = task.taskId;
        idleWorker.startTime = Date.now();
        // Store callbacks
        this.taskCallbacks.set(task.taskId, { resolve, reject });
        // Send task to worker
        idleWorker.worker.postMessage(task);
        // Set timeout (CRITICAL: Kill worker if takes too long)
        const timeoutId = setTimeout(() => {
            this.handleWorkerTimeout(idleWorker, task);
        }, this.config.taskTimeout);
        // Store timeout ID for cleanup
        idleWorker.timeoutId = timeoutId;
    }
    /**
     * Handle worker result
     *
     * @param result - Moderation result from worker
     */
    handleWorkerResult(result) {
        // Find worker state
        const state = this.workers.find(w => w.taskId === result.taskId);
        if (!state) {
            console.warn('⚠️ Received result for unknown task:', result.taskId);
            return;
        }
        // Clear timeout
        if (state.timeoutId) {
            clearTimeout(state.timeoutId);
            delete state.timeoutId;
        }
        // Mark worker as idle
        state.busy = false;
        state.taskId = null;
        // Resolve promise
        const callbacks = this.taskCallbacks.get(result.taskId);
        if (callbacks) {
            callbacks.resolve(result);
            this.taskCallbacks.delete(result.taskId);
        }
        // Update metrics
        this.updateMetrics(result);
        // Process next task in queue
        this.processQueue();
    }
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
    async handleWorkerTimeout(state, task) {
        console.error(`⏰ Worker timeout (${this.config.taskTimeout}ms) - Possible ReDoS attack!`);
        console.error(`   Task ID: ${task.taskId}`);
        console.error(`   User ID: ${task.userId}`);
        console.error(`   Message length: ${task.message.length}`);
        // CRITICAL: Kill worker (prevent CPU starvation)
        try {
            await state.worker.terminate();
            console.log('✅ Worker terminated');
        }
        catch (error) {
            console.error('❌ Failed to terminate worker:', error);
        }
        // Reject message (fail-safe)
        const callbacks = this.taskCallbacks.get(task.taskId);
        if (callbacks) {
            callbacks.resolve({
                taskId: task.taskId,
                approved: false,
                sanitized: '',
                flags: ['TIMEOUT', 'POSSIBLE_REDOS_ATTACK'],
                processingTime: this.config.taskTimeout
            });
            this.taskCallbacks.delete(task.taskId);
        }
        // Update metrics
        this.metrics.tasksTimedOut++;
        // Emit security event (for alerting)
        this.emit('security:redos_attempt', {
            userId: task.userId,
            messageLength: task.message.length,
            timestamp: Date.now()
        });
        // Replace dead worker
        console.log('🔄 Replacing terminated worker...');
        try {
            const newWorker = await this.createWorker();
            const index = this.workers.indexOf(state);
            this.workers[index] = {
                worker: newWorker,
                busy: false,
                taskId: null,
                startTime: 0
            };
            console.log('✅ Worker replaced');
        }
        catch (error) {
            console.error('❌ Failed to replace worker:', error);
        }
        // Process next task in queue
        this.processQueue();
    }
    /**
     * Update service metrics
     *
     * @param result - Moderation result
     */
    updateMetrics(result) {
        this.metrics.tasksProcessed++;
        if (!result.approved) {
            this.metrics.tasksRejected++;
        }
        // Update average processing time
        this.metrics.averageProcessingTime =
            (this.metrics.averageProcessingTime * (this.metrics.tasksProcessed - 1) +
                result.processingTime) /
                this.metrics.tasksProcessed;
        // Update max processing time
        if (result.processingTime > this.metrics.maxProcessingTime) {
            this.metrics.maxProcessingTime = result.processingTime;
        }
    }
    /**
     * Generate unique task ID
     *
     * @returns Task ID
     */
    generateTaskId() {
        return `mod_${Date.now()}_${this.taskIdCounter++}`;
    }
}
exports.ModerationService = ModerationService;
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
//# sourceMappingURL=ModerationService.js.map