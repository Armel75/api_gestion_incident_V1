import { Request, Response, NextFunction } from 'express';
import { 
    CreateRoleUseCase, 
    GetAllRolesUseCase, 
    GetRoleByIdUseCase, 
    UpdateRoleUseCase, 
    DeleteRoleUseCase,
    AssignPermissionToRoleUseCase,
    RevokePermissionFromRoleUseCase,
    GetRolePermissionsUseCase,
    GetRolesByPermissionUseCase
} from '../../../application/usecases/RoleUseCases';
import { PrismaRoleRepository } from '../../../infrastructure/repositories/PrismaRoleRepository';
import { PrismaPermissionRepository } from '../../../infrastructure/repositories/PrismaPermissionRepository';
import { z } from 'zod';

const roleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable()
});

const assignSchema = z.object({
    permissionId: z.string().uuid()
});

export class RoleController {
  
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = roleSchema.parse((req as any).body);
      const repo = new PrismaRoleRepository();
      const useCase = new CreateRoleUseCase(repo);
      const role = await useCase.execute(data);
      return (res as any).status(201).json(role);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaRoleRepository();
      const useCase = new GetAllRolesUseCase(repo);
      const roles = await useCase.execute();
      return (res as any).json(roles);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaRoleRepository();
      const useCase = new GetRoleByIdUseCase(repo);
      const role = await useCase.execute((req as any).params.id);
      return (res as any).json(role);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = roleSchema.partial().parse((req as any).body);
      const repo = new PrismaRoleRepository();
      const useCase = new UpdateRoleUseCase(repo);
      const role = await useCase.execute((req as any).params.id, data);
      return (res as any).json(role);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaRoleRepository();
      const useCase = new DeleteRoleUseCase(repo);
      await useCase.execute((req as any).params.id);
      return (res as any).status(204).send();
    } catch (error) {
      (next as any)(error);
    }
  }

  // --- Relations ---

  static async assignPermission(req: Request, res: Response, next: NextFunction) {
      try {
          const { permissionId } = assignSchema.parse((req as any).body);
          const roleId = (req as any).params.id;
          
          const roleRepo = new PrismaRoleRepository();
          const permRepo = new PrismaPermissionRepository();
          const useCase = new AssignPermissionToRoleUseCase(roleRepo, permRepo);
          
          await useCase.execute(roleId, permissionId);
          return (res as any).status(200).json({ message: 'Permission assigned successfully' });
      } catch (error) {
          (next as any)(error);
      }
  }

  static async revokePermission(req: Request, res: Response, next: NextFunction) {
      try {
          const roleId = (req as any).params.id;
          const permissionId = (req as any).params.permissionId;
          
          const roleRepo = new PrismaRoleRepository();
          const useCase = new RevokePermissionFromRoleUseCase(roleRepo);
          
          await useCase.execute(roleId, permissionId);
          return (res as any).status(204).send();
      } catch (error) {
          (next as any)(error);
      }
  }

  static async getPermissions(req: Request, res: Response, next: NextFunction) {
      try {
          const roleId = (req as any).params.id;
          const roleRepo = new PrismaRoleRepository();
          const useCase = new GetRolePermissionsUseCase(roleRepo);
          const permissions = await useCase.execute(roleId);
          return (res as any).json(permissions);
      } catch (error) {
          (next as any)(error);
      }
  }
}
