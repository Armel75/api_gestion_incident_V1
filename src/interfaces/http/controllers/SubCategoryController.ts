import { Request, Response } from 'express';
import { PrismaSubCategoryRepository } from '../../../infrastructure/repositories/PrismaSubCategoryRepository';
import { 
    CreateSubCategoryUseCase, 
    GetAllSubCategoriesUseCase, 
    GetSubCategoryByIdUseCase, 
    UpdateSubCategoryUseCase, 
    DeleteSubCategoryUseCase 
} from '../../../application/usecases/SubCategoryUseCases';
import { z } from 'zod';

const subCategorySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    categoryId: z.string().uuid()
});

export class SubCategoryController {
    static async create(req: Request, res: Response) {
        try {
            const data = subCategorySchema.parse((req as any).body);
            const userId = (req as any).user.id;
            const repo = new PrismaSubCategoryRepository();
            const useCase = new CreateSubCategoryUseCase(repo);
            const result = await useCase.execute({ ...data, userId });
            return (res as any).status(201).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async getAll(req: Request, res: Response) {
        const repo = new PrismaSubCategoryRepository();
        const useCase = new GetAllSubCategoriesUseCase(repo);
        const result = await useCase.execute(Number((req as any).query.skip) || 0, Number((req as any).query.take) || 20);
        return (res as any).json(result);
    }

    static async getById(req: Request, res: Response) {
        const repo = new PrismaSubCategoryRepository();
        const useCase = new GetSubCategoryByIdUseCase(repo);
        const result = await useCase.execute((req as any).params.id);
        if (!result) return (res as any).status(404).json({ message: 'Not found' });
        return (res as any).json(result);
    }

    static async update(req: Request, res: Response) {
        try {
            const data = subCategorySchema.partial().parse((req as any).body);
            const repo = new PrismaSubCategoryRepository();
            const useCase = new UpdateSubCategoryUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async delete(req: Request, res: Response) {
        const repo = new PrismaSubCategoryRepository();
        const useCase = new DeleteSubCategoryUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
    }
}