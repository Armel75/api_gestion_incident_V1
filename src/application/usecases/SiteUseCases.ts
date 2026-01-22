import { ISiteRepository } from '../../domain/repositories/ISiteRepository';
import { Site, CreateSiteDTO } from '../../domain/entities/Site';

export class CreateSiteUseCase {
  constructor(private repo: ISiteRepository) {}
  async execute(data: CreateSiteDTO): Promise<Site> {
    return this.repo.create(data);
  }
}

export class GetAllSitesUseCase {
  constructor(private repo: ISiteRepository) {}
  async execute(skip: number, take: number): Promise<Site[]> {
    return this.repo.findAll(skip, take);
  }
}

export class GetSiteByIdUseCase {
  constructor(private repo: ISiteRepository) {}
  async execute(id: string): Promise<Site | null> {
    return this.repo.findById(id);
  }
}

export class UpdateSiteUseCase {
  constructor(private repo: ISiteRepository) {}
  async execute(id: string, data: Partial<Site>): Promise<Site> {
    return this.repo.update(id, data);
  }
}

export class DeleteSiteUseCase {
  constructor(private repo: ISiteRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}