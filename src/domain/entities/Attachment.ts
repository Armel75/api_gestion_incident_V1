export interface Attachment {
  id: string;
  fileName: string;
  url: string;
  incidentId?: string;
  taskId?: string;
  uploadedAt: Date;
}

export type CreateAttachmentDTO = Pick<Attachment, 'fileName' | 'url'>;