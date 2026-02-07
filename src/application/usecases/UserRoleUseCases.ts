import { IUserRoleRepository } from '../../domain/repositories/IUserRoleRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IRoleRepository } from '../../domain/repositories/IRoleRepository';
import { Role } from '../../domain/entities/Role';
import { User } from '../../domain/entities/User';
import { NotFoundError, BadRequestError } from '../../domain/errors/AppError';

export class AssignRoleToUserUseCase {
  constructor(
    private userRoleRepo: IUserRoleRepository,
    private userRepo: IUserRepository,
    private roleRepo: IRoleRepository
  ) {}

  async execute(userId: string, roleId: string): Promise<void> {
    // 1. Vérifier l'existence de l'utilisateur
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError(`User with ID ${userId} not found`);

    // 2. Vérifier l'existence du rôle
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError(`Role with ID ${roleId} not found`);

    // 3. Vérifier les doublons
    const exists = await this.userRoleRepo.exists(userId, roleId);
    if (exists) throw new BadRequestError('Role is already assigned to this user');

    // 4. Assigner
    await this.userRoleRepo.assign(userId, roleId);
  }
}

export class RevokeRoleFromUserUseCase {
  constructor(
    private userRoleRepo: IUserRoleRepository,
    private userRepo: IUserRepository,
    private roleRepo: IRoleRepository
  ) {}

  async execute(userId: string, roleId: string): Promise<void> {
    // 1. Vérifications basiques d'existence
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError(`User with ID ${userId} not found`);

    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError(`Role with ID ${roleId} not found`);

    // 2. Révoquer (si l'assignation n'existe pas, deleteMany ne lèvera pas d'erreur, ce qui est idempotent)
    await this.userRoleRepo.revoke(userId, roleId);
  }
}

export class GetUserRolesUseCase {
  constructor(
    private userRoleRepo: IUserRoleRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(userId: string): Promise<Role[]> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError(`User with ID ${userId} not found`);

    return this.userRoleRepo.getUserRoles(userId);
  }
}

export class GetRoleUsersUseCase {
  constructor(
    private userRoleRepo: IUserRoleRepository,
    private roleRepo: IRoleRepository
  ) {}

  async execute(roleId: string): Promise<User[]> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError(`Role with ID ${roleId} not found`);

    return this.userRoleRepo.getRoleUsers(roleId);
  }
}
