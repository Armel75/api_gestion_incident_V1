import { Request, Response, NextFunction } from 'express';
import { 
    CreatePermissionUseCase, 
    GetAllPermissionsUseCase, 
    GetPermissionByIdUseCase, 
    UpdatePermissionUseCase, 
    DeletePermissionUseCase 
} from '../../../application/usecases/PermissionUseCases';
import { PrismaPermissionRepository } from '../../../infrastructure/repositories/PrismaPermissionRepository';
import { z } from 'zod';

const permissionSchema = z.object({
  action: z.string().min(3),
  description: z.string().optional().nullable()
});

export class PermissionController {
  
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = permissionSchema.parse((req as any).body);
      const repo = new PrismaPermissionRepository();
      const useCase = new CreatePermissionUseCase(repo);
      const permission = await useCase.execute(data);
      return (res as any).status(201).json(permission);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaPermissionRepository();
      const useCase = new GetAllPermissionsUseCase(repo);
      const permissions = await useCase.execute();
      return (res as any).json(permissions);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaPermissionRepository();
      const useCase = new GetPermissionByIdUseCase(repo);
      const permission = await useCase.execute((req as any).params.id);
      return (res as any).json(permission);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = permissionSchema.partial().parse((req as any).body);
      const repo = new PrismaPermissionRepository();
      const useCase = new UpdatePermissionUseCase(repo);
      const permission = await useCase.execute((req as any).params.id, data);
      return (res as any).json(permission);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = new PrismaPermissionRepository();
      const useCase = new DeletePermissionUseCase(repo);
      await useCase.execute((req as any).params.id);
      return (res as any).status(204).send();
    } catch (error) {
      (next as any)(error);
    }
  }
}
