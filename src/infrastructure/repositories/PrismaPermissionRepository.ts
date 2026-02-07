import { IPermissionRepository } from '../../domain/repositories/IPermissionRepository';
import { Permission, CreatePermissionDTO, UpdatePermissionDTO } from '../../domain/entities/Permission';
import prisma from '../database/prisma';

export class PrismaPermissionRepository implements IPermissionRepository {
  async create(data: CreatePermissionDTO): Promise<Permission> {
    const permission = await prisma.permission.create({
      data: {
        action: data.action,
        description: data.description
      }
    });
    return permission as unknown as Permission;
  }

  async findAll(): Promise<Permission[]> {
    const permissions = await prisma.permission.findMany();
    return permissions as unknown as Permission[];
  }

  async findById(id: string): Promise<Permission | null> {
    const permission = await prisma.permission.findUnique({
      where: { id }
    });
    return permission as unknown as Permission;
  }

  async findByAction(action: string): Promise<Permission | null> {
    const permission = await prisma.permission.findUnique({
      where: { action }
    });
    return permission as unknown as Permission;
  }

  async update(id: string, data: UpdatePermissionDTO): Promise<Permission> {
    const permission = await prisma.permission.update({
      where: { id },
      data: {
        action: data.action,
        description: data.description
      }
    });
    return permission as unknown as Permission;
  }

  async delete(id: string): Promise<void> {
    await prisma.permission.delete({
      where: { id }
    });
  }
}
