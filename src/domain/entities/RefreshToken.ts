export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  revoked: boolean;
  expiresAt: Date;
  replacedByToken?: string | null;
  createdAt: Date;
}

export type CreateRefreshTokenDTO = Pick<RefreshToken, 'token' | 'userId' | 'expiresAt'>;