import { IRoleRepository } from '../../domain/repositories/IRoleRepository';
import { IPermissionRepository } from '../../domain/repositories/IPermissionRepository';
import { CreateRoleDTO, UpdateRoleDTO, Role } from '../../domain/entities/Role';
import { Permission } from '../../domain/entities/Permission';
import { NotFoundError, BadRequestError } from '../../domain/errors/AppError';

export class CreateRoleUseCase {
  constructor(private repo: IRoleRepository) {}
  async execute(data: CreateRoleDTO): Promise<Role> {
    return this.repo.create(data);
  }
}

export class GetAllRolesUseCase {
  constructor(private repo: IRoleRepository) {}
  async execute(): Promise<Role[]> {
    return this.repo.findAll();
  }
}

export class GetRoleByIdUseCase {
  constructor(private repo: IRoleRepository) {}
  async execute(id: string): Promise<Role> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundError('Role not found');
    return role;
  }
}

export class UpdateRoleUseCase {
  constructor(private repo: IRoleRepository) {}
  async execute(id: string, data: UpdateRoleDTO): Promise<Role> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundError('Role not found');
    return this.repo.update(id, data);
  }
}

export class DeleteRoleUseCase {
  constructor(private repo: IRoleRepository) {}
  async execute(id: string): Promise<void> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundError('Role not found');
    return this.repo.delete(id);
  }
}

// --- Role Permission Management ---

export class AssignPermissionToRoleUseCase {
  constructor(
    private roleRepo: IRoleRepository,
    private permissionRepo: IPermissionRepository
  ) {}

  async execute(roleId: string, permissionId: string): Promise<void> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError('Role not found');

    const permission = await this.permissionRepo.findById(permissionId);
    if (!permission) throw new NotFoundError('Permission not found');

    // Check strict duplication if necessary, but DB unique constraint usually handles it.
    // However, Prisma throw on duplicate, so we might let it throw or check first.
    // For simplicity and performance, we let the DB constraint or Repository handle duplicates,
    // or we can check:
    const currentPerms = await this.roleRepo.getPermissionsByRoleId(roleId);
    if (currentPerms.some(p => p.id === permissionId)) {
        throw new BadRequestError('Permission already assigned to this role');
    }

    await this.roleRepo.addPermission(roleId, permissionId);
  }
}

export class RevokePermissionFromRoleUseCase {
  constructor(private roleRepo: IRoleRepository) {}

  async execute(roleId: string, permissionId: string): Promise<void> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError('Role not found');
    
    await this.roleRepo.removePermission(roleId, permissionId);
  }
}

export class GetRolePermissionsUseCase {
  constructor(private roleRepo: IRoleRepository) {}
  
  async execute(roleId: string): Promise<Permission[]> {
    const role = await this.roleRepo.findById(roleId);
    if (!role) throw new NotFoundError('Role not found');
    
    return this.roleRepo.getPermissionsByRoleId(roleId);
  }
}

export class GetRolesByPermissionUseCase {
  constructor(
      private roleRepo: IRoleRepository,
      private permissionRepo: IPermissionRepository
  ) {}

  async execute(permissionId: string): Promise<Role[]> {
      const permission = await this.permissionRepo.findById(permissionId);
      if (!permission) throw new NotFoundError('Permission not found');
      
      return this.roleRepo.getRolesByPermissionId(permissionId);
  }
}
