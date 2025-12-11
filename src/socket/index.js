// src/socket/index.js
const crypto = require('crypto');
const { prisma } = require('../db');
const { sanitizeMessage } = require('../encryption');
const { getOperatingHoursStatus } = require('../middleware/operatingHours');
const { AutoModerationService } = require('../services/AutoModerationService');
const { EngagementService } = require('../services/EngagementService');
const { WarEngine } = require('../engines/WarEngine');
const {
    encryptDeadDrop,
    decryptDeadDrop,
    sanitizeMessage: sanitizeSecretMessage,
    validateMessage
} = require('../utils/secretComsEncryption');

const games = new Map();
const playerToGame = new Map();
const privateWarRooms = new Map();
const viewers = new Map();
const chat_history = new Map();

async function getUserProfile(googleId) {
    try {
        const user = await prisma.user.findUnique({
            where: { googleId },
            select: { nickname: true, customAvatar: true, displayName: true }
        });
        return {
            nickname: user?.nickname || user?.displayName || 'Player',
            avatar: user?.customAvatar || null
        };
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return { nickname: 'Player', avatar: null };
    }
}

function getRoomsSummary() {
    return Array.from(games.values()).map(g => ({ 
      roomId: g.config?.tableId || g.config?.roomId,
      displayName: g.config?.displayName,
      playerCount: g.getPlayerCount ? g.getPlayerCount() : 0,
      maxPlayers: g.config?.maxPlayers,
      gameType: g.getGameType ? g.getGameType() : 'UNKNOWN'
    }));
}

function initializeSocket(io, sessionMiddleware) {
    io.engine.use(sessionMiddleware);
    
    io.on('connection', (socket) => {
        const user = socket.request?.session?.passport?.user;
        const isAdminUser = user && user.isAdmin;

        if (!isAdminUser) {
            const { isOpen } = getOperatingHoursStatus();
            if (!isOpen) {
                socket.emit('error', { message: 'Casino is closed.' });
                return socket.disconnect(true);
            }
        }

        // Move all socket handlers from server.js here...
        // For brevity, only a few are shown, but all should be moved.
        




socket.on('create_room', async (config) => {
            const roomId = crypto.randomBytes(8).toString('hex');
            const game = new WarEngine(io, { ...config, roomId });
            games.set(roomId, game);
            playerToGame.set(socket.id, roomId);
            viewers.set(roomId, []);
            chat_history.set(roomId, []);
            socket.join(roomId);
            io.to('lobby').emit('rooms_update', getRoomsSummary());
            socket.emit('room_created', { roomId, gameState: game.getGameState() });
        });

        socket.on('join_room', async (data) => {
            const { roomId } = data;
            const game = games.get(roomId);
            if (game) {
                playerToGame.set(socket.id, roomId);
                socket.join(roomId);
                const userProfile = await getUserProfile(user.googleId);
                const viewersList = viewers.get(roomId);
                viewersList.push({ id: socket.id, ...userProfile });
                viewers.set(roomId, viewersList);
                io.to(roomId).emit('viewers_list', viewersList);
                socket.emit('room_joined', { roomId, gameState: game.getGameState() });
                socket.emit('chat_history', chat_history.get(roomId));
            } else {
                socket.emit('error', { message: 'Room not found' });
            }
        });

        socket.on('leave_room', (data) => {
            const { roomId } = data;
            const game = games.get(roomId);
            if (game) {
                playerToGame.delete(socket.id);
                socket.leave(roomId);
                const viewersList = viewers.get(roomId).filter(v => v.id !== socket.id);
                viewers.set(roomId, viewersList);
                io.to(roomId).emit('viewers_list', viewersList);
            }
        });

        socket.on('room_chat', async (data) => {
            const { roomId, msg } = data;
            const game = games.get(roomId);
            if (game) {
                const userProfile = await getUserProfile(user.googleId);
                const message = { from: userProfile.nickname, msg, photo: userProfile.avatar };
                const roomChatHistory = chat_history.get(roomId);
                roomChatHistory.push(message);
                chat_history.set(roomId, roomChatHistory);
                io.to(roomId).emit('room_message', message);
            }
        });

        socket.on('get_rooms', () => {
            socket.emit('rooms_list', getRoomsSummary());
        });

        // =============================================================================
        // SECRET COMMS - Dead Drop Encrypted Messaging
        // =============================================================================

        /**
         * Send encrypted message to online user (real-time)
         */
        socket.on('secretComs:send', async ({ recipientId, encrypted, timestamp }) => {
            try {
                if (!user || !user.id) {
                    return socket.emit('error', { message: 'Authentication required' });
                }

                // Validate input
                if (!recipientId || !encrypted) {
                    return socket.emit('error', { message: 'Invalid message data' });
                }

                // Get sender info
                const sender = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { id: true, displayName: true, customAvatar: true }
                });

                if (!sender) {
                    return socket.emit('error', { message: 'Sender not found' });
                }

                // Check if recipient exists
                const recipient = await prisma.user.findUnique({
                    where: { id: recipientId },
                    select: { id: true }
                });

                if (!recipient) {
                    return socket.emit('error', { message: 'Recipient not found' });
                }

                // Note: Frontend sends base64-encoded message
                // For real-time messages, we send plaintext (WebSocket is already TLS-encrypted)
                // Only Dead Drops need server-side encryption (at-rest protection)
                try {
                    // Decrypt what frontend sent (base64)
                    const plaintext = Buffer.from(encrypted, 'base64').toString('utf8');

                    // Sanitize
                    const sanitized = sanitizeSecretMessage(plaintext);

                    if (!validateMessage(sanitized)) {
                        return socket.emit('error', { message: 'Invalid message content' });
                    }

                    // Send to recipient (if online) - PLAINTEXT for real-time
                    // WebSocket over TLS provides transport encryption
                    io.to(recipientId).emit('secretComs:message', {
                        id: crypto.randomUUID(),
                        from: {
                            id: sender.id,
                            username: sender.displayName,
                            avatar: sender.customAvatar
                        },
                        content: sanitized, // Plaintext (WebSocket is encrypted)
                        timestamp: timestamp || Date.now(),
                        encrypted: false // Flag for frontend
                    });

                    // Acknowledge to sender
                    socket.emit('secretComs:messageSent', {
                        success: true,
                        recipientId,
                        timestamp
                    });

                } catch (encError) {
                    console.error('SecretComs encryption error:', encError);
                    return socket.emit('error', { message: 'Encryption failed' });
                }

            } catch (error) {
                console.error('SecretComs send error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        /**
         * Leave encrypted Dead Drop for offline user
         */
        socket.on('secretComs:deadDrop', async ({ recipientId, encrypted, expiresIn }) => {
            try {
                if (!user || !user.id) {
                    return socket.emit('error', { message: 'Authentication required' });
                }

                // Validate input
                if (!recipientId || !encrypted) {
                    return socket.emit('error', { message: 'Invalid Dead Drop data' });
                }

                const expirationMs = expiresIn || 86400000; // Default 24 hours
                const expiresAt = new Date(Date.now() + expirationMs);

                // Get sender info
                const sender = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { id: true, displayName: true, customAvatar: true }
                });

                if (!sender) {
                    return socket.emit('error', { message: 'Sender not found' });
                }

                // Check if recipient exists
                const recipient = await prisma.user.findUnique({
                    where: { id: recipientId },
                    select: { id: true }
                });

                if (!recipient) {
                    return socket.emit('error', { message: 'Recipient not found' });
                }

                try {
                    // Decrypt what frontend sent (base64)
                    const plaintext = Buffer.from(encrypted, 'base64').toString('utf8');

                    // Sanitize
                    const sanitized = sanitizeSecretMessage(plaintext);

                    if (!validateMessage(sanitized)) {
                        return socket.emit('error', { message: 'Invalid message content' });
                    }

                    // Encrypt with proper AES-256-GCM
                    const encryptedContent = encryptDeadDrop(sanitized);

                    // Store in database
                    const deadDrop = await prisma.deadDropMessage.create({
                        data: {
                            fromUserId: sender.id,
                            toUserId: recipientId,
                            encryptedContent,
                            expiresAt,
                            viewed: false
                        },
                        include: {
                            fromUser: {
                                select: {
                                    id: true,
                                    displayName: true,
                                    customAvatar: true
                                }
                            }
                        }
                    });

                    // Notify recipient if online
                    io.to(recipientId).emit('secretComs:deadDrop', {
                        id: deadDrop.id,
                        from: {
                            id: sender.id,
                            username: sender.displayName,
                            avatar: sender.customAvatar
                        },
                        timestamp: deadDrop.createdAt.getTime(),
                        expiresAt: deadDrop.expiresAt.getTime()
                    });

                    // Acknowledge to sender
                    socket.emit('secretComs:deadDropCreated', {
                        success: true,
                        dropId: deadDrop.id,
                        recipientId,
                        expiresAt: deadDrop.expiresAt.getTime()
                    });

                } catch (encError) {
                    console.error('Dead Drop encryption error:', encError);
                    return socket.emit('error', { message: 'Encryption failed' });
                }

            } catch (error) {
                console.error('Dead Drop creation error:', error);
                socket.emit('error', { message: 'Failed to create Dead Drop' });
            }
        });

        /**
         * Retrieve and decrypt Dead Drop
         */
        socket.on('secretComs:retrieveDeadDrop', async ({ dropId }) => {
            try {
                if (!user || !user.id) {
                    return socket.emit('error', { message: 'Authentication required' });
                }

                if (!dropId) {
                    return socket.emit('error', { message: 'Drop ID required' });
                }

                // Fetch Dead Drop
                const drop = await prisma.deadDropMessage.findUnique({
                    where: { id: dropId },
                    include: {
                        fromUser: {
                            select: {
                                id: true,
                                displayName: true,
                                customAvatar: true
                            }
                        }
                    }
                });

                if (!drop) {
                    return socket.emit('error', { message: 'Dead Drop not found' });
                }

                // Verify recipient
                if (drop.toUserId !== user.id) {
                    return socket.emit('error', { message: 'Unauthorized' });
                }

                // Check expiration
                if (new Date() > drop.expiresAt) {
                    // Delete expired drop
                    await prisma.deadDropMessage.delete({ where: { id: dropId } });
                    return socket.emit('error', { message: 'Dead Drop expired' });
                }

                try {
                    // Decrypt message
                    const decryptedContent = decryptDeadDrop(drop.encryptedContent);

                    // Mark as viewed
                    await prisma.deadDropMessage.update({
                        where: { id: dropId },
                        data: { viewed: true }
                    });

                    // Send decrypted message to client
                    socket.emit('secretComs:deadDropRetrieved', {
                        id: drop.id,
                        from: {
                            id: drop.fromUser.id,
                            username: drop.fromUser.displayName,
                            avatar: drop.fromUser.customAvatar
                        },
                        content: decryptedContent, // Send plaintext (over encrypted socket)
                        timestamp: drop.createdAt.getTime(),
                        expiresAt: drop.expiresAt.getTime()
                    });

                } catch (decError) {
                    console.error('Dead Drop decryption error:', decError);
                    return socket.emit('error', { message: 'Decryption failed - message may be corrupted' });
                }

            } catch (error) {
                console.error('Dead Drop retrieval error:', error);
                socket.emit('error', { message: 'Failed to retrieve Dead Drop' });
            }
        });

        /**
         * Get pending Dead Drops for current user
         */
        socket.on('secretComs:getPendingDrops', async () => {
            try {
                if (!user || !user.id) {
                    return socket.emit('error', { message: 'Authentication required' });
                }

                const now = new Date();

                // Get all unviewed, non-expired drops
                const drops = await prisma.deadDropMessage.findMany({
                    where: {
                        toUserId: user.id,
                        viewed: false,
                        expiresAt: {
                            gt: now
                        }
                    },
                    include: {
                        fromUser: {
                            select: {
                                id: true,
                                displayName: true,
                                customAvatar: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                });

                // Send list to client (without decrypting - client requests individual drops)
                socket.emit('secretComs:pendingDrops', {
                    drops: drops.map(drop => ({
                        id: drop.id,
                        from: {
                            id: drop.fromUser.id,
                            username: drop.fromUser.displayName,
                            avatar: drop.fromUser.customAvatar
                        },
                        timestamp: drop.createdAt.getTime(),
                        expiresAt: drop.expiresAt.getTime()
                    }))
                });

            } catch (error) {
                console.error('Get pending drops error:', error);
                socket.emit('error', { message: 'Failed to fetch Dead Drops' });
            }
        });

        /**
         * Typing indicator for Secret Comms
         */
        socket.on('secretComs:typing', async ({ recipientId, username }) => {
            try {
                if (!user || !user.id) return;

                io.to(recipientId).emit('secretComs:typing', {
                    userId: user.id,
                    username: username || user.displayName
                });
            } catch (error) {
                console.error('Typing indicator error:', error);
            }
        });

        /**
         * Get friends list for Secret Comms
         */
        socket.on('secretComs:getFriends', async () => {
            try {
                if (!user || !user.id) {
                    return socket.emit('error', { message: 'Authentication required' });
                }

                // Get accepted friendships
                const friendships = await prisma.friendship.findMany({
                    where: {
                        OR: [
                            { userId: user.id, status: 'ACCEPTED' },
                            { friendId: user.id, status: 'ACCEPTED' }
                        ]
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                customAvatar: true,
                                lastLogin: true
                            }
                        },
                        friend: {
                            select: {
                                id: true,
                                displayName: true,
                                customAvatar: true,
                                lastLogin: true
                            }
                        }
                    }
                });

                // Extract friends and determine online status
                const friends = friendships.map(f => {
                    const friend = f.userId === user.id ? f.friend : f.user;

                    // Check if friend is online (has active socket)
                    // This is a simplified check - in production you'd track connected sockets
                    const isOnline = friend.lastLogin &&
                        (Date.now() - friend.lastLogin.getTime() < 300000); // 5 min

                    return {
                        id: friend.id,
                        username: friend.displayName,
                        avatar: friend.customAvatar,
                        online: isOnline
                    };
                });

                const online = friends.filter(f => f.online);
                const offline = friends.filter(f => !f.online);

                socket.emit('friends:status', { online, offline });

            } catch (error) {
                console.error('Get friends error:', error);
                socket.emit('error', { message: 'Failed to fetch friends' });
            }
        });

        // =============================================================================
        // END SECRET COMMS
        // =============================================================================

        socket.on('disconnect', () => {
            const roomId = playerToGame.get(socket.id);
            if (roomId) {
                const game = games.get(roomId);
                if (game) {
                    // This logic should be delegated to the game engine
                    // game.removePlayer(socket.id); 
                    const viewersList = viewers.get(roomId).filter(v => v.id !== socket.id);
                    viewers.set(roomId, viewersList);
                    io.to(roomId).emit('viewers_list', viewersList);
                    io.to(roomId).emit('player_disconnected', { gameState: game.getGameState() });
                    if (game.getPlayerCount() === 0) {
                        games.delete(roomId);
                        io.to('lobby').emit('rooms_update', getRoomsSummary());
                    }
                }
                playerToGame.delete(socket.id);
            }
        });
    });
}

module.exports = { initializeSocket };
