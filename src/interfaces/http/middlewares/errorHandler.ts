import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../../../domain/errors/AppError';
import { ZodError } from 'zod';
import { Logger } from '../../../infrastructure/logging/Logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req as any).headers['x-correlation-id'] || 'unknown';
  
  // Utilisation du Logger structuré au lieu de console.error
  Logger.error(err.message, { 
    correlationId, 
    stack: err.stack,
    url: (req as any).originalUrl,
    method: (req as any).method
  });

  // 1. Handle Trusted Operational Errors (AppError)
  if (err instanceof AppError) {
    const response: any = {
      status: 'error',
      code: err.code,
      message: err.message,
      correlationId
    };
    
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    return (res as any).status(err.statusCode).json(response);
  }

  // 2. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    return (res as any).status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.issues,
      correlationId
    });
  }

  // 3. Handle Unexpected Technical Errors
  const isDev = process.env.NODE_ENV === 'development';
  return (res as any).status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    correlationId,
    ...(isDev && { stack: err.stack })
  });
};