import { ISiteTypeRepository } from '../../domain/repositories/ISiteTypeRepository';
import { SiteType, CreateSiteTypeDTO } from '../../domain/entities/Site';
import prisma from '../database/prisma';

export class PrismaSiteTypeRepository implements ISiteTypeRepository {
  async create(data: CreateSiteTypeDTO): Promise<SiteType> {
    const created = await prisma.siteType.create({ data });
    return created as unknown as SiteType;
  }

  async findById(id: string): Promise<SiteType | null> {
    const found = await prisma.siteType.findFirst({
      where: { id, deletedAt: null }
    });
    return found as unknown as SiteType;
  }

  async findAll(skip: number = 0, take: number = 20, where: any = {}): Promise<SiteType[]> {
    const list = await prisma.siteType.findMany({
      skip,
      take,
      where: { ...where, deletedAt: null }
    });
    return list as unknown as SiteType[];
  }

  async update(id: string, data: Partial<SiteType>): Promise<SiteType> {
    const updated = await prisma.siteType.update({
      where: { id },
      data
    });
    return updated as unknown as SiteType;
  }

  async delete(id: string): Promise<void> {
    await prisma.siteType.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}