import { ISubCategoryRepository } from '../../domain/repositories/ISubCategoryRepository';
import { SubCategory, CreateSubCategoryDTO } from '../../domain/entities/SubCategory';
import prisma from '../database/prisma';

export class PrismaSubCategoryRepository implements ISubCategoryRepository {
  async create(data: CreateSubCategoryDTO): Promise<SubCategory> {
    const subCategory = await prisma.subCategory.create({ data });
    return subCategory as unknown as SubCategory;
  }

  async findById(id: string): Promise<SubCategory | null> {
    const subCategory = await prisma.subCategory.findFirst({ 
        where: { id, deletedAt: null }
    });
    return subCategory as unknown as SubCategory;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<SubCategory[]> {
    const subCategories = await prisma.subCategory.findMany({ 
        skip, 
        take,
        where: { deletedAt: null }
    });
    return subCategories as unknown as SubCategory[];
  }

  async update(id: string, data: Partial<SubCategory>): Promise<SubCategory> {
    const subCategory = await prisma.subCategory.update({
      where: { id },
      data
    });
    return subCategory as unknown as SubCategory;
  }

  async delete(id: string): Promise<void> {
    await prisma.subCategory.update({ 
        where: { id },
        data: { deletedAt: new Date() }
    });
  }
}