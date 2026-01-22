export interface User {
  id: string;
  username: string;
  password?: string; // Optional for response DTOs
  isActive: boolean;
  roles?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type RegisterUserDTO = Pick<User, 'username' | 'password'>;
export type LoginUserDTO = Pick<User, 'username' | 'password'>;