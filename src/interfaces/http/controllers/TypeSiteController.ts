import { Request, Response, NextFunction } from 'express';
import { PrismaTypeSiteRepository } from '../../../infrastructure/repositories/PrismaTypeSiteRepository';
import { 
    CreateTypeSiteUseCase, 
    GetAllTypeSitesUseCase, 
    GetTypeSiteByIdUseCase, 
    UpdateTypeSiteUseCase, 
    DeleteTypeSiteUseCase 
} from '../../../application/usecases/TypeSiteUseCases';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors/AppError';

const typeSiteSchema = z.object({
    name: z.string().min(1)
});

export class TypeSiteController {
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const data = typeSiteSchema.parse((req as any).body);
            const repo = new PrismaTypeSiteRepository();
            const useCase = new CreateTypeSiteUseCase(repo);
            const result = await useCase.execute(data);
            return (res as any).status(201).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const skip = Number((req as any).query.skip) || 0;
            const take = Number((req as any).query.take) || 20;
            
            const repo = new PrismaTypeSiteRepository();
            const useCase = new GetAllTypeSitesUseCase(repo);
            const result = await useCase.execute(skip, take);
            return (res as any).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaTypeSiteRepository();
            const useCase = new GetTypeSiteByIdUseCase(repo);
            const result = await useCase.execute((req as any).params.id);
            if (!result) throw new NotFoundError('TypeSite not found');
            return (res as any).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const data = typeSiteSchema.partial().parse((req as any).body);
            const repo = new PrismaTypeSiteRepository();
            const useCase = new UpdateTypeSiteUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaTypeSiteRepository();
            const useCase = new DeleteTypeSiteUseCase(repo);
            await useCase.execute((req as any).params.id);
            return (res as any).status(204).send();
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }
}