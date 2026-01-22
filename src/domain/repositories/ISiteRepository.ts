import { Site, CreateSiteDTO } from '../entities/Site';

export interface ISiteRepository {
  create(data: CreateSiteDTO): Promise<Site>;
  findAll(skip?: number, take?: number): Promise<Site[]>;
  findById(id: string): Promise<Site | null>;
  update(id: string, data: Partial<Site>): Promise<Site>;
  delete(id: string): Promise<void>;
}