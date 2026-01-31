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
  refreshToken: z.string().min(1).optional()
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
      (next as any)(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = authSchema.parse((req as any).body);
      const userRepo = new PrismaUserRepository();
      const tokenRepo = new PrismaRefreshTokenRepository();
      
      const useCase = new LoginUserUseCase(userRepo, tokenRepo);
      const tokens = await useCase.execute(data);
      
      // Return tokens in body for localStorage usage
      return (res as any).status(200).json({ 
          message: 'Login successful',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
      });
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        return (next as any)(new UnauthorizedError('Invalid credentials'));
      }
      (next as any)(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    // User is attached by the authenticate middleware
    return (res as any).status(200).json((req as any).user);
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      // Expect refresh token in body (standard for non-cookie flows)
      const body = (req as any).body;
      const refreshToken = body.refreshToken;

      if (!refreshToken) {
         throw new UnauthorizedError('No refresh token provided');
      }

      const userRepo = new PrismaUserRepository();
      const tokenRepo = new PrismaRefreshTokenRepository();

      const useCase = new RefreshTokenUseCase(tokenRepo, userRepo);
      const tokens = await useCase.execute(refreshToken);

      return (res as any).status(200).json({ 
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken 
      });
    } catch (error: any) {
      (next as any)(new UnauthorizedError(error.message || 'Invalid or expired session'));
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const body = (req as any).body;
      const refreshToken = body.refreshToken;

      if (refreshToken) {
        const tokenRepo = new PrismaRefreshTokenRepository();
        const useCase = new LogoutUseCase(tokenRepo);
        await useCase.execute(refreshToken);
      }
      
      return (res as any).status(204).send();
    } catch (error: any) {
      (next as any)(error);
    }
  }
}