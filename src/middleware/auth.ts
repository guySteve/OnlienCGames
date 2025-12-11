import { Request, Response, NextFunction } from 'express';

// Extend the Request object to include the user property
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      isAdmin?: boolean; // Add isAdmin property to the User interface
    }
  }
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'smmohamed60@gmail.com';

export function isAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    // For now, simple email check. In a real app, use a database flag.
    if (req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    return next();
}