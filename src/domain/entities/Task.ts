export interface Task {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateTaskDTO = Pick<Task, 'name' | 'description'>;