"use strict";
/**
 * Dividend Payout Worker (BullMQ Consumer)
 *
 * Dedicated worker process that consumes dividend distribution jobs from the queue.
 * Each job processes ONE syndicate's dividend payout with full transactional safety.
 *
 * Key Features:
 * - Transactional: If payout fails, rollback and retry automatically
 * - Isolated: Failures don't affect other syndicates
 * - Scalable: Can run multiple workers in parallel
 * - Observable: Full logging and metrics
 *
 * Run as: node -r ts-node/register src/queue/payout.worker.ts
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
exports.createPayoutWorker = createPayoutWorker;
var bullmq_1 = require("bullmq");
var client_1 = require("@prisma/client");
var logger_1 = require("../utils/logger");
var performance_1 = require("../utils/performance");
var prisma = new client_1.PrismaClient();
/**
 * Process a single syndicate dividend payout
 *
 * Wrapped in Prisma transaction for atomicity
 */
function processDividendPayout(job) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, syndicateId, syndicateName, treasuryBalance, totalMembers, result, error_1;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = job.data, syndicateId = _a.syndicateId, syndicateName = _a.syndicateName, treasuryBalance = _a.treasuryBalance, totalMembers = _a.totalMembers;
                    logger_1.logger.info({
                        type: 'dividend_payout_started',
                        syndicateId: syndicateId,
                        syndicateName: syndicateName,
                        treasuryBalance: Number(treasuryBalance),
                        totalMembers: totalMembers,
                        jobId: job.id
                    }, "Processing dividend for ".concat(syndicateName));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var syndicate, eligibleMembers, totalDividend, amountPerMember, dividend, _i, eligibleMembers_1, member;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx.syndicate.findUnique({
                                            where: { id: syndicateId },
                                            include: {
                                                members: {
                                                    where: {
                                                        // Only active members who contributed
                                                        weeklyContribution: { gt: 0 }
                                                    },
                                                    include: {
                                                        user: {
                                                            select: {
                                                                id: true,
                                                                displayName: true,
                                                                chipBalance: true
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        })];
                                    case 1:
                                        syndicate = _a.sent();
                                        if (!syndicate) {
                                            throw new Error("Syndicate ".concat(syndicateId, " not found"));
                                        }
                                        // Check if treasury has enough balance
                                        if (syndicate.treasuryBalance <= 0) {
                                            logger_1.logger.warn({
                                                type: 'dividend_skip_no_balance',
                                                syndicateId: syndicateId,
                                                syndicateName: syndicateName
                                            }, "Skipping ".concat(syndicateName, " - no treasury balance"));
                                            return [2 /*return*/, {
                                                    success: true,
                                                    syndicateId: syndicateId,
                                                    syndicateName: syndicateName,
                                                    totalAmount: 0n,
                                                    amountPerMember: 0n,
                                                    eligibleMembers: 0
                                                }];
                                        }
                                        eligibleMembers = syndicate.members.filter(function (m) { return m.weeklyContribution > 0; });
                                        if (eligibleMembers.length === 0) {
                                            logger_1.logger.warn({
                                                type: 'dividend_skip_no_eligible',
                                                syndicateId: syndicateId,
                                                syndicateName: syndicateName
                                            }, "Skipping ".concat(syndicateName, " - no eligible members"));
                                            return [2 /*return*/, {
                                                    success: true,
                                                    syndicateId: syndicateId,
                                                    syndicateName: syndicateName,
                                                    totalAmount: 0n,
                                                    amountPerMember: 0n,
                                                    eligibleMembers: 0
                                                }];
                                        }
                                        totalDividend = syndicate.treasuryBalance / 10n;
                                        amountPerMember = totalDividend / BigInt(eligibleMembers.length);
                                        if (amountPerMember <= 0) {
                                            logger_1.logger.warn({
                                                type: 'dividend_skip_too_small',
                                                syndicateId: syndicateId,
                                                syndicateName: syndicateName,
                                                totalDividend: Number(totalDividend),
                                                memberCount: eligibleMembers.length
                                            }, "Skipping ".concat(syndicateName, " - dividend too small"));
                                            return [2 /*return*/, {
                                                    success: true,
                                                    syndicateId: syndicateId,
                                                    syndicateName: syndicateName,
                                                    totalAmount: 0n,
                                                    amountPerMember: 0n,
                                                    eligibleMembers: 0
                                                }];
                                        }
                                        return [4 /*yield*/, tx.syndicateDividend.create({
                                                data: {
                                                    syndicateId: syndicateId,
                                                    totalAmount: totalDividend,
                                                    memberCount: eligibleMembers.length,
                                                    amountPerMember: amountPerMember,
                                                    minContribution: 0n,
                                                    periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                                                    periodEnd: new Date(),
                                                    metadata: {
                                                        memberPayouts: eligibleMembers.map(function (m) { return ({
                                                            userId: m.userId,
                                                            displayName: m.user.displayName,
                                                            contribution: Number(m.weeklyContribution),
                                                            payout: Number(amountPerMember)
                                                        }); })
                                                    }
                                                }
                                            })];
                                    case 2:
                                        dividend = _a.sent();
                                        _i = 0, eligibleMembers_1 = eligibleMembers;
                                        _a.label = 3;
                                    case 3:
                                        if (!(_i < eligibleMembers_1.length)) return [3 /*break*/, 9];
                                        member = eligibleMembers_1[_i];
                                        // Update member's balance
                                        return [4 /*yield*/, tx.user.update({
                                                where: { id: member.userId },
                                                data: {
                                                    chipBalance: {
                                                        increment: amountPerMember
                                                    }
                                                }
                                            })];
                                    case 4:
                                        // Update member's balance
                                        _a.sent();
                                        // Record transaction
                                        return [4 /*yield*/, tx.transaction.create({
                                                data: {
                                                    userId: member.userId,
                                                    amount: Number(amountPerMember),
                                                    type: 'TRANSFER_RECEIVED',
                                                    balanceBefore: member.user.chipBalance,
                                                    balanceAfter: member.user.chipBalance + amountPerMember,
                                                    description: "Syndicate dividend from ".concat(syndicateName),
                                                    metadata: {
                                                        syndicateId: syndicateId,
                                                        syndicateName: syndicateName,
                                                        dividendId: dividend.id,
                                                        weeklyContribution: Number(member.weeklyContribution)
                                                    }
                                                }
                                            })];
                                    case 5:
                                        // Record transaction
                                        _a.sent();
                                        // Update member dividend stats
                                        return [4 /*yield*/, tx.syndicateMember.update({
                                                where: { id: member.id },
                                                data: {
                                                    dividendsReceived: {
                                                        increment: amountPerMember
                                                    },
                                                    weeklyContribution: 0 // Reset for next week
                                                }
                                            })];
                                    case 6:
                                        // Update member dividend stats
                                        _a.sent();
                                        // Report progress
                                        return [4 /*yield*/, job.updateProgress({
                                                processed: eligibleMembers.indexOf(member) + 1,
                                                total: eligibleMembers.length
                                            })];
                                    case 7:
                                        // Report progress
                                        _a.sent();
                                        _a.label = 8;
                                    case 8:
                                        _i++;
                                        return [3 /*break*/, 3];
                                    case 9: 
                                    // Deduct from treasury
                                    return [4 /*yield*/, tx.syndicate.update({
                                            where: { id: syndicateId },
                                            data: {
                                                treasuryBalance: {
                                                    decrement: totalDividend
                                                }
                                            }
                                        })];
                                    case 10:
                                        // Deduct from treasury
                                        _a.sent();
                                        // Record treasury transaction
                                        return [4 /*yield*/, tx.syndicateTransaction.create({
                                                data: {
                                                    syndicateId: syndicateId,
                                                    userId: null, // System transaction
                                                    amount: -Number(totalDividend),
                                                    type: 'DIVIDEND_PAYOUT',
                                                    balanceBefore: syndicate.treasuryBalance,
                                                    balanceAfter: syndicate.treasuryBalance - totalDividend,
                                                    description: "Weekly dividend distribution to ".concat(eligibleMembers.length, " members"),
                                                    metadata: {
                                                        dividendId: dividend.id,
                                                        memberCount: eligibleMembers.length,
                                                        amountPerMember: Number(amountPerMember)
                                                    }
                                                }
                                            })];
                                    case 11:
                                        // Record treasury transaction
                                        _a.sent();
                                        logger_1.logger.info({
                                            type: 'dividend_payout_completed',
                                            syndicateId: syndicateId,
                                            syndicateName: syndicateName,
                                            totalAmount: Number(totalDividend),
                                            amountPerMember: Number(amountPerMember),
                                            eligibleMembers: eligibleMembers.length,
                                            jobId: job.id
                                        }, "Distributed ".concat(totalDividend, " chips to ").concat(eligibleMembers.length, " members of ").concat(syndicateName));
                                        return [2 /*return*/, {
                                                success: true,
                                                syndicateId: syndicateId,
                                                syndicateName: syndicateName,
                                                totalAmount: totalDividend,
                                                amountPerMember: amountPerMember,
                                                eligibleMembers: eligibleMembers.length
                                            }];
                                }
                            });
                        }); })];
                case 2:
                    result = _b.sent();
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _b.sent();
                    logger_1.logger.error({
                        type: 'dividend_payout_failed',
                        syndicateId: syndicateId,
                        syndicateName: syndicateName,
                        error: error_1 instanceof Error ? error_1.message : String(error_1),
                        stack: error_1 instanceof Error ? error_1.stack : undefined,
                        jobId: job.id
                    }, "Failed to process dividend for ".concat(syndicateName));
                    return [2 /*return*/, {
                            success: false,
                            syndicateId: syndicateId,
                            syndicateName: syndicateName,
                            error: error_1 instanceof Error ? error_1.message : String(error_1)
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create and start the worker
 */
function createPayoutWorker(redisConnection, io) {
    var _this = this;
    var worker = new bullmq_1.Worker('dividend-distribution', function (job) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, performance_1.measureDuration)('dividend-payout', function () { return processDividendPayout(job); }, {
                        syndicateId: job.data.syndicateId,
                        syndicateName: job.data.syndicateName,
                        jobId: job.id
                    })];
                case 1: 
                // Measure performance
                return [2 /*return*/, _a.sent()];
            }
        });
    }); }, {
        connection: redisConnection,
        concurrency: 1, // Process one at a time to avoid DB contention
        limiter: {
            max: 10, // Max 10 jobs per...
            duration: 60000 // ...60 seconds (prevents thundering herd)
        }
    });
    // Worker event handlers
    worker.on('completed', function (job, result) {
        logger_1.logger.info({
            type: 'worker_job_completed',
            jobId: job.id,
            syndicateId: result.syndicateId,
            syndicateName: result.syndicateName,
            success: result.success
        }, "Worker completed job ".concat(job.id));
        // Notify via Socket.IO if available
        if (io && result.success && result.totalAmount && result.totalAmount > 0n) {
            io.to("syndicate:".concat(result.syndicateId)).emit('dividend_distributed', {
                syndicateId: result.syndicateId,
                syndicateName: result.syndicateName,
                totalAmount: Number(result.totalAmount),
                amountPerMember: Number(result.amountPerMember),
                eligibleMembers: result.eligibleMembers
            });
        }
    });
    worker.on('failed', function (job, err) {
        var _a;
        logger_1.logger.error({
            type: 'worker_job_failed',
            jobId: job === null || job === void 0 ? void 0 : job.id,
            syndicateId: (_a = job === null || job === void 0 ? void 0 : job.data) === null || _a === void 0 ? void 0 : _a.syndicateId,
            error: err.message,
            attempts: job === null || job === void 0 ? void 0 : job.attemptsMade
        }, "Worker failed job ".concat(job === null || job === void 0 ? void 0 : job.id, " after ").concat(job === null || job === void 0 ? void 0 : job.attemptsMade, " attempts"));
    });
    worker.on('error', function (err) {
        logger_1.logger.error({
            type: 'worker_error',
            error: err.message
        }, 'Worker encountered an error');
    });
    logger_1.logger.info({
        type: 'worker_started',
        queue: 'dividend-distribution'
    }, 'Dividend payout worker started');
    return worker;
}
// If running as standalone worker process
if (require.main === module) {
    var redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    var redisConnection = {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port || '6379'),
        password: new URL(redisUrl).password || undefined
    };
    logger_1.logger.info('Starting standalone dividend payout worker...');
    var worker_1 = createPayoutWorker(redisConnection);
    // Graceful shutdown
    process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info('SIGTERM received, shutting down worker...');
                    return [4 /*yield*/, worker_1.close()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, prisma.$disconnect()];
                case 2:
                    _a.sent();
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    }); });
    process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    logger_1.logger.info('SIGINT received, shutting down worker...');
                    return [4 /*yield*/, worker_1.close()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, prisma.$disconnect()];
                case 2:
                    _a.sent();
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    }); });
}
exports.default = createPayoutWorker;
