import { Request, Response, NextFunction } from 'express';
import { 
    CreateIncidentUseCase, 
    GetAllIncidentsUseCase, 
    GetIncidentByIdUseCase, 
    UpdateIncidentUseCase, 
    DeleteIncidentUseCase
} from '../../../application/usecases/IncidentUseCases';
import { PrismaIncidentRepository } from '../../../infrastructure/repositories/PrismaIncidentRepository';
import { z } from 'zod';
import { NotFoundError } from '../../../domain/errors/AppError';

const incidentSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  siteId: z.string().uuid(),
  subProcessId: z.string().uuid(),
  subCategoryId: z.string().uuid(),
  reporterId: z.string().optional() // Usually set by auth
});

export class IncidentController {
  
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = incidentSchema.parse((req as any).body);
      const repo = new PrismaIncidentRepository();
      const useCase = new CreateIncidentUseCase(repo);
      const reporterId = (req as any).user.id;
      const userId = (req as any).user.id;

      const incident = await useCase.execute({
          ...validatedData,
          reporterId,
          userId
      });

      return (res as any).status(201).json(incident);
    } catch (error) {
      // Fix: Type 'NextFunction' has no call signatures.
      (next as any)(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
      try {
        const repo = new PrismaIncidentRepository();
        const useCase = new GetAllIncidentsUseCase(repo);
        
        const page = Number((req as any).query.page) || 1;
        const size = Number((req as any).query.size) || 10;
        const sortBy = (req as any).query.sortBy as string;
        const sortOrder = (req as any).query.sortOrder as 'asc' | 'desc';
        // Basic filtering
        const filters: any = {};
        if ((req as any).query.status) filters.status = (req as any).query.status;
        if ((req as any).query.reporterId) filters.reporterId = (req as any).query.reporterId;

        const incidents = await useCase.execute({ page, size, filters, sortBy, sortOrder });
        return (res as any).json(incidents);
      } catch (error) {
        // Fix: Type 'NextFunction' has no call signatures.
        (next as any)(error);
      }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const repo = new PrismaIncidentRepository();
        const useCase = new GetIncidentByIdUseCase(repo);
        const incident = await useCase.execute((req as any).params.id);
        if (!incident) throw new NotFoundError('Incident not found');
        return (res as any).json(incident);
      } catch (error) {
        // Fix: Type 'NextFunction' has no call signatures.
        (next as any)(error);
      }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
      try {
          const validatedData = incidentSchema.partial().parse((req as any).body);
          const repo = new PrismaIncidentRepository();
          const useCase = new UpdateIncidentUseCase(repo);
          const incident = await useCase.execute((req as any).params.id, validatedData);
          return (res as any).json(incident);
      } catch (error) {
          // Fix: Type 'NextFunction' has no call signatures.
          (next as any)(error);
      }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
      try {
        const repo = new PrismaIncidentRepository();
        const useCase = new DeleteIncidentUseCase(repo);
        await useCase.execute((req as any).params.id);
        return (res as any).status(204).send();
      } catch (error) {
        // Fix: Type 'NextFunction' has no call signatures.
        (next as any)(error);
      }
  }
}