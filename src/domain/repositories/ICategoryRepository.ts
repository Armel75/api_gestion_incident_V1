import { Category } from '../entities/Category';

export interface ICategoryRepository {
  create(data: Pick<Category, 'name'>): Promise<Category>;
  findById(id: string): Promise<Category | null>;
  findAll(skip?: number, take?: number): Promise<Category[]>;
  update(id: string, data: Partial<Category>): Promise<Category>;
  delete(id: string): Promise<void>;
}