import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * 사용자 엔티티에 대한 조회, 존재 여부 확인, 생성을 담당하는 서비스.
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 로그인 아이디로 사용자를 조회한다. 없으면 null을 반환한다.
   */
  findByLoginId(loginId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { loginId } });
  }

  /**
   * 이메일로 사용자를 조회한다. 없으면 null을 반환한다.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * 해당 이메일을 가진 사용자가 존재하는지 확인한다.
   */
  existsByEmail(email: string): Promise<boolean> {
    return this.userRepository.exists({ where: { email } });
  }

  /**
   * 해당 로그인 아이디를 가진 사용자가 존재하는지 확인한다.
   */
  existsByLoginId(loginId: string): Promise<boolean> {
    return this.userRepository.exists({ where: { loginId } });
  }

  /**
   * 전달받은 정보로 verified 상태의 사용자를 생성하여 저장한다.
   */
  async create(data: {
    loginId: string;
    email: string;
    password: string;
  }): Promise<User> {
    const user = this.userRepository.create({ ...data, verified: true });
    return this.userRepository.save(user);
  }
}
