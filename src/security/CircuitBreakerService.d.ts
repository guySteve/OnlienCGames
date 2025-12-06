/**
 * Economic Circuit Breaker - Financial Exploitation Detection & Prevention
 *
 * SECURITY PRINCIPLE: "Fail-Safe Emergency Brake"
 * - Monitor all financial outflows in real-time
 * - Detect abnormal withdrawal/win patterns
 * - Automatically lockdown system if threshold exceeded
 * - Require manual admin intervention to restore
 *
 * THE THREAT:
 * - Exploited game logic (e.g., guaranteed wins)
 * - Database race condition exploits
 * - Account takeover → mass withdrawal
 * - Insider attack → unauthorized chip transfers
 *
 * THE SOLUTION:
 * - Real-time transaction monitoring
 * - 5-minute sliding window aggregation
 * - Automatic lockdown on threshold breach
 * - Critical alerts to admin
 * - Graceful degradation (read-only mode)
 *
 * EXAMPLE SCENARIO:
 * ```
 * Normal Day: ~50,000 chips/5min outflow
 * Exploit Detected: 1,500,000 chips/5min outflow
 *
 * ACTIONS:
 * 1. Set Redis: SYSTEM_LOCKDOWN = true
 * 2. Reject all withdrawals
 * 3. Reject bets > 1,000 chips
 * 4. Send SMS/Email to admin
 * 5. Log all activity
 * 6. Wait for manual override
 * ```
 *
 * @version 5.0.0
 * @security CRITICAL
 */
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    monitoringIntervalMs: number;
    slidingWindowMinutes: number;
    outflowThreshold: number;
    highStakesThreshold: number;
    lockdownBetLimit: number;
    enabled: boolean;
}
/**
 * Transaction analysis result
 */
interface TransactionAnalysis {
    totalOutflow: number;
    totalInflow: number;
    netFlow: number;
    transactionCount: number;
    windowStart: Date;
    windowEnd: Date;
    suspiciousTransactions: number;
}
/**
 * Lockdown state
 */
interface LockdownState {
    active: boolean;
    triggeredAt: Date;
    triggeredBy: string;
    analysis: TransactionAnalysis;
    manualOverride: boolean;
}
/**
 * Alert severity levels
 */
export declare enum AlertSeverity {
    WARNING = "WARNING",// Approaching threshold (80%)
    CRITICAL = "CRITICAL",// Threshold exceeded → Lockdown
    EMERGENCY = "EMERGENCY"
}
/**
 * Economic Circuit Breaker Service
 *
 * LIFECYCLE:
 * 1. Initialize with Prisma, Redis, config
 * 2. Start monitoring (periodic checks)
 * 3. Analyze transactions in sliding window
 * 4. Trigger lockdown if threshold exceeded
 * 5. Emit alerts to admin notification system
 * 6. Wait for manual override to restore
 *
 * USAGE:
 * ```typescript
 * const circuitBreaker = new CircuitBreakerService(prisma, redis, {
 *   outflowThreshold: 1_000_000,
 *   slidingWindowMinutes: 5
 * });
 *
 * await circuitBreaker.startMonitoring();
 *
 * // In game engine / withdrawal handler
 * const canProceed = await circuitBreaker.checkOperation('WITHDRAWAL', amount);
 * if (!canProceed) {
 *   throw new Error('System lockdown - operation blocked');
 * }
 * ```
 */
export declare class CircuitBreakerService extends EventEmitter {
    private prisma;
    private redis;
    private config;
    private monitoringInterval;
    private isMonitoring;
    private readonly REDIS_KEYS;
    private metrics;
    constructor(prisma: PrismaClient, redis: Redis, config?: Partial<CircuitBreakerConfig>);
    /**
     * Start real-time transaction monitoring
     *
     * CALL THIS during server startup (after Prisma/Redis initialization)
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop monitoring (graceful shutdown)
     *
     * CALL THIS during server shutdown
     */
    stopMonitoring(): void;
    /**
     * Perform monitoring cycle (called periodically)
     *
     * PROCESS:
     * 1. Analyze transactions in sliding window
     * 2. Check if threshold exceeded
     * 3. Trigger lockdown if necessary
     * 4. Emit alerts
     *
     * @private
     */
    private performMonitoringCycle;
    /**
     * Analyze transactions in sliding window
     *
     * QUERY STRATEGY:
     * - Look at last N minutes of transactions
     * - Calculate total outflow (withdrawals + winnings)
     * - Calculate total inflow (deposits + losses)
     * - Identify suspicious patterns
     *
     * @returns Transaction analysis
     */
    private analyzeTransactions;
    /**
     * Activate system lockdown
     *
     * ACTIONS:
     * 1. Set Redis flag: SYSTEM_LOCKDOWN = true
     * 2. Store lockdown state with metadata
     * 3. Emit CRITICAL alert
     * 4. Log to console
     *
     * @param reason - Why lockdown was triggered
     * @param analysis - Transaction analysis at trigger time
     */
    private activateLockdown;
    /**
     * Deactivate system lockdown (ADMIN ONLY)
     *
     * SECURITY: This should ONLY be called after admin investigation
     *
     * @param adminId - Admin user ID (for audit trail)
     */
    deactivateLockdown(adminId: string): Promise<void>;
    /**
     * Check if lockdown is active
     *
     * @returns true if lockdown active
     */
    isLockdownActive(): Promise<boolean>;
    /**
     * Get current lockdown state
     *
     * @returns Lockdown state or null
     */
    getLockdownState(): Promise<LockdownState | null>;
    /**
     * Check if operation is allowed (called before high-risk operations)
     *
     * INTEGRATION POINTS:
     * - Withdrawal handlers (before processing withdrawal)
     * - Game bet handlers (before accepting bet)
     * - Chip transfer handlers (before transferring chips)
     *
     * USAGE:
     * ```typescript
     * const canProceed = await circuitBreaker.checkOperation('WITHDRAWAL', 50000);
     * if (!canProceed) {
     *   throw new Error('System lockdown - withdrawals blocked');
     * }
     * ```
     *
     * @param operationType - Type of operation
     * @param amount - Chip amount
     * @returns true if operation allowed
     */
    checkOperation(operationType: 'WITHDRAWAL' | 'BET' | 'TRANSFER', amount: number): Promise<boolean>;
    /**
     * Emit alert to admin notification system
     *
     * INTEGRATION:
     * - This emits an event that AdminAlertService listens for
     * - AdminAlertService handles SMS/Email/Slack notifications
     *
     * @param alert - Alert event data
     * @private
     */
    private emitAlert;
    /**
     * Get service metrics
     *
     * @returns Service metrics
     */
    getMetrics(): typeof this.metrics;
    /**
     * Get current configuration
     *
     * @returns Current configuration
     */
    getConfiguration(): CircuitBreakerConfig;
    /**
     * Manual lockdown trigger (ADMIN ONLY)
     *
     * @param adminId - Admin user ID
     * @param reason - Reason for manual lockdown
     */
    manualLockdown(adminId: string, reason: string): Promise<void>;
}
export {};
/**
 * INTEGRATION EXAMPLE (server.js):
 *
 * ```typescript
 * import { CircuitBreakerService } from './security/CircuitBreakerService';
 * import { AdminAlertService } from './security/AdminAlertService';
 *
 * // After Prisma and Redis initialization
 * const circuitBreaker = new CircuitBreakerService(prisma, redis, {
 *   outflowThreshold: 1_000_000,
 *   slidingWindowMinutes: 5,
 *   lockdownBetLimit: 1_000
 * });
 *
 * const adminAlerts = new AdminAlertService(config);
 *
 * // Connect circuit breaker to alert system
 * circuitBreaker.on('economic:alert', (alert) => {
 *   adminAlerts.sendAlert(alert);
 * });
 *
 * // Start monitoring
 * await circuitBreaker.startMonitoring();
 *
 * // In withdrawal handler
 * app.post('/api/withdraw', async (req, res) => {
 *   const { amount } = req.body;
 *
 *   // CHECK CIRCUIT BREAKER
 *   const canProceed = await circuitBreaker.checkOperation('WITHDRAWAL', amount);
 *   if (!canProceed) {
 *     return res.status(503).json({
 *       error: 'System maintenance in progress',
 *       message: 'Withdrawals temporarily unavailable. Please try again later.'
 *     });
 *   }
 *
 *   // Process withdrawal...
 * });
 *
 * // In game bet handler (example: Blackjack)
 * socket.on('blackjack:bet', async (betAmount) => {
 *   // CHECK CIRCUIT BREAKER
 *   const canProceed = await circuitBreaker.checkOperation('BET', betAmount);
 *   if (!canProceed) {
 *     socket.emit('error', {
 *       message: 'Bet amount too high during system maintenance'
 *     });
 *     return;
 *   }
 *
 *   // Process bet...
 * });
 *
 * // Admin endpoint: Deactivate lockdown
 * app.post('/admin/unlock-system', requireAdmin, async (req, res) => {
 *   await circuitBreaker.deactivateLockdown(req.user.id);
 *   res.json({ success: true });
 * });
 *
 * // Graceful shutdown
 * process.on('SIGTERM', () => {
 *   circuitBreaker.stopMonitoring();
 * });
 * ```
 *
 * SECURITY AUDIT CHECKLIST:
 * ✅ Real-time transaction monitoring (10-second intervals)
 * ✅ Sliding window analysis (prevents threshold gaming)
 * ✅ Automatic lockdown (no human delay)
 * ✅ Fail-safe mode (Redis error → Assume lockdown)
 * ✅ Admin alerts (critical notifications)
 * ✅ Audit trail (lockdown history preserved)
 * ✅ Manual override (admin can force lockdown/unlock)
 * ✅ Graceful degradation (read-only mode, not complete shutdown)
 *
 * THREAT MODEL VERIFICATION:
 * 1. Game Logic Exploit: ✅ Detected via abnormal win rate → Lockdown
 * 2. Race Condition Exploit: ✅ Detected via sudden outflow spike → Lockdown
 * 3. Account Takeover: ✅ Large withdrawals blocked during lockdown
 * 4. Insider Attack: ✅ Manual lockdown available for suspicious activity
 * 5. Database Corruption: ✅ Fail-safe (DB error → No lockdown on false positive)
 */
//# sourceMappingURL=CircuitBreakerService.d.ts.map