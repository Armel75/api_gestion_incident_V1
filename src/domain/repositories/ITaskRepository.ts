import { Task, CreateTaskDTO } from '../entities/Task';
import { CreateAttachmentDTO } from '../entities/Attachment';

export interface ITaskRepository {
  create(data: CreateTaskDTO): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findAll(skip?: number, take?: number): Promise<Task[]>;
  update(id: string, data: Omit<Partial<Task>, 'attachments'> & { attachments?: CreateAttachmentDTO[] }): Promise<Task>;
  delete(id: string): Promise<void>;
}