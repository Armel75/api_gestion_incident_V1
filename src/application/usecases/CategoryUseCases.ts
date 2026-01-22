import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { Category } from '../../domain/entities/Category';

export class CreateCategoryUseCase {
  constructor(private repo: ICategoryRepository) {}
  async execute(data: Pick<Category, 'name'>): Promise<Category> {
    return this.repo.create(data);
  }
}

export class GetAllCategoriesUseCase {
  constructor(private repo: ICategoryRepository) {}
  async execute(skip: number, take: number): Promise<Category[]> {
    return this.repo.findAll(skip, take);
  }
}

export class GetCategoryByIdUseCase {
  constructor(private repo: ICategoryRepository) {}
  async execute(id: string): Promise<Category | null> {
    return this.repo.findById(id);
  }
}

export class UpdateCategoryUseCase {
  constructor(private repo: ICategoryRepository) {}
  async execute(id: string, data: Partial<Category>): Promise<Category> {
    return this.repo.update(id, data);
  }
}

export class DeleteCategoryUseCase {
  constructor(private repo: ICategoryRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}