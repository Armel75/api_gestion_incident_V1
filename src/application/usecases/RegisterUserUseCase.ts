import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { RegisterUserDTO, User } from '../../domain/entities/User';
import bcrypt from 'bcrypt';

export class RegisterUserUseCase {
  constructor(private userRepository: IUserRepository) {}

  async execute(data: RegisterUserDTO): Promise<User> {
    const existing = await this.userRepository.findByUsername(data.username);
    if (existing) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password!, 10);
    
    return this.userRepository.create({
      username: data.username,
      password: hashedPassword
    });
  }
}