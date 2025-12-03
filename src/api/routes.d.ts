/**
 * VegasCore API Routes
 *
 * RESTful endpoints for engagement mechanics and user management
 */
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { EngagementService } from '../services/EngagementService';
export declare function createApiRouter(prisma: PrismaClient, engagement: EngagementService): Router;
//# sourceMappingURL=routes.d.ts.map