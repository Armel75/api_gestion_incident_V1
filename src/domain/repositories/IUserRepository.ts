import { User, RegisterUserDTO } from '../entities/User';

export interface IUserRepository {
  create(data: RegisterUserDTO): Promise<User>;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(skip?: number, take?: number): Promise<User[]>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}