import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { UpdateUserDTO, User } from '../../domain/entities/User';

export class GetUserUseCase {
  constructor(private repo: IUserRepository) {}

  async execute(id: number): Promise<User | null> {
    return this.repo.findById(id);
  }
}

export class GetAllUsersUseCase {
  constructor(private repo: IUserRepository) {}

  async execute(skip?: number, take?: number, search?: string): Promise<User[]> {
    return this.repo.findAll(skip, take, search);
  }
}

export class UpdateUserUseCase {
  constructor(private repo: IUserRepository) {}

  async execute(id: number, data: UpdateUserDTO): Promise<User> {
    return this.repo.update(id, data);
  }
}

export class DeleteUserUseCase {
  constructor(private repo: IUserRepository) {}

  async execute(id: number): Promise<void> {
    return this.repo.delete(id);
  }
}
