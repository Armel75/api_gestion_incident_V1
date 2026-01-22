import { IProcessRepository } from '../../domain/repositories/IProcessRepository';
import { Process, CreateProcessDTO } from '../../domain/entities/Process';
import prisma from '../database/prisma';

export class PrismaProcessRepository implements IProcessRepository {
  async create(data: CreateProcessDTO): Promise<Process> {
    const process = await prisma.process.create({ data });
    return process as unknown as Process;
  }

  async findById(id: string): Promise<Process | null> {
    const process = await prisma.process.findFirst({ 
        where: { id, deletedAt: null },
        include: { subProcesses: true } 
    });
    return process as unknown as Process;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<Process[]> {
    const processes = await prisma.process.findMany({ 
        skip, 
        take,
        where: { deletedAt: null },
        include: { subProcesses: true }
    });
    return processes as unknown as Process[];
  }

  async update(id: string, data: Partial<Process>): Promise<Process> {
    const process = await prisma.process.update({
      where: { id },
      data: { name: data.name }
    });
    return process as unknown as Process;
  }

  async delete(id: string): Promise<void> {
    await prisma.process.update({ 
        where: { id },
        data: { deletedAt: new Date() }
    });
  }
}