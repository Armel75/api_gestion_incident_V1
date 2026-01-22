export interface Incident {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  reporterId: string;
  siteId: string;
  subProcessId: string;
  subCategoryId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateIncidentDTO = Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'deletedAt'>;
export type UpdateIncidentDTO = Partial<Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;