import { IRolePermissionRepository } from '../../domain/repositories/IRolePermissionRepository';
import { IRoleRepository } from '../../domain/repositories/IRoleRepository';
import { IPermissionRepository } from '../../domain/repositories/IPermissionRepository';
import { Role } from '../../domain/entities/Role';
import { Permission } from '../../domain/entities/Permission';
import { NotFoundError, BadRequestError } from '../../domain/errors/AppError';

export class AssignPermissionToRoleUseCase {
  constructor(
    private rolePermissionRepo: IRolePermissionRepository,
    private roleRepo: IRoleRepository,
    private permissionRepo: IPermissionRepository
  ) {}

  async execute(roleId: string, permissionId: string): Promise<void> {
    // 1. Check Role existence
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError(`Role with ID ${roleId} not found`);

    // 2. Check Permission existence
    const permission = await this.permissionRepo.findById(permissionId);
    if (!permission) throw new NotFoundError(`Permission with ID ${permissionId} not found`);

    // 3. Check for duplicates
    const exists = await this.rolePermissionRepo.exists(roleId, permissionId);
    if (exists) throw new BadRequestError('Permission is already assigned to this role');

    // 4. Assign
    await this.rolePermissionRepo.assign(roleId, permissionId);
  }
}

export class RevokePermissionFromRoleUseCase {
  constructor(
    private rolePermissionRepo: IRolePermissionRepository,
    private roleRepo: IRoleRepository,
    private permissionRepo: IPermissionRepository
  ) {}

  async execute(roleId: string, permissionId: string): Promise<void> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError(`Role with ID ${roleId} not found`);

    const permission = await this.permissionRepo.findById(permissionId);
    if (!permission) throw new NotFoundError(`Permission with ID ${permissionId} not found`);

    await this.rolePermissionRepo.revoke(roleId, permissionId);
  }
}

export class GetPermissionsByRoleUseCase {
  constructor(
    private rolePermissionRepo: IRolePermissionRepository,
    private roleRepo: IRoleRepository
  ) {}

  async execute(roleId: string): Promise<Permission[]> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError(`Role with ID ${roleId} not found`);

    return this.rolePermissionRepo.getPermissionsByRole(roleId);
  }
}

export class GetRolesByPermissionUseCase {
  constructor(
    private rolePermissionRepo: IRolePermissionRepository,
    private permissionRepo: IPermissionRepository
  ) {}

  async execute(permissionId: string): Promise<Role[]> {
    const permission = await this.permissionRepo.findById(permissionId);
    if (!permission) throw new NotFoundError(`Permission with ID ${permissionId} not found`);

    return this.rolePermissionRepo.getRolesByPermission(permissionId);
  }
}
