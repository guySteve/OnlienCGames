"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
class ChatService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async sendMessage(fromUserId, toUserId, message) {
        if (fromUserId === toUserId) {
            throw new Error('You cannot send a message to yourself.');
        }
        // Check if they are friends
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                status: 'ACCEPTED',
                OR: [
                    { userId: fromUserId, friendId: toUserId },
                    { userId: toUserId, friendId: fromUserId },
                ],
            },
        });
        if (!friendship) {
            throw new Error('You can only send messages to your friends.');
        }
        return this.prisma.chatMessage.create({
            data: {
                userId: fromUserId,
                // For direct messages, we can use a composite room ID
                roomId: [fromUserId, toUserId].sort().join(':'),
                message,
            },
        });
    }
    async getMessages(userId, friendId) {
        const roomId = [userId, friendId].sort().join(':');
        return this.prisma.chatMessage.findMany({
            where: { roomId },
            orderBy: { createdAt: 'asc' },
            include: {
                User: {
                    select: { id: true, displayName: true, avatarUrl: true, customAvatar: true, nickname: true },
                },
            },
        });
    }
}
exports.ChatService = ChatService;
//# sourceMappingURL=ChatService.js.map