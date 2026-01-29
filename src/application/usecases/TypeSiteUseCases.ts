import { ITypeSiteRepository } from '../../domain/repositories/ITypeSiteRepository';
import { TypeSite, CreateTypeSiteDTO } from '../../domain/entities/TypeSite';

export class CreateTypeSiteUseCase {
  constructor(private repo: ITypeSiteRepository) {}
  async execute(data: CreateTypeSiteDTO): Promise<TypeSite> {
    return this.repo.create(data);
  }
}

export class GetAllTypeSitesUseCase {
  constructor(private repo: ITypeSiteRepository) {}
  async execute(skip: number, take: number): Promise<TypeSite[]> {
    return this.repo.findAll(skip, take);
  }
}

export class GetTypeSiteByIdUseCase {
  constructor(private repo: ITypeSiteRepository) {}
  async execute(id: string): Promise<TypeSite | null> {
    return this.repo.findById(id);
  }
}

export class UpdateTypeSiteUseCase {
  constructor(private repo: ITypeSiteRepository) {}
  async execute(id: string, data: Partial<TypeSite>): Promise<TypeSite> {
    return this.repo.update(id, data);
  }
}

export class DeleteTypeSiteUseCase {
  constructor(private repo: ITypeSiteRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
