import { Request, Response } from 'express';
import { PrismaProcessRepository } from '../../../infrastructure/repositories/PrismaProcessRepository';
import { 
    CreateProcessUseCase, 
    GetAllProcessesUseCase, 
    GetProcessByIdUseCase, 
    UpdateProcessUseCase, 
    DeleteProcessUseCase 
} from '../../../application/usecases/ProcessUseCases';
import { z } from 'zod';

const processSchema = z.object({
    name: z.string().min(1)
});

export class ProcessController {
    static async create(req: Request, res: Response) {
        try {
            const data = processSchema.parse((req as any).body);
            const userId = (req as any).user.id;
            const repo = new PrismaProcessRepository();
            const useCase = new CreateProcessUseCase(repo);
            const result = await useCase.execute({ ...data, userId });
            return (res as any).status(201).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async getAll(req: Request, res: Response) {
        const repo = new PrismaProcessRepository();
        const useCase = new GetAllProcessesUseCase(repo);
        const result = await useCase.execute(Number((req as any).query.skip) || 0, Number((req as any).query.take) || 20);
        return (res as any).json(result);
    }

    static async getById(req: Request, res: Response) {
        const repo = new PrismaProcessRepository();
        const useCase = new GetProcessByIdUseCase(repo);
        const result = await useCase.execute((req as any).params.id);
        if (!result) return (res as any).status(404).json({ message: 'Not found' });
        return (res as any).json(result);
    }

    static async update(req: Request, res: Response) {
        try {
            const data = processSchema.partial().parse((req as any).body);
            const repo = new PrismaProcessRepository();
            const useCase = new UpdateProcessUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async delete(req: Request, res: Response) {
        const repo = new PrismaProcessRepository();
        const useCase = new DeleteProcessUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
    }
}