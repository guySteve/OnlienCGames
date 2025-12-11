import { PrismaClient } from '@prisma/client';
export declare class FriendService {
    private prisma;
    constructor(prisma: PrismaClient);
    sendFriendRequest(userId: string, friendId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        friendId: string;
        status: import(".prisma/client").$Enums.FriendshipStatus;
    }>;
    acceptFriendRequest(userId: string, friendId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        friendId: string;
        status: import(".prisma/client").$Enums.FriendshipStatus;
    }>;
    rejectFriendRequest(userId: string, friendId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        friendId: string;
        status: import(".prisma/client").$Enums.FriendshipStatus;
    }>;
    removeFriend(userId: string, friendId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        friendId: string;
        status: import(".prisma/client").$Enums.FriendshipStatus;
    }>;
    getFriends(userId: string): Promise<{
        id: string;
        displayName: string;
        nickname: string | null;
        avatar: string | null;
    }[]>;
    getPendingFriendRequests(userId: string): Promise<{
        id: string;
        displayName: string;
        nickname: string | null;
        avatar: string | null;
    }[]>;
}
//# sourceMappingURL=FriendService.d.ts.map