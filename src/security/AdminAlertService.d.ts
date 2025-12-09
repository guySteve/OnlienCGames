/**
 * Admin Alert Service - Multi-Channel Security Notification System
 *
 * SECURITY PRINCIPLE: "Immediate Escalation"
 * - Critical security events require instant admin notification
 * - Multiple notification channels (redundancy)
 * - Rate limiting (prevent alert fatigue)
 * - Structured logging (audit trail)
 *
 * WHAT TRIGGERS ALERTS:
 * - Economic Circuit Breaker: Threshold exceeded, lockdown activated
 * - Moderation Service: ReDoS attack attempt, worker timeout
 * - Manual triggers: Admin investigation required
 * - System health: Redis/Database failures
 *
 * NOTIFICATION CHANNELS:
 * - Console (always active)
 * - Webhook (Slack, Discord, custom endpoint)
 * - Email (SendGrid, AWS SES, SMTP)
 * - SMS (Twilio, AWS SNS)
 * - Database log (permanent audit trail)
 *
 * @version 5.0.0
 * @security CRITICAL
 */
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
/**
 * Alert severity levels (aligned with CircuitBreaker)
 */
export declare enum AlertSeverity {
    INFO = "INFO",// Informational (e.g., system startup)
    WARNING = "WARNING",// Potential issue (e.g., 80% threshold)
    CRITICAL = "CRITICAL",// Immediate action required (e.g., lockdown)
    EMERGENCY = "EMERGENCY"
}
/**
 * Alert categories
 */
export declare enum AlertCategory {
    ECONOMIC = "ECONOMIC",// Financial exploitation
    SECURITY = "SECURITY",// Security threats (ReDoS, etc.)
    SYSTEM = "SYSTEM",// Infrastructure failures
    COMPLIANCE = "COMPLIANCE",// Audit/regulatory issues
    MANUAL = "MANUAL"
}
/**
 * Alert notification
 */
export interface Alert {
    id: string;
    severity: AlertSeverity;
    category: AlertCategory;
    title: string;
    message: string;
    metadata?: any;
    timestamp: Date;
    acknowledged?: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
}
/**
 * Notification channel configuration
 */
export interface NotificationChannel {
    type: 'console' | 'webhook' | 'email' | 'sms' | 'database';
    enabled: boolean;
    config?: any;
}
/**
 * Webhook configuration
 */
export interface WebhookConfig {
    url: string;
    method?: 'POST' | 'GET';
    headers?: Record<string, string>;
    format?: 'slack' | 'discord' | 'json';
}
/**
 * Email configuration
 */
export interface EmailConfig {
    provider: 'sendgrid' | 'ses' | 'smtp';
    apiKey?: string;
    from: string;
    to: string[];
    smtpConfig?: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    };
}
/**
 * SMS configuration
 */
export interface SMSConfig {
    provider: 'twilio' | 'sns';
    accountSid?: string;
    authToken?: string;
    from: string;
    to: string[];
}
/**
 * Service configuration
 */
export interface AdminAlertConfig {
    channels: NotificationChannel[];
    rateLimitPerMinute: number;
    aggregateWindow: number;
    minSeverityForSMS?: AlertSeverity;
    minSeverityForEmail?: AlertSeverity;
}
/**
 * Admin Alert Service
 *
 * LIFECYCLE:
 * 1. Initialize with Prisma, Redis, config
 * 2. Register notification channels
 * 3. Listen for events from security services
 * 4. Process and route alerts to appropriate channels
 * 5. Store alerts in database (audit trail)
 * 6. Handle acknowledgments from admin dashboard
 *
 * USAGE:
 * ```typescript
 * const adminAlerts = new AdminAlertService(prisma, redis, {
 *   channels: [
 *     { type: 'console', enabled: true },
 *     { type: 'webhook', enabled: true, config: { url: 'https://hooks.slack.com/...' } },
 *     { type: 'email', enabled: true, config: { from: 'alerts@casino.com', to: ['admin@casino.com'] } }
 *   ]
 * });
 *
 * // Connect to security services
 * circuitBreaker.on('economic:alert', (alert) => {
 *   adminAlerts.sendAlert({
 *     severity: AlertSeverity.CRITICAL,
 *     category: AlertCategory.ECONOMIC,
 *     title: 'Circuit Breaker Triggered',
 *     message: alert.message,
 *     metadata: alert.analysis
 *   });
 * });
 *
 * moderationService.on('security:redos_attempt', (event) => {
 *   adminAlerts.sendAlert({
 *     severity: AlertSeverity.WARNING,
 *     category: AlertCategory.SECURITY,
 *     title: 'Possible ReDoS Attack',
 *     message: `User ${event.userId} triggered timeout (message length: ${event.messageLength})`,
 *     metadata: event
 *   });
 * });
 * ```
 */
export declare class AdminAlertService extends EventEmitter {
    private redis;
    private config;
    private alertCounter;
    private resetInterval;
    private recentAlerts;
    private metrics;
    constructor(redis: Redis, config?: Partial<AdminAlertConfig>);
    /**
     * Send alert to all configured channels
     *
     * PROCESS:
     * 1. Generate unique alert ID
     * 2. Check rate limiting
     * 3. Check for duplicate (aggregation)
     * 4. Route to appropriate channels
     * 5. Store in database (audit trail)
     * 6. Update metrics
     *
     * @param alertData - Alert data (without ID, timestamp)
     * @returns Alert ID or null if rate limited
     */
    sendAlert(alertData: Omit<Alert, 'id' | 'timestamp'>): Promise<string | null>;
    /**
     * Route alert to appropriate notification channels
     *
     * @param alert - Alert to send
     * @private
     */
    private routeAlert;
    /**
     * Send alert to console (always enabled)
     *
     * @param alert - Alert to send
     * @private
     */
    private sendToConsole;
    /**
     * Send alert to database (permanent audit trail)
     *
     * @param alert - Alert to send
     * @private
     */
    private sendToDatabase;
    /**
     * Send alert to webhook (Slack, Discord, custom)
     *
     * @param alert - Alert to send
     * @param config - Webhook configuration
     * @private
     */
    private sendToWebhook;
    /**
     * Send alert via email (placeholder - implement with SendGrid/SES)
     *
     * @param alert - Alert to send
     * @param config - Email configuration
     * @private
     */
    private sendToEmail;
    /**
     * Send alert via SMS (placeholder - implement with Twilio/SNS)
     *
     * @param alert - Alert to send
     * @param config - SMS configuration
     * @private
     */
    private sendToSMS;
    /**
     * Format webhook payload based on destination
     *
     * @param alert - Alert to format
     * @param format - Target format
     * @returns Formatted payload
     * @private
     */
    private formatWebhookPayload;
    /**
     * Get severity icon
     *
     * @param severity - Alert severity
     * @returns Emoji icon
     * @private
     */
    private getSeverityIcon;
    /**
     * Get severity color code (for Discord embeds)
     *
     * @param severity - Alert severity
     * @returns Decimal color code
     * @private
     */
    private getSeverityColorCode;
    /**
     * Generate unique alert ID
     *
     * @returns Alert ID
     * @private
     */
    private generateAlertId;
    /**
     * Get aggregation key for duplicate detection
     *
     * @param alert - Alert
     * @returns Aggregation key
     * @private
     */
    private getAggregationKey;
    /**
     * Check if should send email for this severity
     *
     * @param severity - Alert severity
     * @returns true if should send
     * @private
     */
    private shouldSendEmail;
    /**
     * Check if should send SMS for this severity
     *
     * @param severity - Alert severity
     * @returns true if should send
     * @private
     */
    private shouldSendSMS;
    /**
     * Get recent alerts (for admin dashboard)
     *
     * @param limit - Max number of alerts to return
     * @returns Recent alerts
     */
    getRecentAlerts(limit?: number): Promise<Alert[]>;
    /**
     * Acknowledge alert (mark as handled by admin)
     *
     * @param alertId - Alert ID
     * @param adminId - Admin user ID
     */
    acknowledgeAlert(alertId: string, adminId: string): Promise<boolean>;
    /**
     * Get service metrics
     *
     * @returns Service metrics
     */
    getMetrics(): typeof this.metrics;
    /**
     * Shutdown service (graceful cleanup)
     */
    shutdown(): void;
}
/**
 * INTEGRATION EXAMPLE (server.js):
 *
 * ```typescript
 * import { AdminAlertService, AlertSeverity, AlertCategory } from './security/AdminAlertService';
 * import { CircuitBreakerService } from './security/CircuitBreakerService';
 * import { ModerationService } from './security/ModerationService';
 *
 * // Initialize services
 * const adminAlerts = new AdminAlertService(prisma, redis, {
 *   channels: [
 *     { type: 'console', enabled: true },
 *     { type: 'database', enabled: true },
 *     {
 *       type: 'webhook',
 *       enabled: true,
 *       config: {
 *         url: process.env.SLACK_WEBHOOK_URL,
 *         format: 'slack'
 *       }
 *     },
 *     {
 *       type: 'email',
 *       enabled: process.env.NODE_ENV === 'production',
 *       config: {
 *         provider: 'sendgrid',
 *         apiKey: process.env.SENDGRID_API_KEY,
 *         from: 'alerts@moescasino.com',
 *         to: ['admin@moescasino.com']
 *       }
 *     }
 *   ],
 *   rateLimitPerMinute: 10,
 *   minSeverityForEmail: AlertSeverity.WARNING,
 *   minSeverityForSMS: AlertSeverity.CRITICAL
 * });
 *
 * const circuitBreaker = new CircuitBreakerService(prisma, redis);
 * const moderationService = new ModerationService();
 *
 * // Connect Circuit Breaker to Alert Service
 * circuitBreaker.on('economic:alert', async (event) => {
 *   await adminAlerts.sendAlert({
 *     severity: event.severity,
 *     category: AlertCategory.ECONOMIC,
 *     title: 'Economic Circuit Breaker Alert',
 *     message: event.message,
 *     metadata: event.analysis
 *   });
 * });
 *
 * // Connect Moderation Service to Alert Service
 * moderationService.on('security:redos_attempt', async (event) => {
 *   await adminAlerts.sendAlert({
 *     severity: AlertSeverity.WARNING,
 *     category: AlertCategory.SECURITY,
 *     title: 'Possible ReDoS Attack Detected',
 *     message: `User ${event.userId} triggered moderation timeout (message length: ${event.messageLength})`,
 *     metadata: event
 *   });
 * });
 *
 * // Manual alert trigger (from admin dashboard)
 * app.post('/admin/send-alert', requireAdmin, async (req, res) => {
 *   const { title, message, severity } = req.body;
 *
 *   const alertId = await adminAlerts.sendAlert({
 *     severity: severity || AlertSeverity.INFO,
 *     category: AlertCategory.MANUAL,
 *     title,
 *     message,
 *     metadata: { triggeredBy: req.user.id }
 *   });
 *
 *   res.json({ success: true, alertId });
 * });
 *
 * // Get recent alerts (admin dashboard)
 * app.get('/admin/alerts', requireAdmin, async (req, res) => {
 *   const alerts = await adminAlerts.getRecentAlerts(100);
 *   res.json(alerts);
 * });
 *
 * // Acknowledge alert
 * app.post('/admin/alerts/:alertId/acknowledge', requireAdmin, async (req, res) => {
 *   const success = await adminAlerts.acknowledgeAlert(req.params.alertId, req.user.id);
 *   res.json({ success });
 * });
 *
 * // Graceful shutdown
 * process.on('SIGTERM', () => {
 *   adminAlerts.shutdown();
 * });
 * ```
 *
 * SECURITY AUDIT CHECKLIST:
 * ✅ Multi-channel redundancy (console + database + webhook)
 * ✅ Rate limiting (prevent alert storm)
 * ✅ Alert aggregation (prevent duplicate spam)
 * ✅ Severity-based routing (SMS only for CRITICAL+)
 * ✅ Permanent audit trail (database storage)
 * ✅ Admin acknowledgment tracking
 * ✅ Structured logging (JSON metadata)
 * ✅ Graceful degradation (channel failures don't block alerts)
 */
//# sourceMappingURL=AdminAlertService.d.ts.map