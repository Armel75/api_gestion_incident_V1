import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../../infrastructure/database/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    roles: string[];
    permissions: string[];
  };
}

// Authenticate Token
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  // Read secret at runtime to ensure dotenv is loaded
  const SECRET_KEY = process.env.JWT_SECRET || 'access_secret';

  // Extract token from Authorization header (Bearer scheme)
  const authHeader = (req as any).headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) return (res as any).status(401).json({ message: 'Unauthorized' });

  try {
    const decoded: any = jwt.verify(token, SECRET_KEY);
    
    // Fetch user with Roles and Permissions (Deep nested include for Many-to-Many explicit tables)
    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) return (res as any).status(401).json({ message: 'User not found' });
    
    // Security: Immediate Lockout if user is disabled even if token is valid
    if (!user.isActive) {
        return (res as any).status(403).json({ message: 'Account is locked or inactive' });
    }

    // Flattening the Prisma structure
    const flatRoles = user.roles.map((ur: any) => ur.role);
    // Extract permissions from all roles
    const permissions = flatRoles.flatMap((r: any) => 
        r.permissions.map((rp: any) => rp.permission.action)
    );
    const roleNames = flatRoles.map((r: any) => r.name);

    (req as any).user = {
      id: user.id,
      username: user.username,
      roles: roleNames,
      permissions: Array.from(new Set(permissions)) // Dedup
    };

    // Fix: Type 'NextFunction' has no call signatures.
    (next as any)();
  } catch (err) {
    return (res as any).status(403).json({ message: 'Forbidden: Invalid Token' });
  }
};

// RBAC Guard
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return (res as any).status(401).json({ message: 'Unauthorized' });

    if (!user.permissions.includes(permission)) {
      return (res as any).status(403).json({ message: `Forbidden: Missing permission ${permission}` });
    }

    // Fix: Type 'NextFunction' has no call signatures.
    (next as any)();
  };
};