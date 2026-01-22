import { Request, Response } from 'express';
import prisma from '../../../infrastructure/database/prisma';
import { Logger } from '../../../infrastructure/logging/Logger';

export class HealthController {
  
  // Liveness probe: L'application tourne-t-elle ?
  static async health(req: Request, res: Response) {
    (res as any).status(200).json({ 
      status: 'UP', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }

  // Readiness probe: L'application peut-elle traiter des requêtes (connexion BDD OK) ?
  static async ready(req: Request, res: Response) {
    try {
      // Test simple de connexion BDD
      await prisma.$queryRaw`SELECT 1`;
      
      (res as any).status(200).json({ 
        status: 'READY', 
        services: {
          database: 'UP'
        }
      });
    } catch (error: any) {
      Logger.error('Healthcheck Readiness Failed: Database unreachable', { error: error.message });
      (res as any).status(503).json({ 
        status: 'NOT_READY', 
        services: {
          database: 'DOWN'
        }
      });
    }
  }
}