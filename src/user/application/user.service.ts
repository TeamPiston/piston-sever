import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  findByLoginId(loginId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { loginId } });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.userRepository.exists({ where: { email } });
  }

  existsByLoginId(loginId: string): Promise<boolean> {
    return this.userRepository.exists({ where: { loginId } });
  }

  async create(data: {
    loginId: string;
    email: string;
    password: string;
  }): Promise<User> {
    const user = this.userRepository.create({ ...data, verified: true });
    return this.userRepository.save(user);
  }
}
