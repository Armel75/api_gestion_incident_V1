import { Task } from './Task';
import { Site } from './Site';
import { User } from './User';
import { Attachment, CreateAttachmentDTO } from './Attachment';

export interface Incident {
  id: string;
  title: string;
  description?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  userId: string; // Creator of the incident
  subProcessId: string;
  subCategoryId: string;
  
  // Relations
  tasks?: Task[];
  sites?: Site[];
  assignedUsers?: User[]; // Users assigned to the incident
  attachments?: Attachment[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateIncidentDTO = {
  title: string;
  description?: string | null;
  userId: string; // Creator
  subProcessId: string;
  subCategoryId: string;
  siteIds: string[];
  assignedUserIds?: string[];
  attachments?: CreateAttachmentDTO[];
};

export type UpdateIncidentDTO = Partial<Omit<CreateIncidentDTO, 'userId'>>;