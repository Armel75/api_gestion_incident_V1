import { Role } from '../entities/Role';
import { User } from '../entities/User';

export interface IUserRoleRepository {
  assign(userId: string, roleId: string): Promise<void>;
  revoke(userId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
  getRoleUsers(roleId: string): Promise<User[]>;
  exists(userId: string, roleId: string): Promise<boolean>;
}
