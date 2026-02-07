import { IUserRoleRepository } from '../../domain/repositories/IUserRoleRepository';
import { Role } from '../../domain/entities/Role';
import { User } from '../../domain/entities/User';
import prisma from '../database/prisma';

export class PrismaUserRoleRepository implements IUserRoleRepository {
  async assign(userId: string, roleId: string): Promise<void> {
    await prisma.userRole.create({
      data: {
        userId,
        roleId
      }
    });
  }

  async revoke(userId: string, roleId: string): Promise<void> {
    // Utilisation de deleteMany pour gérer la clé composite de manière sûre via Prisma
    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId
      }
    });
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true } // Join avec la table Roles
    });
    return userRoles.map((ur: any) => ur.role) as unknown as Role[];
  }

  async getRoleUsers(roleId: string): Promise<User[]> {
    const roleUsers = await prisma.userRole.findMany({
      where: { roleId },
      include: { user: true } // Join avec la table Users
    });
    
    // Nettoyage des données sensibles (password) avant retour
    return roleUsers.map((ru: any) => {
      const { password, ...userWithoutPassword } = ru.user;
      return userWithoutPassword;
    }) as unknown as User[];
  }

  async exists(userId: string, roleId: string): Promise<boolean> {
    const count = await prisma.userRole.count({
      where: {
        userId,
        roleId
      }
    });
    return count > 0;
  }
}
