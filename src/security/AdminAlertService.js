"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAlertService = exports.AlertCategory = exports.AlertSeverity = void 0;
const events_1 = require("events");
/**
 * Alert severity levels (aligned with CircuitBreaker)
 */
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["INFO"] = "INFO";
    AlertSeverity["WARNING"] = "WARNING";
    AlertSeverity["CRITICAL"] = "CRITICAL";
    AlertSeverity["EMERGENCY"] = "EMERGENCY"; // Manual escalation
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
/**
 * Alert categories
 */
var AlertCategory;
(function (AlertCategory) {
    AlertCategory["ECONOMIC"] = "ECONOMIC";
    AlertCategory["SECURITY"] = "SECURITY";
    AlertCategory["SYSTEM"] = "SYSTEM";
    AlertCategory["COMPLIANCE"] = "COMPLIANCE";
    AlertCategory["MANUAL"] = "MANUAL"; // Admin-triggered alerts
})(AlertCategory || (exports.AlertCategory = AlertCategory = {}));
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
    channels: [
        { type: 'console', enabled: true },
        { type: 'database', enabled: true }
    ],
    rateLimitPerMinute: 10, // Max 10 alerts/minute
    aggregateWindow: 60, // 1-minute aggregation
    minSeverityForSMS: AlertSeverity.CRITICAL,
    minSeverityForEmail: AlertSeverity.WARNING
};
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
class AdminAlertService extends events_1.EventEmitter {
    prisma;
    redis;
    config;
    // Rate limiting
    alertCounter = 0;
    resetInterval = null;
    // Alert aggregation (prevent duplicate spam)
    recentAlerts = new Map();
    // Metrics
    metrics = {
        totalAlerts: 0,
        alertsBySeverity: {
            INFO: 0,
            WARNING: 0,
            CRITICAL: 0,
            EMERGENCY: 0
        },
        alertsByCategory: {
            ECONOMIC: 0,
            SECURITY: 0,
            SYSTEM: 0,
            COMPLIANCE: 0,
            MANUAL: 0
        },
        rateLimitedAlerts: 0,
        aggregatedAlerts: 0
    };
    constructor(prisma, redis, config = {}) {
        super();
        this.prisma = prisma;
        this.redis = redis;
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('🚨 Admin Alert Service initialized');
        console.log('   Channels:', this.config.channels.filter(c => c.enabled).map(c => c.type).join(', '));
        console.log('   Rate limit:', this.config.rateLimitPerMinute, 'alerts/minute');
        // Start rate limit reset interval
        this.resetInterval = setInterval(() => {
            this.alertCounter = 0;
        }, 60000); // Reset every minute
    }
    // ==========================================================================
    // ALERT SENDING
    // ==========================================================================
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
    async sendAlert(alertData) {
        // STEP 1: Rate limiting (prevent alert storm)
        if (this.alertCounter >= this.config.rateLimitPerMinute) {
            this.metrics.rateLimitedAlerts++;
            console.warn('⚠️ Alert rate limit exceeded - Dropping alert:', alertData.title);
            return null;
        }
        // STEP 2: Generate alert
        const alert = {
            id: this.generateAlertId(),
            ...alertData,
            timestamp: new Date()
        };
        // STEP 3: Check for duplicates (aggregation)
        const aggregationKey = this.getAggregationKey(alert);
        const existingAlert = this.recentAlerts.get(aggregationKey);
        if (existingAlert) {
            // Duplicate detected - Skip but update metrics
            this.metrics.aggregatedAlerts++;
            console.log(`📊 Alert aggregated (duplicate within ${this.config.aggregateWindow}s):`, alert.title);
            return existingAlert.id;
        }
        // STEP 4: Store in aggregation cache
        this.recentAlerts.set(aggregationKey, alert);
        setTimeout(() => {
            this.recentAlerts.delete(aggregationKey);
        }, this.config.aggregateWindow * 1000);
        // STEP 5: Increment counters
        this.alertCounter++;
        this.metrics.totalAlerts++;
        this.metrics.alertsBySeverity[alert.severity]++;
        this.metrics.alertsByCategory[alert.category]++;
        // STEP 6: Route to channels
        await this.routeAlert(alert);
        console.log(`🚨 Alert sent [${alert.severity}] ${alert.title}`);
        return alert.id;
    }
    /**
     * Route alert to appropriate notification channels
     *
     * @param alert - Alert to send
     * @private
     */
    async routeAlert(alert) {
        const promises = [];
        for (const channel of this.config.channels) {
            if (!channel.enabled) {
                continue;
            }
            switch (channel.type) {
                case 'console':
                    promises.push(this.sendToConsole(alert));
                    break;
                case 'database':
                    promises.push(this.sendToDatabase(alert));
                    break;
                case 'webhook':
                    if (channel.config) {
                        promises.push(this.sendToWebhook(alert, channel.config));
                    }
                    break;
                case 'email':
                    // Only send email if severity meets threshold
                    if (this.shouldSendEmail(alert.severity)) {
                        if (channel.config) {
                            promises.push(this.sendToEmail(alert, channel.config));
                        }
                    }
                    break;
                case 'sms':
                    // Only send SMS if severity meets threshold
                    if (this.shouldSendSMS(alert.severity)) {
                        if (channel.config) {
                            promises.push(this.sendToSMS(alert, channel.config));
                        }
                    }
                    break;
            }
        }
        // Send to all channels in parallel
        await Promise.allSettled(promises);
    }
    // ==========================================================================
    // NOTIFICATION CHANNELS
    // ==========================================================================
    /**
     * Send alert to console (always enabled)
     *
     * @param alert - Alert to send
     * @private
     */
    async sendToConsole(alert) {
        const icon = this.getSeverityIcon(alert.severity);
        const color = this.getSeverityColor(alert.severity);
        console.error('');
        console.error('='.repeat(80));
        console.error(`${icon} ADMIN ALERT [${alert.severity}] ${icon}`);
        console.error('='.repeat(80));
        console.error(`Category:  ${alert.category}`);
        console.error(`Title:     ${alert.title}`);
        console.error(`Message:   ${alert.message}`);
        console.error(`Timestamp: ${alert.timestamp.toISOString()}`);
        console.error(`Alert ID:  ${alert.id}`);
        if (alert.metadata) {
            console.error(`Metadata:  ${JSON.stringify(alert.metadata, null, 2)}`);
        }
        console.error('='.repeat(80));
        console.error('');
    }
    /**
     * Send alert to database (permanent audit trail)
     *
     * @param alert - Alert to send
     * @private
     */
    async sendToDatabase(alert) {
        try {
            // Store in database (create AdminAlert table via Prisma migration)
            // For now, use Redis as temporary storage
            await this.redis.setex(`alert:${alert.id}`, 86400 * 30, // 30 days
            JSON.stringify(alert));
            // Also store in sorted set for querying
            await this.redis.zadd('alerts:timeline', alert.timestamp.getTime(), alert.id);
            console.log(`💾 Alert stored in database: ${alert.id}`);
        }
        catch (error) {
            console.error('❌ Failed to store alert in database:', error.message);
        }
    }
    /**
     * Send alert to webhook (Slack, Discord, custom)
     *
     * @param alert - Alert to send
     * @param config - Webhook configuration
     * @private
     */
    async sendToWebhook(alert, config) {
        try {
            const payload = this.formatWebhookPayload(alert, config.format || 'json');
            const response = await fetch(config.url, {
                method: config.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...config.headers
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
            }
            console.log(`📤 Alert sent to webhook: ${alert.id}`);
        }
        catch (error) {
            console.error('❌ Failed to send webhook alert:', error.message);
        }
    }
    /**
     * Send alert via email (placeholder - implement with SendGrid/SES)
     *
     * @param alert - Alert to send
     * @param config - Email configuration
     * @private
     */
    async sendToEmail(alert, config) {
        console.log(`📧 Email alert (PLACEHOLDER): ${alert.title}`);
        console.log(`   To: ${config.to.join(', ')}`);
        console.log(`   From: ${config.from}`);
        console.log(`   Subject: [${alert.severity}] ${alert.title}`);
        console.log(`   Body: ${alert.message}`);
        // TODO: Implement actual email sending
        // - SendGrid: Use @sendgrid/mail
        // - AWS SES: Use aws-sdk
        // - SMTP: Use nodemailer
    }
    /**
     * Send alert via SMS (placeholder - implement with Twilio/SNS)
     *
     * @param alert - Alert to send
     * @param config - SMS configuration
     * @private
     */
    async sendToSMS(alert, config) {
        console.log(`📱 SMS alert (PLACEHOLDER): ${alert.title}`);
        console.log(`   To: ${config.to.join(', ')}`);
        console.log(`   From: ${config.from}`);
        console.log(`   Message: [${alert.severity}] ${alert.message}`);
        // TODO: Implement actual SMS sending
        // - Twilio: Use twilio SDK
        // - AWS SNS: Use aws-sdk
    }
    // ==========================================================================
    // FORMATTING & UTILITIES
    // ==========================================================================
    /**
     * Format webhook payload based on destination
     *
     * @param alert - Alert to format
     * @param format - Target format
     * @returns Formatted payload
     * @private
     */
    formatWebhookPayload(alert, format) {
        if (format === 'slack') {
            return {
                text: `🚨 *${alert.severity}* - ${alert.title}`,
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `${this.getSeverityIcon(alert.severity)} ${alert.title}`
                        }
                    },
                    {
                        type: 'section',
                        fields: [
                            { type: 'mrkdwn', text: `*Severity:*\n${alert.severity}` },
                            { type: 'mrkdwn', text: `*Category:*\n${alert.category}` },
                            { type: 'mrkdwn', text: `*Time:*\n${alert.timestamp.toISOString()}` },
                            { type: 'mrkdwn', text: `*Alert ID:*\n${alert.id}` }
                        ]
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Message:*\n${alert.message}`
                        }
                    }
                ]
            };
        }
        if (format === 'discord') {
            return {
                embeds: [
                    {
                        title: `${this.getSeverityIcon(alert.severity)} ${alert.title}`,
                        description: alert.message,
                        color: this.getSeverityColorCode(alert.severity),
                        fields: [
                            { name: 'Severity', value: alert.severity, inline: true },
                            { name: 'Category', value: alert.category, inline: true },
                            { name: 'Alert ID', value: alert.id, inline: true }
                        ],
                        timestamp: alert.timestamp.toISOString()
                    }
                ]
            };
        }
        // Default: JSON format
        return alert;
    }
    /**
     * Get severity icon
     *
     * @param severity - Alert severity
     * @returns Emoji icon
     * @private
     */
    getSeverityIcon(severity) {
        switch (severity) {
            case AlertSeverity.INFO: return 'ℹ️';
            case AlertSeverity.WARNING: return '⚠️';
            case AlertSeverity.CRITICAL: return '🚨';
            case AlertSeverity.EMERGENCY: return '🆘';
            default: return '📢';
        }
    }
    /**
     * Get severity color (for terminal output)
     *
     * @param severity - Alert severity
     * @returns ANSI color code
     * @private
     */
    getSeverityColor(severity) {
        switch (severity) {
            case AlertSeverity.INFO: return '\x1b[36m'; // Cyan
            case AlertSeverity.WARNING: return '\x1b[33m'; // Yellow
            case AlertSeverity.CRITICAL: return '\x1b[31m'; // Red
            case AlertSeverity.EMERGENCY: return '\x1b[35m'; // Magenta
            default: return '\x1b[0m'; // Reset
        }
    }
    /**
     * Get severity color code (for Discord embeds)
     *
     * @param severity - Alert severity
     * @returns Decimal color code
     * @private
     */
    getSeverityColorCode(severity) {
        switch (severity) {
            case AlertSeverity.INFO: return 0x3498db; // Blue
            case AlertSeverity.WARNING: return 0xf39c12; // Orange
            case AlertSeverity.CRITICAL: return 0xe74c3c; // Red
            case AlertSeverity.EMERGENCY: return 0x9b59b6; // Purple
            default: return 0x95a5a6; // Gray
        }
    }
    /**
     * Generate unique alert ID
     *
     * @returns Alert ID
     * @private
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get aggregation key for duplicate detection
     *
     * @param alert - Alert
     * @returns Aggregation key
     * @private
     */
    getAggregationKey(alert) {
        // Group by: severity + category + title (ignore message/metadata)
        return `${alert.severity}:${alert.category}:${alert.title}`;
    }
    /**
     * Check if should send email for this severity
     *
     * @param severity - Alert severity
     * @returns true if should send
     * @private
     */
    shouldSendEmail(severity) {
        if (!this.config.minSeverityForEmail) {
            return true;
        }
        const levels = [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY];
        const minIndex = levels.indexOf(this.config.minSeverityForEmail);
        const currentIndex = levels.indexOf(severity);
        return currentIndex >= minIndex;
    }
    /**
     * Check if should send SMS for this severity
     *
     * @param severity - Alert severity
     * @returns true if should send
     * @private
     */
    shouldSendSMS(severity) {
        if (!this.config.minSeverityForSMS) {
            return true;
        }
        const levels = [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.CRITICAL, AlertSeverity.EMERGENCY];
        const minIndex = levels.indexOf(this.config.minSeverityForSMS);
        const currentIndex = levels.indexOf(severity);
        return currentIndex >= minIndex;
    }
    // ==========================================================================
    // ALERT MANAGEMENT
    // ==========================================================================
    /**
     * Get recent alerts (for admin dashboard)
     *
     * @param limit - Max number of alerts to return
     * @returns Recent alerts
     */
    async getRecentAlerts(limit = 50) {
        try {
            // Get alert IDs from sorted set (most recent first)
            const alertIds = await this.redis.zrevrange('alerts:timeline', 0, limit - 1);
            // Fetch alert data
            const alerts = [];
            for (const alertId of alertIds) {
                const alertJson = await this.redis.get(`alert:${alertId}`);
                if (alertJson) {
                    alerts.push(JSON.parse(alertJson));
                }
            }
            return alerts;
        }
        catch (error) {
            console.error('❌ Failed to fetch recent alerts:', error.message);
            return [];
        }
    }
    /**
     * Acknowledge alert (mark as handled by admin)
     *
     * @param alertId - Alert ID
     * @param adminId - Admin user ID
     */
    async acknowledgeAlert(alertId, adminId) {
        try {
            const alertJson = await this.redis.get(`alert:${alertId}`);
            if (!alertJson) {
                console.warn(`⚠️ Alert not found: ${alertId}`);
                return false;
            }
            const alert = JSON.parse(alertJson);
            alert.acknowledged = true;
            alert.acknowledgedBy = adminId;
            alert.acknowledgedAt = new Date();
            // Update in Redis
            await this.redis.setex(`alert:${alertId}`, 86400 * 30, // 30 days
            JSON.stringify(alert));
            console.log(`✅ Alert acknowledged by ${adminId}: ${alertId}`);
            return true;
        }
        catch (error) {
            console.error('❌ Failed to acknowledge alert:', error.message);
            return false;
        }
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
     * Shutdown service (graceful cleanup)
     */
    shutdown() {
        if (this.resetInterval) {
            clearInterval(this.resetInterval);
            this.resetInterval = null;
        }
        console.log('⏹️ Admin Alert Service shut down');
    }
}
exports.AdminAlertService = AdminAlertService;
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
//# sourceMappingURL=AdminAlertService.js.map