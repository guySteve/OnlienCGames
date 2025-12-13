"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminRouter = createAdminRouter;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
function createAdminRouter(prisma, engagement) {
    const router = (0, express_1.Router)();
    const requireAuth = (req, res, next) => {
        if (!req.user || !req.user.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        next();
    };
    router.use(requireAuth);
    router.use(auth_1.isAdmin);
    // GET /api/admin/dashboard
    router.get('/dashboard', async (_req, res) => {
        try {
            const totalUsers = await prisma.user.count();
            const bannedUsers = await prisma.user.count({ where: { isBanned: true } });
            const flaggedMessages = await prisma.chatMessage.count({ where: { isFlagged: true } });
            // Assuming online users and active rooms are handled by another service or in-memory
            // For now, these will be placeholders or fetched from engagementService if available
            const onlineUsersCount = 0; // Placeholder
            const activeRoomsCount = 0; // Placeholder
            // Fetch recent moderation logs
            const recentModerations = await prisma.moderationLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: { User: true, Moderator: true },
            });
            return res.json({
                stats: {
                    totalUsers,
                    bannedUsers,
                    flaggedMessages,
                    onlineUsers: onlineUsersCount,
                    activeRooms: activeRoomsCount,
                },
                online: {
                    count: onlineUsersCount,
                    users: [], // Placeholder for actual online user data
                },
                recentModerations: recentModerations.map(log => ({
                    ...log,
                    createdAt: log.createdAt.toISOString(),
                    User: { displayName: log.User.displayName },
                    Moderator: log.Moderator ? { displayName: log.Moderator.displayName } : null,
                })),
            });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Admin dashboard error:', error);
                return res.status(500).json({ error: error.message });
            }
            else {
                return res.status(500).json({ error: String(error) });
            }
        }
    });
    // GET /api/admin/users
    router.get('/users', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const search = req.query.search || '';
            const skip = (page - 1) * limit;
            const whereClause = search ? {
                OR: [
                    { email: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                    { displayName: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                    { nickname: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                ],
            } : {};
            const users = await prisma.user.findMany({
                where: whereClause,
                take: limit,
                skip: skip,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    nickname: true,
                    chipBalance: true,
                    lastLogin: true,
                    warnCount: true,
                    isAdmin: true,
                    isBanned: true,
                    avatarUrl: true,
                    customAvatar: true,
                },
            });
            const totalUsers = await prisma.user.count({
                where: search ? {
                    OR: [
                        { email: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                        { displayName: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                        { nickname: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                    ],
                } : {},
            });
            return res.json({
                users: users.map(user => ({
                    ...user,
                    chipBalance: Number(user.chipBalance),
                    lastLogin: user.lastLogin?.toISOString(),
                })),
                pagination: {
                    total: totalUsers,
                    page,
                    limit,
                    pages: Math.ceil(totalUsers / limit),
                },
            });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Admin users error:', error);
                return res.status(500).json({ error: error.message });
            }
            else {
                return res.status(500).json({ error: String(error) });
            }
        }
    });
    // POST /api/admin/ban/:userId
    router.post('/ban/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const adminId = req.user.id; // Assuming admin's ID is available from auth middleware
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isBanned: true,
                    bannedAt: new Date(),
                    bannedBy: adminId,
                    banReason: reason,
                },
            });
            await prisma.moderationLog.create({
                data: {
                    userId,
                    moderatorId: adminId,
                    action: 'BAN',
                    reason,
                },
            });
            return res.json({ ok: true });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Admin ban error:', error);
                return res.status(500).json({ error: error.message });
            }
            else {
                return res.status(500).json({ error: String(error) });
            }
        }
    });
    // POST /api/admin/unban/:userId
    router.post('/unban/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const adminId = req.user.id;
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isBanned: false,
                    bannedAt: null,
                    bannedBy: null,
                    banReason: null,
                },
            });
            await prisma.moderationLog.create({
                data: {
                    userId,
                    moderatorId: adminId,
                    action: 'UNBAN',
                    reason: 'Unbanned by admin',
                },
            });
            return res.json({ ok: true });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Admin unban error:', error);
                return res.status(500).json({ error: error.message });
            }
            else {
                return res.status(500).json({ error: String(error) });
            }
        }
    });
    // POST /api/admin/broadcast
    router.post('/broadcast', async (req, res) => {
        try {
            const { message } = req.body;
            const adminId = req.user.id;
            // Assuming engagement service has a method to emit global events
            await engagement.emitGlobalEvent({
                type: 'ADMIN_BROADCAST',
                userId: adminId,
                data: { message },
            });
            return res.json({ ok: true });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Admin broadcast error:', error);
                return res.status(500).json({ error: error.message });
            }
            else {
                return res.status(500).json({ error: String(error) });
            }
        }
    });
    // POST /api/admin/set-admin/:userId
    router.post('/set-admin/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const { isAdmin } = req.body;
            const adminId = req.user.id;
            // Prevent admins from removing their own admin status
            if (userId === adminId && !isAdmin) {
                return res.status(400).json({ error: 'Cannot remove your own admin status' });
            }
            await prisma.user.update({
                where: { id: userId },
                data: { isAdmin },
            });
            await prisma.moderationLog.create({
                data: {
                    userId,
                    moderatorId: adminId,
                    action: isAdmin ? 'PROMOTE_ADMIN' : 'DEMOTE_ADMIN',
                    reason: isAdmin ? 'Promoted to admin' : 'Removed admin privileges',
                },
            });
            return res.json({ ok: true });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Admin set-admin error:', error);
                return res.status(500).json({ error: error.message });
            }
            else {
                return res.status(500).json({ error: String(error) });
            }
        }
    });
    return router;
}
//# sourceMappingURL=admin.js.map