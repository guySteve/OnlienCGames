
import { PrismaClient, FriendshipStatus } from '@prisma/client';

export class FriendService {
  constructor(private prisma: PrismaClient) {}

  async sendFriendRequest(userId: string, friendId: string) {
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
        status: FriendshipStatus.PENDING,
      },
    });
  }

  async acceptFriendRequest(userId: string, friendId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        userId: friendId,
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
    });

    if (!friendship) {
      throw new Error('No pending friend request found.');
    }

    return this.prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  async rejectFriendRequest(userId: string, friendId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        userId: friendId,
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
    });

    if (!friendship) {
      throw new Error('No pending friend request found.');
    }

    return this.prisma.friendship.delete({
      where: { id: friendship.id },
    });
  }

  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
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

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
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

  async getPendingFriendRequests(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: FriendshipStatus.PENDING,
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
