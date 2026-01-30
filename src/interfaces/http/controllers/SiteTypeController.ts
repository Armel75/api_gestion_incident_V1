import { Request, Response, NextFunction } from 'express';
import { PrismaSiteTypeRepository } from '../../../infrastructure/repositories/PrismaSiteTypeRepository';
import { 
    CreateSiteTypeUseCase, 
    GetAllSiteTypesUseCase, 
    GetSiteTypeByIdUseCase, 
    UpdateSiteTypeUseCase, 
    DeleteSiteTypeUseCase 
} from '../../../application/usecases/SiteTypeUseCases';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors/AppError';

const siteTypeSchema = z.object({
    name: z.string().min(1)
});

export class SiteTypeController {
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const data = siteTypeSchema.parse((req as any).body);
            const userId = (req as any).user.id;
            const repo = new PrismaSiteTypeRepository();
            const useCase = new CreateSiteTypeUseCase(repo);
            const result = await useCase.execute({ ...data, userId });
            return (res as any).status(201).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const page = Number((req as any).query.page) || 1;
            const size = Number((req as any).query.size) || 10;
            
            const repo = new PrismaSiteTypeRepository();
            const useCase = new GetAllSiteTypesUseCase(repo);
            const result = await useCase.execute({ page, size });
            return (res as any).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaSiteTypeRepository();
            const useCase = new GetSiteTypeByIdUseCase(repo);
            const result = await useCase.execute((req as any).params.id);
            if (!result) throw new NotFoundError('SiteType not found');
            return (res as any).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const data = siteTypeSchema.partial().parse((req as any).body);
            const repo = new PrismaSiteTypeRepository();
            const useCase = new UpdateSiteTypeUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }

    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const repo = new PrismaSiteTypeRepository();
            const useCase = new DeleteSiteTypeUseCase(repo);
            await useCase.execute((req as any).params.id);
            return (res as any).status(204).send();
        } catch (error) {
            // Fix: Type 'NextFunction' has no call signatures.
            (next as any)(error);
        }
    }
}