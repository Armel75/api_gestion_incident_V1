import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
    AssignPermissionToRoleUseCase, 
    RevokePermissionFromRoleUseCase, 
    GetPermissionsByRoleUseCase, 
    GetRolesByPermissionUseCase 
} from '../../../application/usecases/RolePermissionUseCases';
import { PrismaRolePermissionRepository } from '../../../infrastructure/repositories/PrismaRolePermissionRepository';
import { PrismaRoleRepository } from '../../../infrastructure/repositories/PrismaRoleRepository';
import { PrismaPermissionRepository } from '../../../infrastructure/repositories/PrismaPermissionRepository';

const rolePermissionSchema = z.object({
    roleId: z.string().uuid(),
    permissionId: z.string().uuid()
});

export class RolePermissionController {
  
  static async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { roleId, permissionId } = rolePermissionSchema.parse((req as any).body);
      
      const rolePermRepo = new PrismaRolePermissionRepository();
      const roleRepo = new PrismaRoleRepository();
      const permRepo = new PrismaPermissionRepository();
      
      const useCase = new AssignPermissionToRoleUseCase(rolePermRepo, roleRepo, permRepo);
      await useCase.execute(roleId, permissionId);
      
      return (res as any).status(201).json({ message: 'Permission assigned to role successfully' });
    } catch (error) {
      (next as any)(error);
    }
  }

  static async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      // Allows passing IDs via body (standard) or query params (convenience for DELETE)
      const data = (req as any).body.roleId ? (req as any).body : (req as any).query;
      const { roleId, permissionId } = rolePermissionSchema.parse(data);
      
      const rolePermRepo = new PrismaRolePermissionRepository();
      const roleRepo = new PrismaRoleRepository();
      const permRepo = new PrismaPermissionRepository();
      
      const useCase = new RevokePermissionFromRoleUseCase(rolePermRepo, roleRepo, permRepo);
      await useCase.execute(roleId, permissionId);
      
      return (res as any).status(204).send();
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getPermissionsByRole(req: Request, res: Response, next: NextFunction) {
    try {
      const roleId = (req as any).params.roleId;
      
      const rolePermRepo = new PrismaRolePermissionRepository();
      const roleRepo = new PrismaRoleRepository();
      
      const useCase = new GetPermissionsByRoleUseCase(rolePermRepo, roleRepo);
      const permissions = await useCase.execute(roleId);
      
      return (res as any).json(permissions);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getRolesByPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const permissionId = (req as any).params.permissionId;
      
      const rolePermRepo = new PrismaRolePermissionRepository();
      const permRepo = new PrismaPermissionRepository();
      
      const useCase = new GetRolesByPermissionUseCase(rolePermRepo, permRepo);
      const roles = await useCase.execute(permissionId);
      
      return (res as any).json(roles);
    } catch (error) {
      (next as any)(error);
    }
  }
}
