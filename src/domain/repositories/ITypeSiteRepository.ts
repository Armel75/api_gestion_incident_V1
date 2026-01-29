import { TypeSite, CreateTypeSiteDTO } from '../entities/TypeSite';

export interface ITypeSiteRepository {
  create(data: CreateTypeSiteDTO): Promise<TypeSite>;
  findById(id: string): Promise<TypeSite | null>;
  findAll(skip?: number, take?: number): Promise<TypeSite[]>;
  update(id: string, data: Partial<TypeSite>): Promise<TypeSite>;
  delete(id: string): Promise<void>;
}
