import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
    AssignRoleToUserUseCase, 
    RevokeRoleFromUserUseCase, 
    GetUserRolesUseCase, 
    GetRoleUsersUseCase 
} from '../../../application/usecases/UserRoleUseCases';
import { PrismaUserRoleRepository } from '../../../infrastructure/repositories/PrismaUserRoleRepository';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { PrismaRoleRepository } from '../../../infrastructure/repositories/PrismaRoleRepository';

// Schéma de validation pour les assignations/révocations
const userRoleSchema = z.object({
    userId: z.string().uuid(),
    roleId: z.string().uuid()
});

export class UserRoleController {
  
  static async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, roleId } = userRoleSchema.parse((req as any).body);
      
      const userRoleRepo = new PrismaUserRoleRepository();
      const userRepo = new PrismaUserRepository();
      const roleRepo = new PrismaRoleRepository();
      
      const useCase = new AssignRoleToUserUseCase(userRoleRepo, userRepo, roleRepo);
      await useCase.execute(userId, roleId);
      
      return (res as any).status(201).json({ message: 'Role assigned successfully' });
    } catch (error) {
      (next as any)(error);
    }
  }

  static async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      // Supporte Body ou Query params pour la flexibilité
      const data = (req as any).body.userId ? (req as any).body : (req as any).query;
      const { userId, roleId } = userRoleSchema.parse(data);
      
      const userRoleRepo = new PrismaUserRoleRepository();
      const userRepo = new PrismaUserRepository();
      const roleRepo = new PrismaRoleRepository();
      
      const useCase = new RevokeRoleFromUserUseCase(userRoleRepo, userRepo, roleRepo);
      await useCase.execute(userId, roleId);
      
      return (res as any).status(204).send();
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getUserRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).params.userId;
      
      const userRoleRepo = new PrismaUserRoleRepository();
      const userRepo = new PrismaUserRepository();
      
      const useCase = new GetUserRolesUseCase(userRoleRepo, userRepo);
      const roles = await useCase.execute(userId);
      
      return (res as any).json(roles);
    } catch (error) {
      (next as any)(error);
    }
  }

  static async getRoleUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const roleId = (req as any).params.roleId;
      
      const userRoleRepo = new PrismaUserRoleRepository();
      const roleRepo = new PrismaRoleRepository();
      
      const useCase = new GetRoleUsersUseCase(userRoleRepo, roleRepo);
      const users = await useCase.execute(roleId);
      
      return (res as any).json(users);
    } catch (error) {
      (next as any)(error);
    }
  }
}
