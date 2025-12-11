import { PrismaClient } from '@prisma/client';
export declare class ChatService {
    private prisma;
    constructor(prisma: PrismaClient);
    sendMessage(fromUserId: string, toUserId: string, message: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        roomId: string | null;
        message: string;
        isFiltered: boolean;
        isFlagged: boolean;
        flagReason: string | null;
    }>;
    getMessages(userId: string, friendId: string): Promise<({
        User: {
            id: string;
            displayName: string;
            avatarUrl: string | null;
            nickname: string | null;
            customAvatar: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        roomId: string | null;
        message: string;
        isFiltered: boolean;
        isFlagged: boolean;
        flagReason: string | null;
    })[]>;
}
//# sourceMappingURL=ChatService.d.ts.map