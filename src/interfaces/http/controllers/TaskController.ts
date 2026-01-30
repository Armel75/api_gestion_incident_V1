import { Request, Response } from 'express';
import { PrismaTaskRepository } from '../../../infrastructure/repositories/PrismaTaskRepository';
import { 
    CreateTaskUseCase, 
    GetAllTasksUseCase, 
    GetTaskByIdUseCase, 
    UpdateTaskUseCase, 
    DeleteTaskUseCase 
} from '../../../application/usecases/TaskUseCases';
import { z } from 'zod';

const taskSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    incidentId: z.string().uuid()
});

export class TaskController {
    static async create(req: Request, res: Response) {
        try {
            const data = taskSchema.parse((req as any).body);
            const userId = (req as any).user.id;
            const repo = new PrismaTaskRepository();
            const useCase = new CreateTaskUseCase(repo);
            const result = await useCase.execute({ ...data, userId });
            return (res as any).status(201).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async getAll(req: Request, res: Response) {
        const repo = new PrismaTaskRepository();
        const useCase = new GetAllTasksUseCase(repo);
        const result = await useCase.execute(Number((req as any).query.skip) || 0, Number((req as any).query.take) || 20);
        return (res as any).json(result);
    }

    static async getById(req: Request, res: Response) {
        const repo = new PrismaTaskRepository();
        const useCase = new GetTaskByIdUseCase(repo);
        const result = await useCase.execute((req as any).params.id);
        if (!result) return (res as any).status(404).json({ message: 'Not found' });
        return (res as any).json(result);
    }

    static async update(req: Request, res: Response) {
        try {
            const data = taskSchema.partial().parse((req as any).body);
            const repo = new PrismaTaskRepository();
            const useCase = new UpdateTaskUseCase(repo);
            const result = await useCase.execute((req as any).params.id, data);
            return (res as any).json(result);
        } catch (error: any) {
            return (res as any).status(400).json({ error: error.message });
        }
    }

    static async delete(req: Request, res: Response) {
        const repo = new PrismaTaskRepository();
        const useCase = new DeleteTaskUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
    }
}