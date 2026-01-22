import { ISiteRepository } from '../../domain/repositories/ISiteRepository';
import { CreateSiteDTO, Site } from '../../domain/entities/Site';

export class CreateSiteUseCase {
  constructor(private siteRepository: ISiteRepository) {}

  async execute(data: CreateSiteDTO): Promise<Site> {
    // Business logic: check if name is unique, valid type, etc.
    if (!data.name) throw new Error('Site name is required');
    if (!data.typeId) throw new Error('Site type is required');

    return this.siteRepository.create(data);
  }
}