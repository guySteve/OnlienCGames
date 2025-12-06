"use strict";
/**
 * Dividend Distribution Queue (BullMQ)
 *
 * Scalable, Redis-backed job queue for processing syndicate dividend payouts.
 * Prevents RAM exhaustion by processing one syndicate at a time with automatic retry.
 *
 * Architecture:
 * - Producer: Enqueues all syndicates into the queue
 * - Consumer: Worker processes jobs one by one with transactional safety
 * - Redis: Acts as the persistent queue backend
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDividendQueue = createDividendQueue;
exports.enqueueDividendDistribution = enqueueDividendDistribution;
exports.getDividendQueueMetrics = getDividendQueueMetrics;
exports.cleanDividendQueue = cleanDividendQueue;
var bullmq_1 = require("bullmq");
var logger_1 = require("../utils/logger");
/**
 * Create Dividend Distribution Queue
 */
function createDividendQueue(redisConnection) {
    var queue = new bullmq_1.Queue('dividend-distribution', {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3, // Retry up to 3 times
            backoff: {
                type: 'exponential',
                delay: 5000 // Start with 5s, then 10s, then 20s
            },
            removeOnComplete: {
                age: 86400 * 7, // Keep completed jobs for 7 days
                count: 1000 // Keep last 1000 completed jobs
            },
            removeOnFail: {
                age: 86400 * 30 // Keep failed jobs for 30 days for debugging
            }
        }
    });
    // Queue events for monitoring
    var queueEvents = new bullmq_1.QueueEvents('dividend-distribution', {
        connection: redisConnection
    });
    queueEvents.on('completed', function (_a) {
        var jobId = _a.jobId, returnvalue = _a.returnvalue;
        logger_1.logger.info({
            type: 'queue_job_completed',
            queue: 'dividend-distribution',
            jobId: jobId,
            result: returnvalue
        }, "Job ".concat(jobId, " completed successfully"));
    });
    queueEvents.on('failed', function (_a) {
        var jobId = _a.jobId, failedReason = _a.failedReason;
        logger_1.logger.error({
            type: 'queue_job_failed',
            queue: 'dividend-distribution',
            jobId: jobId,
            error: failedReason
        }, "Job ".concat(jobId, " failed: ").concat(failedReason));
    });
    queueEvents.on('progress', function (_a) {
        var jobId = _a.jobId, data = _a.data;
        logger_1.logger.debug({
            type: 'queue_job_progress',
            queue: 'dividend-distribution',
            jobId: jobId,
            progress: data
        }, "Job ".concat(jobId, " progress update"));
    });
    return { queue: queue, queueEvents: queueEvents };
}
/**
 * Enqueue all syndicates for dividend distribution
 *
 * Called by DividendDistributor on Sunday midnight or manual trigger
 */
function enqueueDividendDistribution(queue_1, prisma_1) {
    return __awaiter(this, arguments, void 0, function (queue, prisma, triggeredBy) {
        var syndicates, jobs, error_1;
        if (triggeredBy === void 0) { triggeredBy = 'scheduled'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info({
                        type: 'dividend_distribution_started',
                        triggeredBy: triggeredBy
                    }, "Starting dividend distribution (".concat(triggeredBy, ")"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, prisma.syndicate.findMany({
                            where: {
                                treasuryBalance: { gt: 0 },
                                totalMembers: { gt: 1 } // Need at least 2 members
                            },
                            select: {
                                id: true,
                                name: true,
                                treasuryBalance: true,
                                totalMembers: true
                            }
                        })];
                case 2:
                    syndicates = _a.sent();
                    logger_1.logger.info({
                        type: 'dividend_syndicates_found',
                        count: syndicates.length
                    }, "Found ".concat(syndicates.length, " syndicates eligible for dividends"));
                    return [4 /*yield*/, Promise.all(syndicates.map(function (syndicate) {
                            return queue.add("dividend-".concat(syndicate.id), {
                                syndicateId: syndicate.id,
                                syndicateName: syndicate.name,
                                treasuryBalance: syndicate.treasuryBalance,
                                totalMembers: syndicate.totalMembers,
                                triggeredBy: triggeredBy,
                                timestamp: new Date()
                            }, {
                                jobId: "dividend-".concat(syndicate.id, "-").concat(Date.now()), // Unique job ID
                                priority: 1 // All dividends have same priority
                            });
                        }))];
                case 3:
                    jobs = _a.sent();
                    logger_1.logger.info({
                        type: 'dividend_jobs_enqueued',
                        count: jobs.length,
                        jobIds: jobs.map(function (j) { return j.id; })
                    }, "Enqueued ".concat(jobs.length, " dividend distribution jobs"));
                    return [2 /*return*/, {
                            success: true,
                            enqueuedCount: jobs.length,
                            syndicates: syndicates.map(function (s) { return ({ id: s.id, name: s.name }); })
                        }];
                case 4:
                    error_1 = _a.sent();
                    logger_1.logger.error({
                        type: 'dividend_enqueue_failed',
                        error: error_1 instanceof Error ? error_1.message : String(error_1)
                    }, 'Failed to enqueue dividend distribution jobs');
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get queue metrics for monitoring
 */
function getDividendQueueMetrics(queue) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, waiting, active, completed, failed, delayed;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        queue.getWaitingCount(),
                        queue.getActiveCount(),
                        queue.getCompletedCount(),
                        queue.getFailedCount(),
                        queue.getDelayedCount()
                    ])];
                case 1:
                    _a = _b.sent(), waiting = _a[0], active = _a[1], completed = _a[2], failed = _a[3], delayed = _a[4];
                    return [2 /*return*/, {
                            waiting: waiting,
                            active: active,
                            completed: completed,
                            failed: failed,
                            delayed: delayed,
                            total: waiting + active + completed + failed + delayed
                        }];
            }
        });
    });
}
/**
 * Clean up old jobs
 */
function cleanDividendQueue(queue) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, queue.clean(86400 * 7 * 1000, 1000, 'completed')];
                case 1:
                    _a.sent(); // Remove completed jobs older than 7 days
                    return [4 /*yield*/, queue.clean(86400 * 30 * 1000, 500, 'failed')];
                case 2:
                    _a.sent(); // Remove failed jobs older than 30 days
                    logger_1.logger.info({
                        type: 'queue_cleaned',
                        queue: 'dividend-distribution'
                    }, 'Dividend queue cleaned');
                    return [2 /*return*/];
            }
        });
    });
}
exports.default = {
    createDividendQueue: createDividendQueue,
    enqueueDividendDistribution: enqueueDividendDistribution,
    getDividendQueueMetrics: getDividendQueueMetrics,
    cleanDividendQueue: cleanDividendQueue
};
