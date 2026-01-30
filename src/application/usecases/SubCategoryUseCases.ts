import { ISubCategoryRepository } from '../../domain/repositories/ISubCategoryRepository';
import { SubCategory, CreateSubCategoryDTO } from '../../domain/entities/SubCategory';

export class CreateSubCategoryUseCase {
  constructor(private repo: ISubCategoryRepository) {}
  async execute(data: CreateSubCategoryDTO): Promise<SubCategory> {
    return this.repo.create(data);
  }
}

export class GetAllSubCategoriesUseCase {
  constructor(private repo: ISubCategoryRepository) {}
  async execute(skip: number, take: number): Promise<SubCategory[]> {
    return this.repo.findAll(skip, take);
  }
}

export class GetSubCategoryByIdUseCase {
  constructor(private repo: ISubCategoryRepository) {}
  async execute(id: string): Promise<SubCategory | null> {
    return this.repo.findById(id);
  }
}

export class UpdateSubCategoryUseCase {
  constructor(private repo: ISubCategoryRepository) {}
  async execute(id: string, data: Partial<SubCategory>): Promise<SubCategory> {
    return this.repo.update(id, data);
  }
}

export class DeleteSubCategoryUseCase {
  constructor(private repo: ISubCategoryRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}