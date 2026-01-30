import { ISubProcessRepository } from '../../domain/repositories/ISubProcessRepository';
import { SubProcess, CreateSubProcessDTO } from '../../domain/entities/SubProcess';

export class CreateSubProcessUseCase {
  constructor(private repo: ISubProcessRepository) {}
  async execute(data: CreateSubProcessDTO): Promise<SubProcess> {
    return this.repo.create(data);
  }
}

export class GetAllSubProcessesUseCase {
  constructor(private repo: ISubProcessRepository) {}
  async execute(skip: number, take: number): Promise<SubProcess[]> {
    return this.repo.findAll(skip, take);
  }
}

export class GetSubProcessByIdUseCase {
  constructor(private repo: ISubProcessRepository) {}
  async execute(id: string): Promise<SubProcess | null> {
    return this.repo.findById(id);
  }
}

export class UpdateSubProcessUseCase {
  constructor(private repo: ISubProcessRepository) {}
  async execute(id: string, data: Partial<SubProcess>): Promise<SubProcess> {
    return this.repo.update(id, data);
  }
}

export class DeleteSubProcessUseCase {
  constructor(private repo: ISubProcessRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}