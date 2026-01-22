import { Process, CreateProcessDTO } from '../entities/Process';

export interface IProcessRepository {
  create(data: CreateProcessDTO): Promise<Process>;
  findById(id: string): Promise<Process | null>;
  findAll(skip?: number, take?: number): Promise<Process[]>;
  update(id: string, data: Partial<Process>): Promise<Process>;
  delete(id: string): Promise<void>;
}