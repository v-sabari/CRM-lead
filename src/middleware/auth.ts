import { Request, Response, NextFunction } from 'express';

export type CurrentUser = {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'manager' | 'agent';
};

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  const userId = req.headers['x-user-id'] as string | undefined;
  const role = req.headers['x-user-role'] as string | undefined;

  if (!tenantId || !userId || !role) {
    res.status(401).json({
      message: 'Missing required headers: x-tenant-id, x-user-id, x-user-role',
      statusCode: 401,
    });
    return;
  }

  const validRoles = ['owner', 'admin', 'manager', 'agent'];
  if (!validRoles.includes(role)) {
    res.status(401).json({
      message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      statusCode: 401,
    });
    return;
  }

  req.currentUser = {
    tenantId,
    userId,
    role: role as CurrentUser['role'],
  };

  next();
}
