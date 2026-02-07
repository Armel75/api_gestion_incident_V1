import { Permission, CreatePermissionDTO, UpdatePermissionDTO } from '../entities/Permission';

export interface IPermissionRepository {
  create(data: CreatePermissionDTO): Promise<Permission>;
  findAll(): Promise<Permission[]>;
  findById(id: string): Promise<Permission | null>;
  update(id: string, data: UpdatePermissionDTO): Promise<Permission>;
  delete(id: string): Promise<void>;
  findByAction(action: string): Promise<Permission | null>;
}
