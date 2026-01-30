import { SubCategory, CreateSubCategoryDTO } from '../entities/SubCategory';

export interface ISubCategoryRepository {
  create(data: CreateSubCategoryDTO): Promise<SubCategory>;
  findById(id: string): Promise<SubCategory | null>;
  findAll(skip?: number, take?: number): Promise<SubCategory[]>;
  update(id: string, data: Partial<SubCategory>): Promise<SubCategory>;
  delete(id: string): Promise<void>;
}