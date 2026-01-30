import { Request, Response, NextFunction } from 'express';
import { 
    CreateSiteUseCase, 
    GetAllSitesUseCase,
    GetSiteByIdUseCase,
    UpdateSiteUseCase, 
    DeleteSiteUseCase
} from '../../../application/usecases/SiteUseCases';
import { PrismaSiteRepository } from '../../../infrastructure/repositories/PrismaSiteRepository';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors/AppError';

const createSiteSchema = z.object({
  name: z.string().min(2)
});

export class SiteController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSiteSchema.parse((req as any).body);
      const userId = (req as any).user.id;
      const repo = new PrismaSiteRepository();
      const useCase = new CreateSiteUseCase(repo);
      const site = await useCase.execute({ ...data, userId });
      return (res as any).status(201).json(site);
    } catch (error) {
      // Fix: Type 'NextFunction' has no call signatures.
      (next as any)(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const page = Number((req as any).query.page) || 1;
        const size = Number((req as any).query.size) || 10;
        const skip = (page - 1) * size;
        
        const repo = new PrismaSiteRepository();
        const useCase = new GetAllSitesUseCase(repo);
        const sites = await useCase.execute(skip, size);
        return (res as any).json(sites);
    } catch (error) {
        // Fix: Type 'NextFunction' has no call signatures.
        (next as any)(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
        const repo = new PrismaSiteRepository();
        const useCase = new GetSiteByIdUseCase(repo);
        const site = await useCase.execute((req as any).params.id);
        if (!site) throw new NotFoundError('Site not found');
        return (res as any).json(site);
    } catch (error) {
        // Fix: Type 'NextFunction' has no call signatures.
        (next as any)(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
      try {
        const data = createSiteSchema.partial().parse((req as any).body);
        const repo = new PrismaSiteRepository();
        const useCase = new UpdateSiteUseCase(repo);
        const site = await useCase.execute((req as any).params.id, data);
        return (res as any).json(site);
      } catch (error) {
          // Fix: Type 'NextFunction' has no call signatures.
          (next as any)(error);
      }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
      try {
        const repo = new PrismaSiteRepository();
        const useCase = new DeleteSiteUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
      } catch (error) {
        // Fix: Type 'NextFunction' has no call signatures.
        (next as any)(error);
      }
  }
}