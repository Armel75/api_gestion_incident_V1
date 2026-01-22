import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/User';

export class GetUserUseCase {
  constructor(private repo: IUserRepository) {}
  async execute(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }
}

export class GetAllUsersUseCase {
  constructor(private repo: IUserRepository) {}
  async execute(skip: number, take: number): Promise<User[]> {
    return this.repo.findAll(skip, take);
  }
}

export class UpdateUserUseCase {
  constructor(private repo: IUserRepository) {}
  async execute(id: string, data: Partial<User>): Promise<User> {
    // Business logic: e.g. forbid username change if needed
    return this.repo.update(id, data);
  }
}

export class DeleteUserUseCase {
  constructor(private repo: IUserRepository) {}
  async execute(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}