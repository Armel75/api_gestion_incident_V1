import { IIncidentRepository } from '../../domain/repositories/IIncidentRepository';
import { Incident, CreateIncidentDTO, UpdateIncidentDTO } from '../../domain/entities/Incident';
import prisma from '../database/prisma';

export class PrismaIncidentRepository implements IIncidentRepository {
  async create(data: CreateIncidentDTO): Promise<Incident> {
    const created = await prisma.incident.create({
      data: {
        ...data,
        status: 'OPEN'
      }
    });
    return created as unknown as Incident;
  }

  async findById(id: string): Promise<Incident | null> {
    const incident = await prisma.incident.findFirst({
      where: { id, deletedAt: null },
      include: { tasks: true }
    });
    return incident as unknown as Incident;
  }

  async findAll(skip: number = 0, take: number = 20, where: any = {}, orderBy: any = { createdAt: 'desc' }): Promise<Incident[]> {
    const incidents = await prisma.incident.findMany({
      skip,
      take,
      where: { ...where, deletedAt: null },
      orderBy,
      include: { tasks: true }
    });
    return incidents as unknown as Incident[];
  }

  async update(id: string, data: UpdateIncidentDTO): Promise<Incident> {
    const updated = await prisma.incident.update({
      where: { id },
      data
    });
    return updated as unknown as Incident;
  }

  async delete(id: string): Promise<void> {
    await prisma.incident.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}