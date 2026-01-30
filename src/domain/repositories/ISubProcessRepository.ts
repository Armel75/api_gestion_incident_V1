import { SubProcess, CreateSubProcessDTO } from '../entities/SubProcess';

export interface ISubProcessRepository {
  create(data: CreateSubProcessDTO): Promise<SubProcess>;
  findById(id: string): Promise<SubProcess | null>;
  findAll(skip?: number, take?: number): Promise<SubProcess[]>;
  update(id: string, data: Partial<SubProcess>): Promise<SubProcess>;
  delete(id: string): Promise<void>;
}