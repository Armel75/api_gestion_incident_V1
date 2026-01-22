import { SiteType, CreateSiteTypeDTO } from '../entities/Site';

export interface ISiteTypeRepository {
  create(data: CreateSiteTypeDTO): Promise<SiteType>;
  findById(id: string): Promise<SiteType | null>;
  findAll(skip?: number, take?: number, where?: any): Promise<SiteType[]>;
  update(id: string, data: Partial<SiteType>): Promise<SiteType>;
  delete(id: string): Promise<void>;
}