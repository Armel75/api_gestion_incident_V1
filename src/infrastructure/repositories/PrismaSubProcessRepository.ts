import { ISubProcessRepository } from '../../domain/repositories/ISubProcessRepository';
import { SubProcess, CreateSubProcessDTO } from '../../domain/entities/SubProcess';
import prisma from '../database/prisma';

export class PrismaSubProcessRepository implements ISubProcessRepository {
  async create(data: CreateSubProcessDTO): Promise<SubProcess> {
    const subProcess = await prisma.subProcess.create({ data });
    return subProcess as unknown as SubProcess;
  }

  async findById(id: string): Promise<SubProcess | null> {
    const subProcess = await prisma.subProcess.findFirst({ 
        where: { id, deletedAt: null }
    });
    return subProcess as unknown as SubProcess;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<SubProcess[]> {
    const subProcesses = await prisma.subProcess.findMany({ 
        skip, 
        take,
        where: { deletedAt: null }
    });
    return subProcesses as unknown as SubProcess[];
  }

  async update(id: string, data: Partial<SubProcess>): Promise<SubProcess> {
    const subProcess = await prisma.subProcess.update({
      where: { id },
      data
    });
    return subProcess as unknown as SubProcess;
  }

  async delete(id: string): Promise<void> {
    await prisma.subProcess.update({ 
        where: { id },
        data: { deletedAt: new Date() }
    });
  }
}