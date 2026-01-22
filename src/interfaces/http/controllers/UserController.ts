import { Request, Response, NextFunction } from 'express';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { 
    GetAllUsersUseCase, 
    GetUserUseCase,
    UpdateUserUseCase, 
    DeleteUserUseCase 
} from '../../../application/usecases/UserUseCases';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors/AppError';

const updateSchema = z.object({
    username: z.string().min(3).optional()
});

export class UserController {
    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaUserRepository();
            const useCase = new GetAllUsersUseCase(repo);
            const skip = Number((req as any).query.skip) || 0;
            const take = Number((req as any).query.take) || 20;
            const users = await useCase.execute(skip, take);
            
            const safeUsers = users.map(u => {
                const { password, ...rest } = u;
                return rest;
            });
            
            return (res as any).json(safeUsers);
        } catch (error) {
            next(error);
        }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaUserRepository();
            const useCase = new GetUserUseCase(repo);
            const user = await useCase.execute((req as any).params.id);
            if (!user) throw new NotFoundError('User not found');
            
            const { password, ...rest } = user;
            return (res as any).json(rest);
        } catch (error) {
            next(error);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const data = updateSchema.parse((req as any).body);
            const repo = new PrismaUserRepository();
            const useCase = new UpdateUserUseCase(repo);
            const user = await useCase.execute((req as any).params.id, data);
            const { password, ...rest } = user;
            return (res as any).json(rest);
        } catch (error) {
            next(error);
        }
    }

    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaUserRepository();
            const useCase = new DeleteUserUseCase(repo);
            await useCase.execute((req as any).params.id);
            return (res as any).status(204).send();
        } catch (error) {
            next(error);
        }
    }
}
