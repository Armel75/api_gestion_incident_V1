import { Role } from '../entities/Role';
import { Permission } from '../entities/Permission';

export interface IRolePermissionRepository {
  assign(roleId: string, permissionId: string): Promise<void>;
  revoke(roleId: string, permissionId: string): Promise<void>;
  getPermissionsByRole(roleId: string): Promise<Permission[]>;
  getRolesByPermission(permissionId: string): Promise<Role[]>;
  exists(roleId: string, permissionId: string): Promise<boolean>;
}
