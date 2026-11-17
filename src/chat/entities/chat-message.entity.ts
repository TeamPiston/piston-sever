import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 채팅 메시지 역할. 사용자가 보낸 메시지는 USER, AI/시스템 응답은 ASSISTANT.
 */
export type ChatRole = 'USER' | 'ASSISTANT';

/**
 * `chat_messages` 테이블에 매핑되는 채팅 메시지 엔티티.
 * 사용자당 대화방 구분 없이 단일 연속 타임라인으로 저장된다.
 */
@Entity('chat_messages')
@Index(['userId', 'chatId'])
export class ChatMessage {
  /** 채팅 메시지 고유 식별자 (PK, 자동 증가). */
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'chat_id' })
  chatId: string;

  /** 메시지 소유자 (User.userId 참조, FK 관계 없이 스칼라 컬럼). */
  @Column({ name: 'user_id', type: 'bigint' })
  userId: string;

  /** 메시지 발화 주체. */
  @Column({ type: 'enum', enum: ['USER', 'ASSISTANT'], name: 'role' })
  role: ChatRole;

  /** 메시지 본문. */
  @Column({ type: 'text' })
  message: string;

  /** 첨부 이미지의 MinIO 공개 URL (없으면 null). */
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  /** 이 메시지로 트리거된 3D 출력 파이프라인 jobId (없으면 null). */
  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  jobId: string | null;

  /** 메시지 생성 시각. */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;
}
