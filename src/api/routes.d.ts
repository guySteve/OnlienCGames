/**
 * VegasCore API Routes
 *
 * RESTful endpoints for engagement mechanics and user management
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
import { FriendService } from '../services/FriendService';
import { ChatService } from '../services/ChatService';
export declare function createApiRouter(prisma: PrismaClient, engagement: EngagementService, friendService: FriendService, chatService: ChatService): Router;
//# sourceMappingURL=routes.d.ts.map