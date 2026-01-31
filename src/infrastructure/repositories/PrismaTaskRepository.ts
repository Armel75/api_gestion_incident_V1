import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { Task, CreateTaskDTO } from '../../domain/entities/Task';
import { CreateAttachmentDTO } from '../../domain/entities/Attachment';
import prisma from '../database/prisma';

export class PrismaTaskRepository implements ITaskRepository {
  async create(data: CreateTaskDTO): Promise<Task> {
    const { attachments, ...rest } = data;
    const task = await prisma.task.create({ 
      data: {
        ...rest,
        attachments: attachments ? {
          create: attachments.map(att => ({
            fileName: att.fileName,
            url: att.url,
            uploadedAt: new Date()
          }))
        } : undefined
      },
      include: {
        attachments: true
      }
    });
    return task as unknown as Task;
  }

  async findById(id: string): Promise<Task | null> {
    const task = await prisma.task.findFirst({ 
        where: { id, deletedAt: null },
        include: { attachments: true }
    });
    return task as unknown as Task;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<Task[]> {
    const tasks = await prisma.task.findMany({ 
        skip, 
        take,
        where: { deletedAt: null },
        include: { attachments: true }
    });
    return tasks as unknown as Task[];
  }

  async update(id: string, data: Omit<Partial<Task>, 'attachments'> & { attachments?: CreateAttachmentDTO[] }): Promise<Task> {
    const { attachments, ...rest } = data;

    const updateData: any = { ...rest };

    if (attachments) {
      updateData.attachments = {
        create: attachments.map((att: any) => ({
           fileName: att.fileName,
           url: att.url,
           uploadedAt: new Date()
        }))
      };
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { attachments: true }
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