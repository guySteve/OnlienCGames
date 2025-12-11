import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            isAdmin?: boolean;
        }
    }
}
export declare function isAdmin(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map