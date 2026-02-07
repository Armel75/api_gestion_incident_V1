import { Permission } from './Permission';

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions?: Permission[];
}

export type CreateRoleDTO = Pick<Role, 'name' | 'description'>;
export type UpdateRoleDTO = Partial<Pick<Role, 'name' | 'description'>>;
