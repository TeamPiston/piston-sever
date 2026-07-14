import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { FilesService } from '../../files/application/files.service';
import { QueueService } from '../../queue/application/queue.service';
import { ChatAiService, toBase64DataUri } from './chat-ai.service';
import { ChatMessage } from '../entities/chat-message.entity';

const GENERATE_STARTED_MESSAGE = '3D 출력을 시작했습니다.';

export interface ChatResult {
  chatId: string;
  jobId: string | null;
  reply: string;
}

export interface ChatHistoryPage {
  hasNext: boolean;
  nextCursor: string | null;
  chats: Array<{
    chatId: string;
    role: 'USER' | 'ASSISTANT';
    message: string;
    imageUrl: string | null;
    jobId: string | null;
    createdAt: string;
  }>;
}

/**
 * 채팅 메시지 전송, 히스토리 조회, 3D 출력 트리거를 오케스트레이션하는 서비스.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    private readonly chatAiService: ChatAiService,
    private readonly filesService: FilesService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 사용자 메시지(+선택적 이미지)를 저장하고 AI 대화 응답을 생성해 저장한다.
   * 이 경로는 3D 출력 큐를 건드리지 않으며 jobId는 항상 null이다.
   */
  async sendMessage(
    userId: string,
    message: string,
    image?: Express.Multer.File,
  ): Promise<ChatResult> {
    let imageDataUri: string | undefined;
    let imageUrl: string | null = null;

    if (image) {
      imageDataUri = toBase64DataUri(image.buffer, image.mimetype);
      try {
        const ext = image.mimetype.split('/')[1] ?? 'bin';
        imageUrl = await this.filesService.uploadBuffer(
          `chat/${userId}/${randomUUID()}.${ext}`,
          image.buffer,
          image.mimetype,
        );
      } catch (error) {
        this.logger.error('채팅 이미지 MinIO 업로드 실패', error);
      }
    }

    const userRow = await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        userId,
        role: 'USER',
        message,
        imageUrl,
        jobId: null,
      }),
    );

    const contextSize = this.configService.get<number>(
      'CHAT_HISTORY_CONTEXT_SIZE',
      20,
    );
    const history = await this.chatMessageRepository
      .createQueryBuilder('chat')
      .where('chat.user_id = :userId', { userId })
      .andWhere('chat.chat_id < :cursor', { cursor: userRow.chatId })
      .orderBy('chat.chat_id', 'DESC')
      .limit(contextSize)
      .getMany();
    history.reverse();

    const reply = await this.chatAiService.generateReply(
      history,
      message,
      imageDataUri,
    );

    const assistantRow = await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        userId,
        role: 'ASSISTANT',
        message: reply,
        imageUrl: null,
        jobId: null,
      }),
    );

    return { chatId: assistantRow.chatId, jobId: null, reply };
  }

  /**
   * "출력하기" 버튼 클릭 시 호출되는 3D 출력 트리거. 이 경로에서만 큐에 job이 등록된다.
   */
  async generate(userId: string, prompt: string): Promise<ChatResult> {
    const jobId = await this.queueService.addJob(prompt);

    const row = await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        userId,
        role: 'ASSISTANT',
        message: GENERATE_STARTED_MESSAGE,
        imageUrl: null,
        jobId,
      }),
    );

    return { chatId: row.chatId, jobId, reply: GENERATE_STARTED_MESSAGE };
  }

  /**
   * chatId 기준 커서 페이지네이션으로 채팅 히스토리를 조회한다.
   * 응답은 시간 오름차순(과거→최신)으로 정렬된다.
   */
  async getHistory(
    userId: string,
    cursor: string | undefined,
    size: number,
  ): Promise<ChatHistoryPage> {
    const qb = this.chatMessageRepository
      .createQueryBuilder('chat')
      .where('chat.user_id = :userId', { userId });

    if (cursor) {
      qb.andWhere('chat.chat_id < :cursor', { cursor });
    }

    const rows = await qb
      .orderBy('chat.chat_id', 'DESC')
      .limit(size + 1)
      .getMany();

    const hasNext = rows.length > size;
    const page = hasNext ? rows.slice(0, size) : rows;
    const nextCursor = hasNext ? page[page.length - 1].chatId : null;

    return {
      hasNext,
      nextCursor,
      chats: page.reverse().map((chat) => ({
        chatId: chat.chatId,
        role: chat.role,
        message: chat.message,
        imageUrl: chat.imageUrl,
        jobId: chat.jobId,
        createdAt: chat.createdAt.toISOString(),
      })),
    };
  }
}
