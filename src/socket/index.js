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

// Initialize engagement service for game engines
const engagementService = new EngagementService(prisma);

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
                socket.emit('error', { message: 'Card room is closed.' });
                return socket.disconnect(true);
            }
        }

        // Move all socket handlers from server.js here...
        // For brevity, only a few are shown, but all should be moved.
        




socket.on('create_room', async (config) => {
            const roomId = crypto.randomBytes(8).toString('hex');
            // Create WarEngine with correct parameters: (roomId, prisma, redis, engagement)
            const game = new WarEngine(roomId, prisma, null, engagementService);
            games.set(roomId, game);
            playerToGame.set(socket.id, roomId);
            viewers.set(roomId, []);
            chat_history.set(roomId, []);
            socket.join(roomId);

            // Connect the user to the game
            if (user && user.id) {
                const userProfile = await getUserProfile(user.googleId);
                await game.connectPlayer(user.id, userProfile.nickname);
                socket.emit('room_created', { roomId, gameState: game.getPlayerState(user.id) });
            } else {
                socket.emit('room_created', { roomId, gameState: game.getGameState() });
            }

            io.to('lobby').emit('rooms_update', getRoomsSummary());
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
        // CASINO WAR GAME HANDLERS
        // =============================================================================

        /**
         * Join a war game room (alternative to generic join_room for war-specific setup)
         */
        socket.on('join_private_war', async (data) => {
            const { tableCode } = data;
            const roomId = tableCode;
            const game = games.get(roomId);

            if (!game || game.getGameType() !== 'WAR') {
                return socket.emit('error', { message: 'War room not found' });
            }

            if (!user || !user.id) {
                return socket.emit('error', { message: 'Authentication required' });
            }

            try {
                // Connect player to war game
                const userProfile = await getUserProfile(user.googleId);
                const result = await game.connectPlayer(user.id, userProfile.nickname);

                if (!result.success) {
                    return socket.emit('error', { message: 'Failed to join game' });
                }

                // Join socket room
                playerToGame.set(socket.id, roomId);
                socket.join(roomId);

                // Add to viewers list
                const viewersList = viewers.get(roomId) || [];
                viewersList.push({ id: socket.id, ...userProfile });
                viewers.set(roomId, viewersList);

                // Notify all players in room
                io.to(roomId).emit('viewers_list', viewersList);
                io.to(roomId).emit('opponent_joined', { gameState: game.getGameState() });

                // Send game state to joining player
                socket.emit('private_war_joined', {
                    roomId,
                    gameState: game.getPlayerState(user.id),
                    playerColor: result.color,
                    playerChips: result.chips
                });

                socket.emit('chat_history', chat_history.get(roomId) || []);
            } catch (error) {
                console.error('Error joining war game:', error);
                socket.emit('error', { message: 'Failed to join game' });
            }
        });

        /**
         * Place a bet on a war spot
         */
        socket.on('place_war_bet', async (data) => {
            const { spotIndex, betAmount } = data;
            const roomId = playerToGame.get(socket.id);

            if (!roomId) {
                return socket.emit('error', { message: 'Not in a game room' });
            }

            const game = games.get(roomId);
            if (!game || game.getGameType() !== 'WAR') {
                return socket.emit('error', { message: 'Invalid game' });
            }

            if (!user || !user.id) {
                return socket.emit('error', { message: 'Authentication required' });
            }

            try {
                const success = await game.placeBet(user.id, betAmount, spotIndex);

                if (success) {
                    // Broadcast updated game state to all players
                    io.to(roomId).emit('war_bet_placed', {
                        gameState: game.getGameState(),
                        spotIndex,
                        userId: user.id,
                        betAmount
                    });
                } else {
                    socket.emit('error', { message: 'Failed to place bet - spot may be occupied or insufficient chips' });
                }
            } catch (error) {
                console.error('Error placing war bet:', error);
                socket.emit('error', { message: 'Failed to place bet' });
            }
        });

        /**
         * Remove a bet from a war spot
         */
        socket.on('remove_war_bet', async (data) => {
            const { spotIndex } = data;
            const roomId = playerToGame.get(socket.id);

            if (!roomId) {
                return socket.emit('error', { message: 'Not in a game room' });
            }

            const game = games.get(roomId);
            if (!game || game.getGameType() !== 'WAR') {
                return socket.emit('error', { message: 'Invalid game' });
            }

            if (!user || !user.id) {
                return socket.emit('error', { message: 'Authentication required' });
            }

            try {
                const success = game.removeBet(user.id, spotIndex);

                if (success) {
                    // Broadcast updated game state
                    io.to(roomId).emit('war_bet_removed', {
                        gameState: game.getGameState(),
                        spotIndex,
                        userId: user.id
                    });
                } else {
                    socket.emit('error', { message: 'Failed to remove bet - not your spot or betting phase ended' });
                }
            } catch (error) {
                console.error('Error removing war bet:', error);
                socket.emit('error', { message: 'Failed to remove bet' });
            }
        });

        /**
         * Start a new war hand (admin/dealer action)
         */
        socket.on('start_war_hand', async () => {
            const roomId = playerToGame.get(socket.id);

            if (!roomId) {
                return socket.emit('error', { message: 'Not in a game room' });
            }

            const game = games.get(roomId);
            if (!game || game.getGameType() !== 'WAR') {
                return socket.emit('error', { message: 'Invalid game' });
            }

            try {
                await game.startNewHand();

                // Broadcast hand started event
                io.to(roomId).emit('war_hand_started', {
                    gameState: game.getGameState()
                });

                // If hand resolved immediately (no ties), broadcast results
                if (game.state === 'COMPLETE') {
                    io.to(roomId).emit('war_hand_resolved', {
                        gameState: game.getGameState(),
                        results: game.getActiveSpots().map(({ index, spot }) => ({
                            spotIndex: index,
                            userId: spot.playerId,
                            bet: spot.bet,
                            card: spot.card,
                            payout: spot.payout || 0
                        }))
                    });
                }
            } catch (error) {
                console.error('Error starting war hand:', error);
                socket.emit('error', { message: 'Failed to start hand' });
            }
        });

        /**
         * Make war decision (surrender or go to war)
         */
        socket.on('make_war_decision', async (data) => {
            const { spotIndex, decision } = data; // decision: 'surrender' or 'war'
            const roomId = playerToGame.get(socket.id);

            if (!roomId) {
                return socket.emit('error', { message: 'Not in a game room' });
            }

            const game = games.get(roomId);
            if (!game || game.getGameType() !== 'WAR') {
                return socket.emit('error', { message: 'Invalid game' });
            }

            if (!user || !user.id) {
                return socket.emit('error', { message: 'Authentication required' });
            }

            try {
                const success = await game.makeWarDecision(user.id, spotIndex, decision);

                if (success) {
                    // Broadcast decision
                    io.to(roomId).emit('war_decision_made', {
                        gameState: game.getGameState(),
                        spotIndex,
                        userId: user.id,
                        decision
                    });

                    // Check if all decisions are made and hand is resolved
                    if (game.state === 'COMPLETE') {
                        io.to(roomId).emit('war_hand_resolved', {
                            gameState: game.getGameState(),
                            results: game.getActiveSpots().map(({ index, spot }) => ({
                                spotIndex: index,
                                userId: spot.playerId,
                                bet: spot.bet,
                                card: spot.card,
                                payout: spot.payout || 0
                            }))
                        });
                    }
                } else {
                    socket.emit('error', { message: 'Failed to make war decision' });
                }
            } catch (error) {
                console.error('Error making war decision:', error);
                socket.emit('error', { message: 'Failed to make decision' });
            }
        });

        /**
         * Reset war game for next round
         */
        socket.on('reset_war_round', async () => {
            const roomId = playerToGame.get(socket.id);

            if (!roomId) {
                return socket.emit('error', { message: 'Not in a game room' });
            }

            const game = games.get(roomId);
            if (!game || game.getGameType() !== 'WAR') {
                return socket.emit('error', { message: 'Invalid game' });
            }

            try {
                await game.resetForNextRound();

                // Broadcast reset
                io.to(roomId).emit('war_round_reset', {
                    gameState: game.getGameState()
                });
            } catch (error) {
                console.error('Error resetting war round:', error);
                socket.emit('error', { message: 'Failed to reset round' });
            }
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
