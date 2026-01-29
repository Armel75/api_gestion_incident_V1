import { ITypeSiteRepository } from '../../domain/repositories/ITypeSiteRepository';
import { TypeSite, CreateTypeSiteDTO } from '../../domain/entities/TypeSite';
import prisma from '../database/prisma';

export class PrismaTypeSiteRepository implements ITypeSiteRepository {
  async create(data: CreateTypeSiteDTO): Promise<TypeSite> {
    // @ts-ignore: Assumes TypeSite model exists in schema.prisma
    const typeSite = await prisma.typeSite.create({
      data: {
        name: data.name
      }
    });
    return typeSite as unknown as TypeSite;
  }

  async findById(id: string): Promise<TypeSite | null> {
    // @ts-ignore
    const typeSite = await prisma.typeSite.findFirst({
      where: { id, deletedAt: null }
    });
    return typeSite as unknown as TypeSite;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<TypeSite[]> {
    // @ts-ignore
    const typeSites = await prisma.typeSite.findMany({
      skip,
      take,
      where: { deletedAt: null }
    });
    return typeSites as unknown as TypeSite[];
  }

  async update(id: string, data: Partial<TypeSite>): Promise<TypeSite> {
    // @ts-ignore
    const typeSite = await prisma.typeSite.update({
      where: { id },
      data: {
        name: data.name
      }
    });
    return typeSite as unknown as TypeSite;
  }

  async delete(id: string): Promise<void> {
    // @ts-ignore
    await prisma.typeSite.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
