"use strict";
/**
 * VegasCore Happy Hour Scheduler
 *
 * Manages both scheduled and random happy hour events
 *
 * Psychology:
 * - Random events create anticipation and FOMO
 * - Scheduled events build habit (e.g., daily 8pm happy hour)
 * - Visual countdowns create urgency
 */

const BONUS_TYPES = ['XP_BOOST', 'CHIP_BOOST', 'MYSTERY_BOOST', 'STREAK_PROTECT'];

const DEFAULT_SCHEDULES = [
    // Weekend evening boost (Friday/Saturday 8-9 PM local time zones)
    { dayOfWeek: 5, hourOfDay: 20, durationMinutes: 60, bonusType: 'CHIP_BOOST', multiplier: 1.5 },
    { dayOfWeek: 6, hourOfDay: 20, durationMinutes: 60, bonusType: 'CHIP_BOOST', multiplier: 1.5 },

    // Sunday streak protection (help people maintain streaks)
    { dayOfWeek: 0, hourOfDay: 22, durationMinutes: 120, bonusType: 'STREAK_PROTECT', multiplier: 1.0 },

    // Wednesday hump day boost
    { dayOfWeek: 3, hourOfDay: 19, durationMinutes: 60, bonusType: 'XP_BOOST', multiplier: 2.0 },
];

class HappyHourScheduler {
    constructor(prisma, redis, io) {
        this.prisma = prisma;
        this.redis = redis;
        this.io = io;
        this.intervalId = null;
        this.activeEvent = null;
    }

    /**
     * Initialize default schedules if none exist
     */
    async initializeSchedules() {
        const existingCount = await this.prisma.happyHourSchedule.count();

        if (existingCount === 0) {
            console.log('[HappyHourScheduler] Initializing default schedules...');

            for (const schedule of DEFAULT_SCHEDULES) {
                await this.prisma.happyHourSchedule.create({
                    data: {
                        dayOfWeek: schedule.dayOfWeek,
                        hourOfDay: schedule.hourOfDay,
                        durationMinutes: schedule.durationMinutes,
                        multiplier: schedule.multiplier,
                        bonusType: schedule.bonusType,
                        isRandom: false,
                        isActive: true
                    }
                });
            }

            // Also add a random event config
            await this.prisma.happyHourSchedule.create({
                data: {
                    durationMinutes: 45,
                    multiplier: 1.5,
                    bonusType: 'MYSTERY_BOOST',
                    isRandom: true,
                    minGapHours: 6,
                    isActive: true
                }
            });

            console.log('[HappyHourScheduler] Default schedules created');
        }
    }

    /**
     * Check for scheduled events
     */
    async checkScheduledEvents() {
        const now = new Date();
        const currentDay = now.getUTCDay();
        const currentHour = now.getUTCHours();

        // Find matching scheduled event
        const schedule = await this.prisma.happyHourSchedule.findFirst({
            where: {
                isActive: true,
                isRandom: false,
                dayOfWeek: currentDay,
                hourOfDay: currentHour
            }
        });

        if (!schedule) return null;

        // Check if this event is already running
        const existing = await this.prisma.happyHour.findFirst({
            where: {
                active: true,
                startTime: { lte: now },
                endTime: { gte: now }
            }
        });

        if (existing) return null;

        // Check if we already triggered this scheduled event today
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);

        const recentEvent = await this.prisma.happyHour.findFirst({
            where: {
                startTime: { gte: todayStart },
                metadata: {
                    path: ['scheduleId'],
                    equals: schedule.id
                }
            }
        });

        if (recentEvent) return null;

        // Trigger the scheduled event
        return this.triggerEvent(schedule);
    }

    /**
     * Check for random event opportunity
     */
    async checkRandomEvent() {
        const now = new Date();

        // Get random event config
        const randomConfig = await this.prisma.happyHourSchedule.findFirst({
            where: {
                isActive: true,
                isRandom: true
            }
        });

        if (!randomConfig) return null;

        // Check if any event is currently active
        const activeEvent = await this.prisma.happyHour.findFirst({
            where: {
                active: true,
                startTime: { lte: now },
                endTime: { gte: now }
            }
        });

        if (activeEvent) return null;

        // Check minimum gap since last event
        const lastEvent = await this.prisma.happyHour.findFirst({
            orderBy: { endTime: 'desc' }
        });

        if (lastEvent) {
            const hoursSinceLastEvent = (now.getTime() - lastEvent.endTime.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastEvent < randomConfig.minGapHours) {
                return null;
            }
        }

        // Random chance to trigger (5% per check when eligible)
        // Higher chance during "prime time" (evenings)
        const hour = now.getUTCHours();
        let triggerChance = 0.05; // 5% base

        // Boost chance during evening hours (17:00 - 23:00 UTC)
        if (hour >= 17 && hour <= 23) {
            triggerChance = 0.10; // 10%
        }

        // Boost on weekends
        const dayOfWeek = now.getUTCDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            triggerChance *= 1.5;
        }

        if (Math.random() > triggerChance) {
            return null;
        }

        // Select random bonus type
        const bonusType = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];

        // Random duration (30-90 minutes)
        const durationMinutes = 30 + Math.floor(Math.random() * 60);

        // Random multiplier (1.25 - 2.0)
        const multiplier = 1.25 + (Math.random() * 0.75);

        return this.triggerEvent({
            ...randomConfig,
            bonusType,
            durationMinutes,
            multiplier: Math.round(multiplier * 100) / 100,
            isRandom: true
        });
    }

    /**
     * Trigger a happy hour event
     */
    async triggerEvent(config) {
        const now = new Date();
        const endTime = new Date(now.getTime() + config.durationMinutes * 60 * 1000);

        console.log(`[HappyHourScheduler] Triggering ${config.bonusType} event for ${config.durationMinutes} minutes`);

        const event = await this.prisma.happyHour.create({
            data: {
                id: require('crypto').randomUUID(),
                startTime: now,
                endTime,
                multiplier: config.multiplier,
                active: true
            }
        });

        // Cache the active event
        await this.redis.set('happy_hour:active', JSON.stringify({
            id: event.id,
            bonusType: config.bonusType,
            multiplier: config.multiplier,
            startTime: now.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: config.durationMinutes,
            isRandom: config.isRandom || false
        }), { ex: config.durationMinutes * 60 });

        // Broadcast to all connected clients
        if (this.io) {
            this.io.emit('happy_hour_started', {
                bonusType: config.bonusType,
                multiplier: config.multiplier,
                endTime: endTime.toISOString(),
                durationMinutes: config.durationMinutes,
                isRandom: config.isRandom || false
            });
        }

        // Add to global ticker
        await this.redis.lpush('global:ticker', JSON.stringify({
            type: 'HAPPY_HOUR_START',
            data: {
                bonusType: config.bonusType,
                multiplier: config.multiplier,
                durationMinutes: config.durationMinutes
            },
            timestamp: Date.now()
        }));
        await this.redis.ltrim('global:ticker', 0, 99);

        // Schedule end notification
        this.scheduleEndNotification(event.id, endTime);

        this.activeEvent = {
            id: event.id,
            bonusType: config.bonusType,
            multiplier: config.multiplier,
            endTime
        };

        return event;
    }

    /**
     * Schedule end-of-event notification
     */
    scheduleEndNotification(eventId, endTime) {
        const msUntilEnd = endTime.getTime() - Date.now();

        if (msUntilEnd <= 0) return;

        // Warning at 5 minutes remaining
        if (msUntilEnd > 5 * 60 * 1000) {
            setTimeout(() => {
                if (this.io) {
                    this.io.emit('happy_hour_ending_soon', {
                        eventId,
                        minutesRemaining: 5
                    });
                }
            }, msUntilEnd - 5 * 60 * 1000);
        }

        // End notification
        setTimeout(async () => {
            await this.endEvent(eventId);
        }, msUntilEnd);
    }

    /**
     * End an active event
     */
    async endEvent(eventId) {
        console.log(`[HappyHourScheduler] Ending event ${eventId}`);

        await this.prisma.happyHour.update({
            where: { id: eventId },
            data: { active: false }
        });

        await this.redis.del('happy_hour:active');

        if (this.io) {
            this.io.emit('happy_hour_ended', { eventId });
        }

        if (this.activeEvent?.id === eventId) {
            this.activeEvent = null;
        }
    }

    /**
     * Get current active event
     */
    async getActiveEvent() {
        const cached = await this.redis.get('happy_hour:active');
        if (cached) {
            const event = JSON.parse(cached);
            if (new Date(event.endTime) > new Date()) {
                return event;
            }
        }

        const event = await this.prisma.happyHour.findFirst({
            where: {
                active: true,
                startTime: { lte: new Date() },
                endTime: { gte: new Date() }
            }
        });

        return event;
    }

    /**
     * Get upcoming scheduled events
     */
    async getUpcomingEvents(limit = 5) {
        const now = new Date();
        const currentDay = now.getUTCDay();
        const currentHour = now.getUTCHours();

        const schedules = await this.prisma.happyHourSchedule.findMany({
            where: {
                isActive: true,
                isRandom: false
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { hourOfDay: 'asc' }
            ]
        });

        const upcoming = [];

        for (const schedule of schedules) {
            // Calculate next occurrence
            let daysUntil = schedule.dayOfWeek - currentDay;
            if (daysUntil < 0 || (daysUntil === 0 && schedule.hourOfDay <= currentHour)) {
                daysUntil += 7;
            }

            const nextOccurrence = new Date(now);
            nextOccurrence.setUTCDate(now.getUTCDate() + daysUntil);
            nextOccurrence.setUTCHours(schedule.hourOfDay, 0, 0, 0);

            upcoming.push({
                bonusType: schedule.bonusType,
                multiplier: schedule.multiplier,
                durationMinutes: schedule.durationMinutes,
                scheduledFor: nextOccurrence,
                daysUntil
            });
        }

        // Sort by next occurrence and limit
        upcoming.sort((a, b) => a.scheduledFor - b.scheduledFor);
        return upcoming.slice(0, limit);
    }

    /**
     * Start the scheduler
     */
    async start(checkIntervalMs = 60000) {
        console.log('[HappyHourScheduler] Starting scheduler...');

        // Initialize default schedules if needed
        await this.initializeSchedules();

        // Check for already active events on startup
        const activeEvent = await this.getActiveEvent();
        if (activeEvent) {
            this.activeEvent = activeEvent;
            console.log(`[HappyHourScheduler] Found active event: ${activeEvent.bonusType || 'UNKNOWN'}`);

            // Schedule end notification
            if (activeEvent.endTime) {
                this.scheduleEndNotification(activeEvent.id, new Date(activeEvent.endTime));
            }
        }

        // Start periodic checks
        this.intervalId = setInterval(async () => {
            try {
                // Check scheduled events first
                await this.checkScheduledEvents();

                // Then check for random events
                await this.checkRandomEvent();

            } catch (error) {
                console.error('[HappyHourScheduler] Error in check cycle:', error);
            }
        }, checkIntervalMs);

        console.log(`[HappyHourScheduler] Scheduler running (check interval: ${checkIntervalMs}ms)`);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[HappyHourScheduler] Scheduler stopped');
        }
    }

    /**
     * Manually trigger an event (admin use)
     */
    async triggerManual(bonusType = 'XP_BOOST', durationMinutes = 60, multiplier = 1.5) {
        console.log(`[HappyHourScheduler] Manual trigger: ${bonusType} for ${durationMinutes}min`);

        return this.triggerEvent({
            bonusType,
            durationMinutes,
            multiplier,
            isRandom: false
        });
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: !!this.intervalId,
            activeEvent: this.activeEvent,
            nextCheck: this.intervalId ? 'Within 1 minute' : 'Scheduler stopped'
        };
    }
}

// Factory
function createHappyHourScheduler(prisma, redis, io) {
    return new HappyHourScheduler(prisma, redis, io);
}

module.exports = {
    HappyHourScheduler,
    createHappyHourScheduler,
    BONUS_TYPES,
    DEFAULT_SCHEDULES
};
