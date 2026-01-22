import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { Task, CreateTaskDTO } from '../../domain/entities/Task';

export class CreateTaskUseCase {
  constructor(private repo: ITaskRepository) {}
  async execute(data: CreateTaskDTO): Promise<Task> {
    return this.repo.create(data);
  }
}

export class GetAllTasksUseCase {
  constructor(private repo: ITaskRepository) {}
  async execute(skip: number, take: number): Promise<Task[]> {
    return this.repo.findAll(skip, take);
  }
}

export class GetTaskByIdUseCase {
  constructor(private repo: ITaskRepository) {}
  async execute(id: string): Promise<Task | null> {
    return this.repo.findById(id);
  }
}

export class UpdateTaskUseCase {
  constructor(private repo: ITaskRepository) {}
  async execute(id: string, data: Partial<Task>): Promise<Task> {
    return this.repo.update(id, data);
  }
}

export class DeleteTaskUseCase {
  constructor(private repo: ITaskRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}