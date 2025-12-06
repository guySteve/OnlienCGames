"use strict";
/**
 * VegasCore Dividend Distributor V2 (Queue-Based)
 *
 * Refactored to use BullMQ job queue instead of Promise.all()
 * for scalable, fault-tolerant dividend distribution.
 *
 * Key Changes:
 * - Producer enqueues syndicates into queue
 * - Worker processes jobs one at a time
 * - Transactions ensure atomicity per syndicate
 * - No RAM exhaustion even with 50k users
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
exports.DividendDistributorV2 = void 0;
exports.createDividendDistributorV2 = createDividendDistributorV2;
var logger_1 = require("../utils/logger");
var dividendQueue_1 = require("../queue/dividendQueue");
var DividendDistributorV2 = /** @class */ (function () {
    function DividendDistributorV2(prisma, redis, io) {
        this.prisma = prisma;
        this.redis = redis;
        this.io = io;
        this.isRunning = false;
        this.lastRun = null;
        this.intervalId = null;
        // Create queue instance
        var redisConnection = this.getRedisConnection();
        var queue = (0, dividendQueue_1.createDividendQueue)(redisConnection).queue;
        this.queue = queue;
    }
    /**
     * Convert Redis client to BullMQ connection config
     */
    DividendDistributorV2.prototype.getRedisConnection = function () {
        var redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        var url = new URL(redisUrl);
        return {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined,
            tls: redisUrl.startsWith('rediss://') ? {} : undefined
        };
    };
    /**
     * Main distribution job (Producer)
     *
     * Instead of processing directly, enqueue all syndicates into the queue
     */
    DividendDistributorV2.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isRunning) {
                            logger_1.logger.warn({
                                type: 'dividend_distributor_already_running'
                            }, 'Dividend distributor already running, skipping...');
                            return [2 /*return*/, { skipped: true }];
                        }
                        this.isRunning = true;
                        startTime = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 6]);
                        logger_1.logger.info({
                            type: 'dividend_distribution_initiated',
                            triggeredBy: 'scheduled'
                        }, 'Starting weekly dividend distribution via queue...');
                        return [4 /*yield*/, (0, dividendQueue_1.enqueueDividendDistribution)(this.queue, this.prisma, 'scheduled')];
                    case 2:
                        result = _a.sent();
                        // Record job initiation
                        this.lastRun = {
                            timestamp: new Date(),
                            duration: Date.now() - startTime,
                            enqueuedCount: result.enqueuedCount,
                            syndicates: result.syndicates
                        };
                        // Store in Redis for monitoring
                        return [4 /*yield*/, this.redis.setex('job:dividend:last_run', 86400 * 7, JSON.stringify(this.lastRun))];
                    case 3:
                        // Store in Redis for monitoring
                        _a.sent();
                        logger_1.logger.info({
                            type: 'dividend_distribution_enqueued',
                            enqueuedCount: result.enqueuedCount,
                            duration: Date.now() - startTime
                        }, "Enqueued ".concat(result.enqueuedCount, " syndicates for dividend distribution"));
                        // Broadcast global event
                        if (this.io && result.enqueuedCount > 0) {
                            this.io.emit('dividend_distribution_started', {
                                enqueuedCount: result.enqueuedCount,
                                estimatedCompletionMinutes: Math.ceil(result.enqueuedCount / 10) // ~10 syndicates per minute
                            });
                        }
                        return [2 /*return*/, {
                                success: true,
                                enqueuedCount: result.enqueuedCount,
                                syndicates: result.syndicates
                            }];
                    case 4:
                        error_1 = _a.sent();
                        logger_1.logger.error({
                            type: 'dividend_distribution_failed',
                            error: error_1 instanceof Error ? error_1.message : String(error_1),
                            stack: error_1 instanceof Error ? error_1.stack : undefined
                        }, 'Failed to initiate dividend distribution');
                        throw error_1;
                    case 5:
                        this.isRunning = false;
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if it's time to run (Sunday midnight UTC)
     */
    DividendDistributorV2.prototype.shouldRun = function () {
        var now = new Date();
        var dayOfWeek = now.getUTCDay(); // 0 = Sunday
        var hour = now.getUTCHours();
        // Run on Sunday between 00:00 and 00:59 UTC
        if (dayOfWeek !== 0 || hour !== 0) {
            return false;
        }
        // Check if already ran this week
        if (this.lastRun) {
            var msSinceLastRun = now.getTime() - this.lastRun.timestamp.getTime();
            var daysSinceLastRun = msSinceLastRun / (1000 * 60 * 60 * 24);
            if (daysSinceLastRun < 6) {
                return false; // Already ran within the week
            }
        }
        return true;
    };
    /**
     * Start the scheduler
     */
    DividendDistributorV2.prototype.start = function (intervalMs) {
        var _this = this;
        if (intervalMs === void 0) { intervalMs = 60000; }
        logger_1.logger.info({
            type: 'dividend_distributor_started',
            version: 'v2-queue'
        }, 'Dividend distributor scheduler started (queue-based)');
        // Check every minute
        this.intervalId = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.shouldRun()) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.run()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger_1.logger.error({
                            type: 'dividend_scheduler_error',
                            error: error_2 instanceof Error ? error_2.message : String(error_2)
                        }, 'Scheduled dividend run failed');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); }, intervalMs);
        // Also check on startup
        this.checkStartupRun();
    };
    /**
     * Check if we missed a run (e.g., server was down on Sunday)
     */
    DividendDistributorV2.prototype.checkStartupRun = function () {
        return __awaiter(this, void 0, void 0, function () {
            var lastRunData, now_1, dayOfWeek, lastRun, lastRunDate, now, daysSinceLastRun;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.redis.get('job:dividend:last_run')];
                    case 1:
                        lastRunData = _a.sent();
                        if (!lastRunData) {
                            now_1 = new Date();
                            dayOfWeek = now_1.getUTCDay();
                            // If it's Sunday or early in the week, run now
                            if (dayOfWeek >= 0 && dayOfWeek <= 2) {
                                logger_1.logger.info({
                                    type: 'dividend_missed_run_detected'
                                }, 'No previous run found, executing now...');
                                setTimeout(function () { return _this.run(); }, 5000);
                            }
                            return [2 /*return*/];
                        }
                        lastRun = JSON.parse(lastRunData);
                        lastRunDate = new Date(lastRun.timestamp);
                        now = new Date();
                        daysSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24);
                        if (daysSinceLastRun >= 7) {
                            logger_1.logger.info({
                                type: 'dividend_missed_run_detected',
                                daysSinceLastRun: Math.round(daysSinceLastRun)
                            }, 'Missed scheduled run, executing now...');
                            setTimeout(function () { return _this.run(); }, 5000);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Stop the scheduler
     */
    DividendDistributorV2.prototype.stop = function () {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger_1.logger.info({
                type: 'dividend_distributor_stopped'
            }, 'Dividend distributor scheduler stopped');
        }
    };
    /**
     * Manual trigger (for admin use)
     */
    DividendDistributorV2.prototype.triggerManual = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                logger_1.logger.info({
                    type: 'dividend_manual_trigger'
                }, 'Manual dividend distribution triggered');
                return [2 /*return*/, (0, dividendQueue_1.enqueueDividendDistribution)(this.queue, this.prisma, 'manual')];
            });
        });
    };
    /**
     * Get job status
     */
    DividendDistributorV2.prototype.getStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var queueMetrics;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, dividendQueue_1.getDividendQueueMetrics)(this.queue)];
                    case 1:
                        queueMetrics = _a.sent();
                        return [2 /*return*/, {
                                isRunning: this.isRunning,
                                lastRun: this.lastRun,
                                nextScheduledRun: this.getNextScheduledRun(),
                                queueMetrics: queueMetrics
                            }];
                }
            });
        });
    };
    /**
     * Calculate next scheduled run time
     */
    DividendDistributorV2.prototype.getNextScheduledRun = function () {
        var now = new Date();
        var nextSunday = new Date(now);
        // Find next Sunday
        var daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
        nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
        nextSunday.setUTCHours(0, 0, 0, 0);
        return nextSunday;
    };
    return DividendDistributorV2;
}());
exports.DividendDistributorV2 = DividendDistributorV2;
// Factory function
function createDividendDistributorV2(prisma, redis, io) {
    return new DividendDistributorV2(prisma, redis, io);
}
exports.default = DividendDistributorV2;
