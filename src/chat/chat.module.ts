import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { OpenaiModule } from '../openai/openai.module';
import { QueueModule } from '../queue/queue.module';
import { ChatAiService } from './application/chat-ai.service';
import { ChatService } from './application/chat.service';
import { ChatController } from './chat.controller';
import { ChatMessage } from './entities/chat-message.entity';

/**
 * 채팅 메시지 저장/조회, AI 대화 응답 생성, 3D 출력 트리거를 제공하는 모듈.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage]),
    QueueModule,
    OpenaiModule,
    FilesModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatAiService],
})
export class ChatModule {}
