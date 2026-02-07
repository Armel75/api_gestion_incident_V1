import { Role, CreateRoleDTO, UpdateRoleDTO } from '../entities/Role';
import { Permission } from '../entities/Permission';

export interface IRoleRepository {
  create(data: CreateRoleDTO): Promise<Role>;
  findAll(): Promise<Role[]>;
  findById(id: string): Promise<Role | null>;
  update(id: string, data: UpdateRoleDTO): Promise<Role>;
  delete(id: string): Promise<void>;
  
  // Relations Role <-> Permission
  addPermission(roleId: string, permissionId: string): Promise<void>;
  removePermission(roleId: string, permissionId: string): Promise<void>;
  getPermissionsByRoleId(roleId: string): Promise<Permission[]>;
  getRolesByPermissionId(permissionId: string): Promise<Role[]>;
}
