import { IRoleRepository } from '../../domain/repositories/IRoleRepository';
import { Role, CreateRoleDTO, UpdateRoleDTO } from '../../domain/entities/Role';
import { Permission } from '../../domain/entities/Permission';
import prisma from '../database/prisma';

export class PrismaRoleRepository implements IRoleRepository {
  async create(data: CreateRoleDTO): Promise<Role> {
    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description
      }
    });
    return role as unknown as Role;
  }

  async findAll(): Promise<Role[]> {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
    
    // Flatten structure to match Domain Entity
    return roles.map((r: any) => ({
      ...r,
      permissions: r.permissions.map((rp: any) => rp.permission)
    })) as unknown as Role[];
  }

  async findById(id: string): Promise<Role | null> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
    
    if (!role) return null;

    return {
      ...role,
      permissions: role.permissions.map((rp: any) => rp.permission)
    } as unknown as Role;
  }

  async update(id: string, data: UpdateRoleDTO): Promise<Role> {
    const role = await prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description
      }
    });
    return role as unknown as Role;
  }

  async delete(id: string): Promise<void> {
    await prisma.role.delete({
      where: { id }
    });
  }

  async addPermission(roleId: string, permissionId: string): Promise<void> {
    // Explicit Many-to-Many handling
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId
      }
    });
  }

  async removePermission(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId
      }
    });
  }

  async getPermissionsByRoleId(roleId: string): Promise<Permission[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true }
    });
    return rolePermissions.map((rp: any) => rp.permission) as unknown as Permission[];
  }

  async getRolesByPermissionId(permissionId: string): Promise<Role[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { permissionId },
      include: { role: true }
    });
    return rolePermissions.map((rp: any) => rp.role) as unknown as Role[];
  }
}
