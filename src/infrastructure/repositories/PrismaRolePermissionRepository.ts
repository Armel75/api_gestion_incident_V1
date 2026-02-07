import { IRolePermissionRepository } from '../../domain/repositories/IRolePermissionRepository';
import { Role } from '../../domain/entities/Role';
import { Permission } from '../../domain/entities/Permission';
import prisma from '../database/prisma';

export class PrismaRolePermissionRepository implements IRolePermissionRepository {
  async assign(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId
      }
    });
  }

  async revoke(roleId: string, permissionId: string): Promise<void> {
    // Utilisation de deleteMany pour gérer la clé composite (roleId, permissionId) de manière robuste
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId
      }
    });
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    const results = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true }
    });
    return results.map((rp: any) => rp.permission) as unknown as Permission[];
  }

  async getRolesByPermission(permissionId: string): Promise<Role[]> {
    const results = await prisma.rolePermission.findMany({
      where: { permissionId },
      include: { role: true }
    });
    return results.map((rp: any) => rp.role) as unknown as Role[];
  }

  async exists(roleId: string, permissionId: string): Promise<boolean> {
    const count = await prisma.rolePermission.count({
      where: {
        roleId,
        permissionId
      }
    });
    return count > 0;
  }
}
