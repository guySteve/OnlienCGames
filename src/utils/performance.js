"use strict";
/**
 * Performance Instrumentation Utilities
 *
 * Tools for measuring execution time and identifying performance bottlenecks.
 * Critical for auto-scaling decisions and SLA monitoring.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.metricsTracker = void 0;
exports.measureDuration = measureDuration;
exports.InstrumentClass = InstrumentClass;
exports.Instrument = Instrument;
exports.startTimer = startTimer;
exports.startMetricsReporting = startMetricsReporting;
exports.measureDbOperation = measureDbOperation;
exports.measureGameLoop = measureGameLoop;
var logger_1 = require("./logger");
/**
 * Measure execution duration of a synchronous or asynchronous function
 *
 * Usage:
 *   const result = await measureDuration('calculateWin', () => gameEngine.calculateWin(bet));
 *   // Logs: "calculateWin completed in 45ms"
 */
function measureDuration(operationName, fn, context) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, result, durationMs, error_1, durationMs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = performance.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fn()];
                case 2:
                    result = _a.sent();
                    durationMs = Math.round(performance.now() - startTime);
                    // Log performance metric
                    logger_1.logger.info(__assign({ type: 'performance_metric', operation: operationName, duration_ms: durationMs }, context), "".concat(operationName, " completed in ").concat(durationMs, "ms"));
                    // Warn if operation exceeds threshold
                    if (durationMs > 200) {
                        logger_1.logger.warn(__assign({ type: 'performance_warning', operation: operationName, duration_ms: durationMs, threshold_ms: 200 }, context), "\u26A0\uFE0F ".concat(operationName, " exceeded 200ms threshold (").concat(durationMs, "ms)"));
                    }
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    durationMs = Math.round(performance.now() - startTime);
                    logger_1.logger.error(__assign({ type: 'performance_error', operation: operationName, duration_ms: durationMs, error: error_1 instanceof Error ? error_1.message : String(error_1) }, context), "".concat(operationName, " failed after ").concat(durationMs, "ms"));
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Class decorator for measuring all methods
 *
 * Usage:
 *   @InstrumentClass
 *   class GameEngine {
 *     calculateWin(bet) { ... }
 *   }
 */
function InstrumentClass(constructor) {
    var className = constructor.name;
    Object.getOwnPropertyNames(constructor.prototype).forEach(function (methodName) {
        if (methodName === 'constructor')
            return;
        var originalMethod = constructor.prototype[methodName];
        if (typeof originalMethod !== 'function')
            return;
        constructor.prototype[methodName] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    return [2 /*return*/, measureDuration("".concat(className, ".").concat(methodName), function () { return originalMethod.apply(_this, args); })];
                });
            });
        };
    });
}
/**
 * Method decorator for measuring individual methods
 *
 * Usage:
 *   class GameEngine {
 *     @Instrument
 *     calculateWin(bet) { ... }
 *   }
 */
function Instrument(target, propertyKey, descriptor) {
    var originalMethod = descriptor.value;
    var className = target.constructor.name;
    descriptor.value = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, measureDuration("".concat(className, ".").concat(propertyKey), function () { return originalMethod.apply(_this, args); })];
            });
        });
    };
    return descriptor;
}
/**
 * Simple timer for manual tracking
 *
 * Usage:
 *   const timer = startTimer();
 *   // ... do work
 *   const duration = timer.stop();
 *   logger.info(`Operation took ${duration}ms`);
 */
function startTimer() {
    var startTime = performance.now();
    return {
        stop: function () { return Math.round(performance.now() - startTime); },
        elapsed: function () { return Math.round(performance.now() - startTime); }
    };
}
/**
 * Track operation metrics (count, duration, errors)
 */
var MetricsTracker = /** @class */ (function () {
    function MetricsTracker() {
        this.metrics = new Map();
    }
    MetricsTracker.prototype.track = function (operation, durationMs, isError) {
        if (isError === void 0) { isError = false; }
        var current = this.metrics.get(operation) || {
            count: 0,
            totalDuration: 0,
            errors: 0,
            minDuration: Infinity,
            maxDuration: 0
        };
        current.count++;
        current.totalDuration += durationMs;
        if (isError)
            current.errors++;
        current.minDuration = Math.min(current.minDuration, durationMs);
        current.maxDuration = Math.max(current.maxDuration, durationMs);
        this.metrics.set(operation, current);
    };
    MetricsTracker.prototype.getMetrics = function (operation) {
        var metric = this.metrics.get(operation);
        if (!metric)
            return null;
        return {
            operation: operation,
            count: metric.count,
            avgDuration: Math.round(metric.totalDuration / metric.count),
            minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
            maxDuration: metric.maxDuration,
            errorRate: metric.count > 0 ? (metric.errors / metric.count) * 100 : 0,
            errors: metric.errors
        };
    };
    MetricsTracker.prototype.getAllMetrics = function () {
        var _this = this;
        var results = [];
        this.metrics.forEach(function (_, operation) {
            var metric = _this.getMetrics(operation);
            if (metric)
                results.push(metric);
        });
        return results.sort(function (a, b) { return b.avgDuration - a.avgDuration; });
    };
    MetricsTracker.prototype.reset = function () {
        this.metrics.clear();
    };
    MetricsTracker.prototype.logSummary = function () {
        var metrics = this.getAllMetrics();
        logger_1.logger.info({
            type: 'performance_summary',
            metrics: metrics
        }, "Performance summary: ".concat(metrics.length, " operations tracked"));
    };
    return MetricsTracker;
}());
exports.metricsTracker = new MetricsTracker();
/**
 * Auto-log metrics summary every N minutes
 */
function startMetricsReporting(intervalMinutes) {
    if (intervalMinutes === void 0) { intervalMinutes = 5; }
    setInterval(function () {
        exports.metricsTracker.logSummary();
    }, intervalMinutes * 60 * 1000);
}
/**
 * Measure database operation duration
 */
function measureDbOperation(operation, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, result, durationMs, error_2, durationMs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = performance.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fn()];
                case 2:
                    result = _a.sent();
                    durationMs = Math.round(performance.now() - startTime);
                    exports.metricsTracker.track("db:".concat(operation), durationMs, false);
                    if (durationMs > 100) {
                        logger_1.logger.warn({
                            type: 'slow_query',
                            operation: operation,
                            duration_ms: durationMs
                        }, "Slow database query: ".concat(operation, " (").concat(durationMs, "ms)"));
                    }
                    return [2 /*return*/, result];
                case 3:
                    error_2 = _a.sent();
                    durationMs = Math.round(performance.now() - startTime);
                    exports.metricsTracker.track("db:".concat(operation), durationMs, true);
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Measure game loop iteration
 */
function measureGameLoop(gameType, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, result, durationMs, error_3, durationMs;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = performance.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fn()];
                case 2:
                    result = _a.sent();
                    durationMs = Math.round(performance.now() - startTime);
                    exports.metricsTracker.track("game:".concat(gameType), durationMs, false);
                    // Critical: Game loop must stay under 200ms for responsive gameplay
                    if (durationMs > 200) {
                        logger_1.logger.error({
                            type: 'game_loop_lag',
                            gameType: gameType,
                            duration_ms: durationMs,
                            threshold_ms: 200
                        }, "\uD83D\uDEA8 Game loop lag detected: ".concat(gameType, " (").concat(durationMs, "ms)"));
                    }
                    return [2 /*return*/, result];
                case 3:
                    error_3 = _a.sent();
                    durationMs = Math.round(performance.now() - startTime);
                    exports.metricsTracker.track("game:".concat(gameType), durationMs, true);
                    throw error_3;
                case 4: return [2 /*return*/];
            }
        });
    });
}
exports.default = {
    measureDuration: measureDuration,
    startTimer: startTimer,
    measureDbOperation: measureDbOperation,
    measureGameLoop: measureGameLoop,
    metricsTracker: exports.metricsTracker,
    startMetricsReporting: startMetricsReporting,
    InstrumentClass: InstrumentClass,
    Instrument: Instrument
};
