import { Request, Response, NextFunction } from 'express';
import { RegisterUserUseCase } from '../../../application/usecases/RegisterUserUseCase';
import { LoginUserUseCase } from '../../../application/usecases/LoginUserUseCase';
import { RefreshTokenUseCase } from '../../../application/usecases/RefreshTokenUseCase';
import { LogoutUseCase } from '../../../application/usecases/LogoutUseCase';
import { PrismaUserRepository } from '../../../infrastructure/repositories/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '../../../infrastructure/repositories/PrismaRefreshTokenRepository';
import { z } from 'zod';
import { UnauthorizedError } from '../../../domain/errors/AppError';

const authSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

export class AuthController {
  
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = authSchema.parse((req as any).body);
      const userRepo = new PrismaUserRepository();
      const useCase = new RegisterUserUseCase(userRepo);
      const user = await useCase.execute(data);
      
      const { password, ...userWithoutPassword } = user;
      return (res as any).status(201).json(userWithoutPassword);
    } catch (error: any) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = authSchema.parse((req as any).body);
      const userRepo = new PrismaUserRepository();
      const tokenRepo = new PrismaRefreshTokenRepository();
      
      const useCase = new LoginUserUseCase(userRepo, tokenRepo);
      const tokens = await useCase.execute(data);
      
      return (res as any).status(200).json(tokens);
    } catch (error: any) {
      // Convert generic errors to Unauthorized if relevant, or just pass
      if (error.message === 'Invalid credentials') {
        return next(new UnauthorizedError('Invalid credentials'));
      }
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const data = refreshSchema.parse((req as any).body);
      const userRepo = new PrismaUserRepository();
      const tokenRepo = new PrismaRefreshTokenRepository();

      const useCase = new RefreshTokenUseCase(tokenRepo, userRepo);
      const tokens = await useCase.execute(data.refreshToken);

      return (res as any).status(200).json(tokens);
    } catch (error: any) {
      next(new UnauthorizedError(error.message || 'Invalid or expired session'));
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const data = refreshSchema.parse((req as any).body);
      const tokenRepo = new PrismaRefreshTokenRepository();
      const useCase = new LogoutUseCase(tokenRepo);
      
      await useCase.execute(data.refreshToken);
      
      return (res as any).status(204).send();
    } catch (error: any) {
      next(error);
    }
  }
}
