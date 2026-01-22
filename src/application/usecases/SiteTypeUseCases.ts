import { ISiteTypeRepository } from '../../domain/repositories/ISiteTypeRepository';
import { SiteType, CreateSiteTypeDTO } from '../../domain/entities/Site';

export class CreateSiteTypeUseCase {
  constructor(private repo: ISiteTypeRepository) {}
  async execute(data: CreateSiteTypeDTO): Promise<SiteType> {
    return this.repo.create(data);
  }
}

export class GetAllSiteTypesUseCase {
  constructor(private repo: ISiteTypeRepository) {}
  async execute(params: { page: number; size: number }): Promise<SiteType[]> {
    const skip = (params.page - 1) * params.size;
    return this.repo.findAll(skip, params.size);
  }
}

export class GetSiteTypeByIdUseCase {
  constructor(private repo: ISiteTypeRepository) {}
  async execute(id: string): Promise<SiteType | null> {
    return this.repo.findById(id);
  }
}

export class UpdateSiteTypeUseCase {
  constructor(private repo: ISiteTypeRepository) {}
  async execute(id: string, data: Partial<SiteType>): Promise<SiteType> {
    return this.repo.update(id, data);
  }
}

export class DeleteSiteTypeUseCase {
  constructor(private repo: ISiteTypeRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}