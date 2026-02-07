export interface Permission {
  id: string;
  action: string; // "code" in the prompt, "action" in the DB schema
  description?: string | null;
}

export type CreatePermissionDTO = Pick<Permission, 'action' | 'description'>;
export type UpdatePermissionDTO = Partial<Pick<Permission, 'action' | 'description'>>;
