import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * `users` 테이블에 매핑되는 사용자 엔티티.
 */
@Entity('users')
export class User {
  /** 사용자 고유 식별자 (PK, 자동 증가). */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'user_id' })
  userId: string;

  /** 로그인에 사용되는 아이디 (고유). */
  @Column({ name: 'login_id', type: 'varchar', length: 30, unique: true })
  loginId: string;

  /** 사용자 이메일 주소 (고유). */
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** 해시된 사용자 비밀번호. */
  @Column({ type: 'varchar', length: 255 })
  password: string;

  /** 이메일 인증 여부. */
  @Column({ type: 'boolean', default: false })
  verified: boolean;

  /** 사용자 생성 시각. */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;
}
