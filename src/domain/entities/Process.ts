export interface SubProcess {
  id: string;
  name: string;
  processId: string;
}

export interface Process {
  id: string;
  name: string;
  userId: string;
  subProcesses?: SubProcess[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export type CreateProcessDTO = Pick<Process, 'name' | 'userId'>;