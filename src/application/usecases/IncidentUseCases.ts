import { IIncidentRepository } from '../../domain/repositories/IIncidentRepository';
import { CreateIncidentDTO, UpdateIncidentDTO, Incident } from '../../domain/entities/Incident';

export class CreateIncidentUseCase {
  constructor(private repo: IIncidentRepository) {}
  async execute(data: CreateIncidentDTO): Promise<Incident> {
    return this.repo.create(data);
  }
}

export class GetAllIncidentsUseCase {
  constructor(private repo: IIncidentRepository) {}
  async execute(params: { page: number; size: number; filters?: any; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<Incident[]> {
    const skip = (params.page - 1) * params.size;
    const orderBy = params.sortBy ? { [params.sortBy]: params.sortOrder || 'desc' } : undefined;
    return this.repo.findAll(skip, params.size, params.filters, orderBy);
  }
}

export class GetIncidentByIdUseCase {
  constructor(private repo: IIncidentRepository) {}
  async execute(id: string): Promise<Incident | null> {
    return this.repo.findById(id);
  }
}

export class UpdateIncidentUseCase {
  constructor(private repo: IIncidentRepository) {}
  async execute(id: string, data: UpdateIncidentDTO): Promise<Incident> {
    return this.repo.update(id, data);
  }
}

export class DeleteIncidentUseCase {
  constructor(private repo: IIncidentRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}