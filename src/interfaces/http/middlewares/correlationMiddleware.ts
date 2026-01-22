import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req as any).headers['x-correlation-id'] || randomUUID();
  (req as any).headers['x-correlation-id'] = correlationId;
  (res as any).setHeader('X-Correlation-ID', correlationId);
  next();
};