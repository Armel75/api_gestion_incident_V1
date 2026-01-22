import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../../infrastructure/logging/Logger';

// Log technique de toutes les requêtes entrantes
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req as any).headers['x-correlation-id'];
  const start = Date.now();

  (res as any).on('finish', () => {
    const duration = Date.now() - start;
    Logger.log({
      level: 'http',
      message: `${(req as any).method} ${(req as any).originalUrl}`,
      correlationId,
      meta: {
        method: (req as any).method,
        url: (req as any).originalUrl,
        status: (res as any).statusCode,
        duration: `${duration}ms`,
        ip: (req as any).ip,
        userAgent: (req as any).get('user-agent')
      }
    });
  });

  next();
};

// Log d'audit pour les actions de modification (POST, PUT, PATCH, DELETE)
export const auditLogger = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req as any).headers['x-correlation-id'];

  (res as any).on('finish', () => {
    // On loggue l'audit seulement si la requête a réussi (2xx) et si c'est une modif
    if ((res as any).statusCode >= 200 && (res as any).statusCode < 300) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((req as any).method)) {
        const user = (req as any).user;
        Logger.log({
          level: 'info', // Ou 'security' selon la criticité
          message: `AUDIT: User ${user?.username || 'anonymous'} performed ${(req as any).method} on ${(req as any).path}`,
          correlationId,
          audit: {
            who: user?.id || 'anonymous',
            what: (req as any).method,
            target: (req as any).originalUrl,
            when: new Date().toISOString(),
            status: 'SUCCESS'
          }
        });
      }
    }
  });

  next();
};