import { IRefreshTokenRepository } from '../../domain/repositories/IRefreshTokenRepository';
import { RefreshToken, CreateRefreshTokenDTO } from '../../domain/entities/RefreshToken';
import prisma from '../database/prisma';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: CreateRefreshTokenDTO): Promise<RefreshToken> {
    const token = await prisma.refreshToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        revoked: false
      }
    });
    return token as unknown as RefreshToken;
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    const found = await prisma.refreshToken.findUnique({
      where: { token }
    });
    return found as unknown as RefreshToken;
  }

  async revoke(id: string, replacedBy?: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { 
        revoked: true,
        replacedByToken: replacedBy
      }
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true }
    });
  }
}