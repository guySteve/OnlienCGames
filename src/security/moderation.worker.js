"use strict";
/**
 * Moderation Worker - Thread-Safe Content Filtering
 *
 * PURPOSE: Prevent ReDoS (Regular Expression Denial of Service) attacks
 *
 * THE THREAT:
 * - Malicious user sends message: "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
 * - Regex on main thread: /^(a+)+$/.test(message)
 * - Catastrophic backtracking → Event loop frozen for minutes
 * - Result: Entire server unresponsive (DoS)
 *
 * THE SOLUTION:
 * - Run regex in Worker Thread (isolated from main event loop)
 * - Timeout: Kill worker if takes > 100ms
 * - Result: Main thread stays responsive, malicious messages rejected
 *
 * ARCHITECTURE:
 * ```
 * Main Thread              Worker Thread
 * ─────────────            ─────────────
 * Message received  ──────> Run regex
 *      │                        │
 *      │  (waiting)             │ (processing)
 *      │                        │
 *      │  <────── Result ───────┘
 *      │      or
 *      │  <── Timeout (100ms) ──┘
 *      ▼
 * Accept/Reject
 * ```
 *
 * @version 5.0.0
 * @security CRITICAL
 */
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
/**
 * Profanity filter patterns (example - extend as needed)
 *
 * SECURITY NOTE: Use RE2 library for production to prevent ReDoS
 * Native RegExp can be vulnerable to catastrophic backtracking
 */
const PROFANITY_PATTERNS = [
    /\bf+u+c+k+\b/gi,
    /\bs+h+i+t+\b/gi,
    /\bb+i+t+c+h+\b/gi,
    /\ba+s+s+h+o+l+e+\b/gi,
    /\bd+a+m+n+\b/gi
    // Add more patterns (but use RE2 in production!)
];
/**
 * Spam detection patterns
 */
const SPAM_PATTERNS = [
    /(.)\1{10,}/gi, // Character repeated 10+ times
    /https?:\/\/[^\s]+/gi, // URLs (if you want to block links)
    /\d{5,}/g, // Long numbers (phone numbers, etc.)
    /(.{3,})\1{3,}/gi // Pattern repeated 3+ times
];
/**
 * Maximum message length
 */
const MAX_MESSAGE_LENGTH = 500;
/**
 * Sanitize message (remove dangerous characters)
 *
 * SECURITY:
 * - Remove HTML tags (XSS prevention)
 * - Remove control characters
 * - Trim whitespace
 *
 * @param message - Raw message
 * @returns Sanitized message
 */
function sanitizeMessage(message) {
    return message
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .trim();
}
/**
 * Check for profanity
 *
 * @param message - Message to check
 * @returns true if profanity detected
 */
function containsProfanity(message) {
    for (const pattern of PROFANITY_PATTERNS) {
        if (pattern.test(message)) {
            return true;
        }
    }
    return false;
}
/**
 * Check for spam patterns
 *
 * @param message - Message to check
 * @returns true if spam detected
 */
function containsSpam(message) {
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(message)) {
            return true;
        }
    }
    return false;
}
/**
 * Moderate message (main processing function)
 *
 * RUNS IN WORKER THREAD (isolated from main event loop)
 *
 * @param task - Moderation task
 * @returns Moderation result
 */
function moderateMessage(task) {
    const startTime = Date.now();
    const flags = [];
    // STEP 1: Length check
    if (task.message.length > MAX_MESSAGE_LENGTH) {
        flags.push('MESSAGE_TOO_LONG');
        return {
            taskId: task.taskId,
            approved: false,
            sanitized: '',
            flags,
            processingTime: Date.now() - startTime
        };
    }
    // STEP 2: Sanitize
    let sanitized = sanitizeMessage(task.message);
    // STEP 3: Empty message check
    if (sanitized.length === 0) {
        flags.push('EMPTY_MESSAGE');
        return {
            taskId: task.taskId,
            approved: false,
            sanitized: '',
            flags,
            processingTime: Date.now() - startTime
        };
    }
    // STEP 4: Profanity check (POTENTIALLY SLOW - that's why we're in a worker!)
    if (containsProfanity(sanitized)) {
        flags.push('PROFANITY_DETECTED');
        // Could either reject or censor
        sanitized = sanitized.replace(/[^\s]/g, '*'); // Censor entire message
    }
    // STEP 5: Spam check (POTENTIALLY SLOW)
    if (containsSpam(sanitized)) {
        flags.push('SPAM_DETECTED');
        return {
            taskId: task.taskId,
            approved: false,
            sanitized: '',
            flags,
            processingTime: Date.now() - startTime
        };
    }
    // STEP 6: Approve if no issues (or only profanity which we censored)
    const approved = flags.length === 0 ||
        (flags.length === 1 && flags[0] === 'PROFANITY_DETECTED');
    return {
        taskId: task.taskId,
        approved,
        sanitized,
        flags,
        processingTime: Date.now() - startTime
    };
}
// =============================================================================
// WORKER THREAD MESSAGE HANDLER
// =============================================================================
/**
 * Listen for tasks from main thread
 */
if (worker_threads_1.parentPort) {
    worker_threads_1.parentPort.on('message', (task) => {
        try {
            const result = moderateMessage(task);
            worker_threads_1.parentPort.postMessage(result);
        }
        catch (error) {
            // Worker crashed (possibly malicious input)
            worker_threads_1.parentPort.postMessage({
                taskId: task.taskId,
                approved: false,
                sanitized: '',
                flags: ['WORKER_ERROR'],
                processingTime: 0,
                error: error.message
            });
        }
    });
    // Log worker startup
    console.log('👷 Moderation worker ready');
}
else {
    console.error('❌ Worker started without parentPort');
}
/**
 * INTEGRATION NOTES:
 *
 * This worker file is spawned by ModerationService.ts
 * DO NOT run this file directly
 *
 * The main thread will:
 * 1. Create worker: new Worker('./moderation.worker.ts')
 * 2. Send task: worker.postMessage({ taskId, message, userId })
 * 3. Receive result: worker.on('message', (result) => ...)
 * 4. Timeout: If worker takes > 100ms, kill it
 *
 * SECURITY BENEFITS:
 * - Catastrophic regex backtracking → Only freezes worker (not main thread)
 * - Worker timeout → Main thread stays responsive
 * - Worker crash → Main thread continues (rejects message)
 *
 * PRODUCTION ENHANCEMENT:
 * - Use RE2 library (Google's safe regex engine)
 * - npm install re2
 * - import RE2 from 're2';
 * - Replace RegExp with RE2 (no catastrophic backtracking)
 */
//# sourceMappingURL=moderation.worker.js.map