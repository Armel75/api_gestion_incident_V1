import { IRefreshTokenRepository } from '../../domain/repositories/IRefreshTokenRepository';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_SECRET || 'access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

export class RefreshTokenUseCase {
  constructor(
    private refreshTokenRepository: IRefreshTokenRepository,
    private userRepository: IUserRepository
  ) {}

  async execute(incomingRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // 1. Check if token exists in DB
    const existingToken = await this.refreshTokenRepository.findByToken(incomingRefreshToken);

    if (!existingToken) {
      // Possible token reuse attack or invalid token
      throw new Error('Invalid Refresh Token');
    }

    // 2. Security: Token Reuse Detection
    if (existingToken.revoked) {
      // Critical Security Event: A revoked token is being used.
      // Immediate action: Revoke ALL tokens for this user to force re-login.
      await this.refreshTokenRepository.revokeAllForUser(existingToken.userId);
      throw new Error('Security Alert: Token reuse detected. Please log in again.');
    }

    // 3. Verify JWT signature (after checking DB revocation to catch reuse fast)
    let decoded: any;
    try {
      decoded = jwt.verify(incomingRefreshToken, REFRESH_SECRET);
    } catch (err) {
      // If expired but not revoked in DB, we still treat it as invalid.
      throw new Error('Invalid or Expired Refresh Token');
    }

    // 4. Validate User status
    const user = await this.userRepository.findById(existingToken.userId);
    if (!user) {
      throw new Error('User no longer exists');
    }

    // 5. ROTATION LOGIC
    // Generate new tokens
    const payload = { id: user.id, username: user.username };
    const newAccessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save new token
    await this.refreshTokenRepository.create({
      token: newRefreshToken,
      userId: user.id,
      expiresAt: expiresAt
    });

    // Revoke the old token and link it to the new one
    await this.refreshTokenRepository.revoke(existingToken.id, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}