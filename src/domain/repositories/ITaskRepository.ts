import { Task, CreateTaskDTO } from '../entities/Task';

export interface ITaskRepository {
  create(data: CreateTaskDTO): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findAll(skip?: number, take?: number): Promise<Task[]>;
  update(id: string, data: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
}