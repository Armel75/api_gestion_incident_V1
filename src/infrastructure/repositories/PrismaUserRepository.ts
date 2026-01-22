import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User, RegisterUserDTO } from '../../domain/entities/User';
import prisma from '../database/prisma';

export class PrismaUserRepository implements IUserRepository {
  async create(data: RegisterUserDTO): Promise<User> {
    const user = await prisma.user.create({
      data: {
        username: data.username,
        password: data.password!,
        isActive: true // Default to true on creation
      }
    });
    return user as unknown as User;
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { 
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    // Transformation des données pour aplatir la structure Prisma (UserRole -> Role)
    if (!user) return null;

    const flatUser = {
        ...user,
        roles: user.roles.map((ur: any) => ({
            ...ur.role,
            permissions: ur.role.permissions.map((rp: any) => rp.permission)
        }))
    };

    return flatUser as unknown as User;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        roles: {
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        } 
      }
    });

    if (!user) return null;

    const flatUser = {
        ...user,
        roles: user.roles.map((ur: any) => ({
            ...ur.role,
            permissions: ur.role.permissions.map((rp: any) => rp.permission)
        }))
    };

    return flatUser as unknown as User;
  }

  async findAll(skip: number = 0, take: number = 20): Promise<User[]> {
    const users = await prisma.user.findMany({
      skip,
      take,
      include: { 
          roles: {
              include: { role: true }
          }
      }
    });

    return users.map((u: any) => ({
        ...u,
        roles: u.roles.map((ur: any) => ur.role)
    })) as unknown as User[];
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        username: data.username,
        isActive: data.isActive
      }
    });
    return updated as unknown as User;
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}