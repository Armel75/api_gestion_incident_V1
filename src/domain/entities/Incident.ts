import { Task } from './Task';

export interface Incident {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  reporterId: string;
  userId: string;
  siteId: string;
  subProcessId: string;
  subCategoryId: string;
  tasks?: Task[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateIncidentDTO = Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'deletedAt' | 'tasks'>;
export type UpdateIncidentDTO = Partial<Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'tasks'>>;