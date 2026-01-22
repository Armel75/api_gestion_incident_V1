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

const SECRET_KEY = process.env.JWT_SECRET || 'supersecret';

// Authenticate Token
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  // Use headers directly as req.header might not be typed correctly in this environment
  const authHeader = (req as any).headers['authorization']; 
  const token = typeof authHeader === 'string' && authHeader.split(' ')[1];

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

    next();
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

    next();
  };
};