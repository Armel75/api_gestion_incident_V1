import { Request, Response } from 'express';
import { PrismaCategoryRepository } from '../../../infrastructure/repositories/PrismaCategoryRepository';
import { 
    CreateCategoryUseCase, 
    GetAllCategoriesUseCase, 
    GetCategoryByIdUseCase, 
    UpdateCategoryUseCase, 
    DeleteCategoryUseCase 
} from '../../../application/usecases/CategoryUseCases';
import { z } from 'zod';

const categorySchema = z.object({
    name: z.string().min(1)
});

export class CategoryController {
    static async create(req: Request, res: Response) {
        try {
            const data = categorySchema.parse((req as any).body);
            const repo = new PrismaCategoryRepository();
            const useCase = new CreateCategoryUseCase(repo);
            const result = await useCase.execute(data);
            return (res as any).status(201).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async getAll(req: Request, res: Response) {
        const repo = new PrismaCategoryRepository();
        const useCase = new GetAllCategoriesUseCase(repo);
        const result = await useCase.execute(Number((req as any).query.skip) || 0, Number((req as any).query.take) || 20);
        return (res as any).json(result);
    }

    static async getById(req: Request, res: Response) {
        const repo = new PrismaCategoryRepository();
        const useCase = new GetCategoryByIdUseCase(repo);
        const result = await useCase.execute((req as any).params.id);
        if (!result) return (res as any).status(404).json({ message: 'Not found' });
        return (res as any).json(result);
    }

    static async update(req: Request, res: Response) {
        try {
            const data = categorySchema.partial().parse((req as any).body);
            const repo = new PrismaCategoryRepository();
            const useCase = new UpdateCategoryUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async delete(req: Request, res: Response) {
        const repo = new PrismaCategoryRepository();
        const useCase = new DeleteCategoryUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
    }
}