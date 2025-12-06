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

import { Worker } from 'worker_threads';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Moderation task
 */
interface ModerationTask {
  taskId: string;
  message: string;
  userId: string;
}

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
  poolSize: number;           // Number of worker threads
  taskTimeout: number;        // Milliseconds (default: 100ms)
  maxQueueSize: number;       // Max pending tasks
  workerPath: string;         // Path to worker file
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WorkerPoolConfig = {
  poolSize: 4,                // 4 worker threads
  taskTimeout: 100,           // 100ms timeout (fail-safe)
  maxQueueSize: 1000,         // Max 1000 pending tasks
  workerPath: path.join(__dirname, 'moderation.worker.js')  // Compiled worker
};

/**
 * Worker state
 */
interface WorkerState {
  worker: Worker;
  busy: boolean;
  taskId: string | null;
  startTime: number;
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
export class ModerationService extends EventEmitter {
  private config: WorkerPoolConfig;
  private workers: WorkerState[] = [];
  private taskQueue: Array<{
    task: ModerationTask;
    resolve: (result: ModerationResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private taskCallbacks: Map<
    string,
    { resolve: (result: ModerationResult) => void; reject: (error: Error) => void }
  > = new Map();
  private taskIdCounter: number = 0;

  // Metrics
  private metrics = {
    tasksProcessed: 0,
    tasksRejected: 0,
    tasksTimedOut: 0,
    averageProcessingTime: 0,
    maxProcessingTime: 0
  };

  constructor(config: Partial<WorkerPoolConfig> = {}) {
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
  async initialize(): Promise<void> {
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
      } catch (error: any) {
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
  private async createWorker(): Promise<Worker> {
    const worker = new Worker(this.config.workerPath);

    // Setup message handler
    worker.on('message', (result: ModerationResult) => {
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
  async moderateMessage(userId: string, message: string): Promise<ModerationResult> {
    const taskId = this.generateTaskId();
    const task: ModerationTask = { taskId, message, userId };

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
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Graceful shutdown
   *
   * CALL THIS on server shutdown
   */
  async shutdown(): Promise<void> {
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
  private processQueue(): void {
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
    (idleWorker as any).timeoutId = timeoutId;
  }

  /**
   * Handle worker result
   *
   * @param result - Moderation result from worker
   */
  private handleWorkerResult(result: ModerationResult): void {
    // Find worker state
    const state = this.workers.find(w => w.taskId === result.taskId);
    if (!state) {
      console.warn('⚠️ Received result for unknown task:', result.taskId);
      return;
    }

    // Clear timeout
    if ((state as any).timeoutId) {
      clearTimeout((state as any).timeoutId);
      delete (state as any).timeoutId;
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
  private async handleWorkerTimeout(state: WorkerState, task: ModerationTask): Promise<void> {
    console.error(`⏰ Worker timeout (${this.config.taskTimeout}ms) - Possible ReDoS attack!`);
    console.error(`   Task ID: ${task.taskId}`);
    console.error(`   User ID: ${task.userId}`);
    console.error(`   Message length: ${task.message.length}`);

    // CRITICAL: Kill worker (prevent CPU starvation)
    try {
      await state.worker.terminate();
      console.log('✅ Worker terminated');
    } catch (error) {
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
    } catch (error) {
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
  private updateMetrics(result: ModerationResult): void {
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
  private generateTaskId(): string {
    return `mod_${Date.now()}_${this.taskIdCounter++}`;
  }
}

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
