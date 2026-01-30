export interface Task {
  id: string;
  name: string;
  description?: string | null;
  userId: string;
  incidentId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateTaskDTO = Pick<Task, 'name' | 'description' | 'userId' | 'incidentId'>;