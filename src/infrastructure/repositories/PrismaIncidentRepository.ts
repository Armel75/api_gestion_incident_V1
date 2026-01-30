import { IIncidentRepository } from '../../domain/repositories/IIncidentRepository';
import { Incident, CreateIncidentDTO, UpdateIncidentDTO } from '../../domain/entities/Incident';
import prisma from '../database/prisma';

export class PrismaIncidentRepository implements IIncidentRepository {
  async create(data: CreateIncidentDTO): Promise<Incident> {
    const { siteIds, assignedUserIds, attachments, ...rest } = data;

    const created = await prisma.incident.create({
      data: {
        ...rest,
        status: 'OPEN',
        incidentSites: {
          create: siteIds.map(siteId => ({ siteId }))
        },
        incidentUsers: assignedUserIds ? {
          create: assignedUserIds.map(userId => ({ userId }))
        } : undefined,
        attachments: attachments ? {
          create: attachments.map(att => ({
            fileName: att.fileName,
            url: att.url,
            uploadedAt: new Date()
          }))
        } : undefined
      },
      include: {
        incidentSites: { include: { site: true } },
        incidentUsers: { include: { user: true } },
        attachments: true,
        tasks: true
      }
    });

    return this.mapToDomain(created);
  }

  async findById(id: string): Promise<Incident | null> {
    const incident = await prisma.incident.findFirst({
      where: { id, deletedAt: null },
      include: {
        incidentSites: { include: { site: true } },
        incidentUsers: { include: { user: true } },
        attachments: true,
        tasks: true
      }
    });

    return incident ? this.mapToDomain(incident) : null;
  }

  async findAll(skip: number = 0, take: number = 20, where: any = {}, orderBy: any = { createdAt: 'desc' }): Promise<Incident[]> {
    const incidents = await prisma.incident.findMany({
      skip,
      take,
      where: { ...where, deletedAt: null },
      orderBy,
      include: {
        incidentSites: { include: { site: true } },
        incidentUsers: { include: { user: true } },
        attachments: true,
        tasks: true
      }
    });

    return incidents.map(i => this.mapToDomain(i));
  }

  async update(id: string, data: UpdateIncidentDTO): Promise<Incident> {
    const { siteIds, assignedUserIds, attachments, ...rest } = data;

    // Transactional update for relations if IDs are provided
    const updateData: any = { ...rest };

    if (siteIds) {
      updateData.incidentSites = {
        deleteMany: {},
        create: siteIds.map(siteId => ({ siteId }))
      };
    }

    if (assignedUserIds) {
      updateData.incidentUsers = {
        deleteMany: {},
        create: assignedUserIds.map(userId => ({ userId }))
      };
    }
    
    if (attachments) {
       updateData.attachments = {
         create: attachments.map(att => ({
            fileName: att.fileName,
            url: att.url,
            uploadedAt: new Date()
         }))
       };
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: updateData,
      include: {
        incidentSites: { include: { site: true } },
        incidentUsers: { include: { user: true } },
        attachments: true,
        tasks: true
      }
    });

    return this.mapToDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.incident.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  private mapToDomain(prismaIncident: any): Incident {
    return {
      id: prismaIncident.id,
      title: prismaIncident.title,
      description: prismaIncident.description,
      status: prismaIncident.status,
      userId: prismaIncident.userId, // Creator
      subProcessId: prismaIncident.subProcessId,
      subCategoryId: prismaIncident.subCategoryId,
      createdAt: prismaIncident.createdAt,
      updatedAt: prismaIncident.updatedAt,
      deletedAt: prismaIncident.deletedAt,
      
      tasks: prismaIncident.tasks,
      sites: prismaIncident.incidentSites?.map((is: any) => is.site) || [],
      assignedUsers: prismaIncident.incidentUsers?.map((iu: any) => iu.user) || [],
      attachments: prismaIncident.attachments || []
    } as Incident;
  }
}