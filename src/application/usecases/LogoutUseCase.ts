import { IRefreshTokenRepository } from '../../domain/repositories/IRefreshTokenRepository';

export class LogoutUseCase {
  constructor(private refreshTokenRepository: IRefreshTokenRepository) {}

  async execute(refreshToken: string): Promise<void> {
    const token = await this.refreshTokenRepository.findByToken(refreshToken);
    if (token) {
      await this.refreshTokenRepository.revoke(token.id);
    }
  }
}