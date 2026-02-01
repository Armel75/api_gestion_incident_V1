import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { IRefreshTokenRepository } from '../../domain/repositories/IRefreshTokenRepository';
import { LoginUserDTO } from '../../domain/entities/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_SECRET || 'access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

export class LoginUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private refreshTokenRepository: IRefreshTokenRepository
  ) {}

  async execute(data: LoginUserDTO): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findByUsername(data.username);
    
    // Security: Check if user exists
    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    // Security: Check if user is active
    if (!user.isActive) {
      throw new Error('Account is inactive or locked');
    }

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    // Generate Payload
    const payload = {
      id: user.id,
      username: user.username
    };

    // 1. Generate Access Token (8 hours - work day session)
    // Prevents "Invalid Token" errors during normal usage without forcing constant refresh
    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '8h' });

    // 2. Generate Refresh Token (30 days)
    // Extended duration for long-term sessions
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });

    // 3. Persist Refresh Token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepository.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: expiresAt
    });

    return { accessToken, refreshToken };
  }
}