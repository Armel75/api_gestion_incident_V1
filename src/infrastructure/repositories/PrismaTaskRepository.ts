import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { Task, CreateTaskDTO } from '../../domain/entities/Task';
import prisma from '../database/prisma';

export class PrismaTaskRepository implements ITaskRepository {
  async create(data: CreateTaskDTO): Promise<Task> {
    const task = await prisma.task.create({ data });
    return task as unknown as Task;
  }

  async findById(id: string): Promise<Task | null> {
    const task = await prisma.task.findFirst({ 
        where: { id, deletedAt: null } 
    });
    return task as unknown as Task;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<Task[]> {
    const tasks = await prisma.task.findMany({ 
        skip, 
        take,
        where: { deletedAt: null }
    });
    return tasks as unknown as Task[];
  }

  async update(id: string, data: Partial<Task>): Promise<Task> {
    const task = await prisma.task.update({
      where: { id },
      data
    });
    return task as unknown as Task;
  }

  async delete(id: string): Promise<void> {
    await prisma.task.update({ 
        where: { id },
        data: { deletedAt: new Date() }
    });
  }
}