import { Request, Response } from 'express';
import { PrismaSubProcessRepository } from '../../../infrastructure/repositories/PrismaSubProcessRepository';
import { 
    CreateSubProcessUseCase, 
    GetAllSubProcessesUseCase, 
    GetSubProcessByIdUseCase, 
    UpdateSubProcessUseCase, 
    DeleteSubProcessUseCase 
} from '../../../application/usecases/SubProcessUseCases';
import { z } from 'zod';

const subProcessSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    processId: z.string().uuid()
});

export class SubProcessController {
    static async create(req: Request, res: Response) {
        try {
            const data = subProcessSchema.parse((req as any).body);
            const userId = (req as any).user.id;
            const repo = new PrismaSubProcessRepository();
            const useCase = new CreateSubProcessUseCase(repo);
            const result = await useCase.execute({ ...data, userId });
            return (res as any).status(201).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async getAll(req: Request, res: Response) {
        const repo = new PrismaSubProcessRepository();
        const useCase = new GetAllSubProcessesUseCase(repo);
        const result = await useCase.execute(Number((req as any).query.skip) || 0, Number((req as any).query.take) || 20);
        return (res as any).json(result);
    }

    static async getById(req: Request, res: Response) {
        const repo = new PrismaSubProcessRepository();
        const useCase = new GetSubProcessByIdUseCase(repo);
        const result = await useCase.execute((req as any).params.id);
        if (!result) return (res as any).status(404).json({ message: 'Not found' });
        return (res as any).json(result);
    }

    static async update(req: Request, res: Response) {
        try {
            const data = subProcessSchema.partial().parse((req as any).body);
            const repo = new PrismaSubProcessRepository();
            const useCase = new UpdateSubProcessUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async delete(req: Request, res: Response) {
        const repo = new PrismaSubProcessRepository();
        const useCase = new DeleteSubProcessUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
    }
}