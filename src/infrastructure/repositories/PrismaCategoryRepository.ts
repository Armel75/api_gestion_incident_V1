import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { Category } from '../../domain/entities/Category';
import prisma from '../database/prisma';

export class PrismaCategoryRepository implements ICategoryRepository {
  async create(data: Pick<Category, 'name'>): Promise<Category> {
    const category = await prisma.category.create({ data });
    return category as unknown as Category;
  }

  async findById(id: string): Promise<Category | null> {
    const category = await prisma.category.findFirst({ 
        where: { id, deletedAt: null },
        include: { subCategories: true }
    });
    return category as unknown as Category;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<Category[]> {
    const categories = await prisma.category.findMany({ 
        skip, 
        take,
        where: { deletedAt: null },
        include: { subCategories: true }
    });
    return categories as unknown as Category[];
  }

  async update(id: string, data: Partial<Category>): Promise<Category> {
    const category = await prisma.category.update({
      where: { id },
      data: { name: data.name }
    });
    return category as unknown as Category;
  }

  async delete(id: string): Promise<void> {
    await prisma.category.update({ 
        where: { id },
        data: { deletedAt: new Date() }
    });
  }
}