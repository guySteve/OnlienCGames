"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendService = void 0;
const client_1 = require("@prisma/client");
class FriendService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async sendFriendRequest(userId, friendId) {
        if (userId === friendId) {
            throw new Error('You cannot send a friend request to yourself.');
        }
        const existingFriendship = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId, friendId },
                    { userId: friendId, friendId: userId },
                ],
            },
        });
        if (existingFriendship) {
            throw new Error('A friendship or pending request already exists.');
        }
        return this.prisma.friendship.create({
            data: {
                userId,
                friendId,
                status: client_1.FriendshipStatus.PENDING,
            },
        });
    }
    async acceptFriendRequest(userId, friendId) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                userId: friendId,
                friendId: userId,
                status: client_1.FriendshipStatus.PENDING,
            },
        });
        if (!friendship) {
            throw new Error('No pending friend request found.');
        }
        return this.prisma.friendship.update({
            where: { id: friendship.id },
            data: { status: client_1.FriendshipStatus.ACCEPTED },
        });
    }
    async rejectFriendRequest(userId, friendId) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                userId: friendId,
                friendId: userId,
                status: client_1.FriendshipStatus.PENDING,
            },
        });
        if (!friendship) {
            throw new Error('No pending friend request found.');
        }
        return this.prisma.friendship.delete({
            where: { id: friendship.id },
        });
    }
    async removeFriend(userId, friendId) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                status: client_1.FriendshipStatus.ACCEPTED,
                OR: [
                    { userId, friendId },
                    { userId: friendId, friendId: userId },
                ],
            },
        });
        if (!friendship) {
            throw new Error('You are not friends with this user.');
        }
        return this.prisma.friendship.delete({
            where: { id: friendship.id },
        });
    }
    async getFriends(userId) {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                status: client_1.FriendshipStatus.ACCEPTED,
                OR: [{ userId }, { friendId: userId }],
            },
            include: {
                user: {
                    select: { id: true, displayName: true, avatarUrl: true, customAvatar: true, nickname: true },
                },
                friend: {
                    select: { id: true, displayName: true, avatarUrl: true, customAvatar: true, nickname: true },
                },
            },
        });
        return friendships.map((friendship) => {
            const friend = friendship.userId === userId ? friendship.friend : friendship.user;
            return {
                id: friend.id,
                displayName: friend.displayName,
                nickname: friend.nickname,
                avatar: friend.customAvatar || friend.avatarUrl,
            };
        });
    }
    async getPendingFriendRequests(userId) {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                friendId: userId,
                status: client_1.FriendshipStatus.PENDING,
            },
            include: {
                user: {
                    select: { id: true, displayName: true, avatarUrl: true, customAvatar: true, nickname: true },
                },
            },
        });
        return friendships.map((friendship) => ({
            id: friendship.user.id,
            displayName: friendship.user.displayName,
            nickname: friendship.user.nickname,
            avatar: friendship.user.customAvatar || friendship.user.avatarUrl,
        }));
    }
}
exports.FriendService = FriendService;
//# sourceMappingURL=FriendService.js.map