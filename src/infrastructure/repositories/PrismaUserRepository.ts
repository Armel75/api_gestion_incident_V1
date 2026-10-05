import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User, UpdateUserDTO, CreateUserDTO } from '../../domain/entities/User';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuthUser } from '../../domain/entities/AuthUser';

const prisma = new PrismaClient();

export class PrismaUserRepository implements IUserRepository {
      async findByResetToken(token: string): Promise<User | null> {
        const user = await prisma.user.findFirst({
          where: {
            resetPasswordToken: token,
            resetPasswordExpires: { gt: new Date() },
            deletedAt: null
          },
          include: {
            roles: { include: { role: true } },
            site: true
          }
        });
        return user ? this.mapToUser(user) : null;
      }

      async updatePasswordAndClearToken(userId: number, password: string): Promise<void> {
        const passwordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { id: userId },
          data: {
            passwordHash,
            resetPasswordToken: null,
            resetPasswordExpires: null
          }
        });
      }
    async saveResetToken(userId: number, token: string, expires: Date): Promise<void> {
      await prisma.user.update({
        where: { id: userId },
        data: {
          resetPasswordToken: token as any,
          resetPasswordExpires: expires as any
        } as any
      });
    }
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async update(id: number, data: UpdateUserDTO): Promise<User> {
    const { password, roleIds, siteId, ...rest } = data;

    await prisma.$transaction(async (tx) => {
      let passwordHash: string | undefined;

      if (password && password.trim().length > 0) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      await tx.user.update({
        where: { id },
        data: {
          ...rest,
          ...(siteId !== undefined && { siteId }),
          ...(passwordHash ? { passwordHash } : {})
        }
      });

      if (roleIds) {
        await tx.userRole.deleteMany({
          where: { userId: id }
        });

        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: id,
            roleId
          }))
        });
      }
    });

    const userWithRoles = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return this.mapToUser(userWithRoles!);
  }

  async findById(id: number): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findAll(skip?: number, take?: number, search?: string): Promise<User[]> {
    const where: any = { deletedAt: null };

    // Recherche multi-colonnes (serveur) : couvre toute la table, pas seulement la page chargée.
    const term = search?.trim();
    if (term) {
      const or: any[] = [
        { username: { contains: term } },
        { email: { contains: term } },
        { matricule: { contains: term } },
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { roles: { some: { role: { name: { contains: term } } } } },
        { site: { name: { contains: term } } }
      ];

      // Recherche par ID (si le terme est un entier)
      if (/^\d+$/.test(term)) {
        or.push({ id: Number(term) });
      }

      // Recherche par statut : « actif » / « inactif »
      const lower = term.toLowerCase();
      if (lower.includes('inactif')) {
        or.push({ isActive: false });
      } else if (lower.includes('actif')) {
        or.push({ isActive: true });
      }

      where.OR = or;
    }

    const users = await prisma.user.findMany({
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
      where,
      orderBy: { id: 'desc' }, // Tri décroissant par ID
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return users.map((u) => this.mapToUser(u));
  }

  async delete(id: number): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async create(data: CreateUserDTO): Promise<User> {
    const { password, roleIds, siteId, ...rest } = data;

    const passwordHash = await bcrypt.hash(password, 10);

    let effectiveRoleIds = roleIds ?? [];

    if (effectiveRoleIds.length === 0) {
      const employeeRole = await prisma.role.upsert({
        where: { name: 'EMPLOYE' },
        update: {},
        create: { name: 'EMPLOYE' },
      });

      effectiveRoleIds = [employeeRole.id];
    }

    const roles = await prisma.role.findMany({
      where: { id: { in: effectiveRoleIds } },
      select: { name: true }
    });

    const isAdmin = roles.some((r) => r.name === 'ADMIN');

    if (!isAdmin && effectiveRoleIds.length > 0 && siteId !== undefined && siteId === null) {
      throw new Error('Un utilisateur non admin doit appartenir à un site');
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          ...rest,
          siteId: isAdmin ? null : siteId ?? null,
          isActive: rest.isActive ?? true,
          passwordHash
        }
      });

      if (effectiveRoleIds.length > 0) {
        await tx.userRole.createMany({
          data: effectiveRoleIds.map((roleId) => ({
            userId: createdUser.id,
            roleId
          }))
        });
      }

      return createdUser;
    });

    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return this.mapToUser(userWithRoles!);
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findByMatricule(matricule: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { matricule, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        site: true
      }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findAuthUserByUsername(username: string): Promise<AuthUser | null> {
    return prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        isActive: true,
        siteId: true,
        roles: {
          select: {
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
  }

  private mapToUser(prismaUser: any): User {
    return {
      id: prismaUser.id,
      username: prismaUser.username,
      matricule: prismaUser.matricule ?? null,
      email: prismaUser.email ?? null,
      firstName: prismaUser.firstName ?? null,
      lastName: prismaUser.lastName ?? null,
      isActive: prismaUser.isActive,
      siteId: prismaUser.siteId ?? null,
      site: prismaUser.site
        ? {
            id: prismaUser.site.id,
            name: prismaUser.site.name
          }
        : null,
      // Ajout du mapping pour reset password
      resetPasswordToken: prismaUser.resetPasswordToken ?? null,
      resetPasswordExpires: prismaUser.resetPasswordExpires ?? null,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      deletedAt: prismaUser.deletedAt,
      roles: prismaUser.roles?.map((ur: any) => ur.role.name)
    };
  }
}