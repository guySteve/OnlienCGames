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
export {};
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
//# sourceMappingURL=moderation.worker.d.ts.map