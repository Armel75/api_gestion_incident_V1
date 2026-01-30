import { ISiteRepository } from '../../domain/repositories/ISiteRepository';
import { Site, CreateSiteDTO } from '../../domain/entities/Site';
import prisma from '../database/prisma';

export class PrismaSiteRepository implements ISiteRepository {
  async create(data: CreateSiteDTO): Promise<Site> {
    const site = await prisma.site.create({
      data: {
        name: data.name,
        userId: data.userId
      }
    });
    return site as unknown as Site;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<Site[]> {
    const sites = await prisma.site.findMany({
      skip,
      take,
      where: { deletedAt: null }
    });
    return sites as unknown as Site[];
  }

  async findById(id: string): Promise<Site | null> {
    const site = await prisma.site.findFirst({
      where: { id, deletedAt: null }
    });
    return site as unknown as Site;
  }

  async update(id: string, data: Partial<Site>): Promise<Site> {
    const site = await prisma.site.update({
      where: { id },
      data: {
        name: data.name
      }
    });
    return site as unknown as Site;
  }

  async delete(id: string): Promise<void> {
    await prisma.site.update({ 
        where: { id },
        data: { deletedAt: new Date() }
    });
  }
}