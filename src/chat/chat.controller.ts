import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './application/chat.service';
import { ChatGenerateDto } from './dto/chat-generate.dto';
import { GetChatHistoryDto } from './dto/get-chat-history.dto';
import { SendMessageDto } from './dto/send-message.dto';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * AI와의 채팅(메시지 전송/히스토리 조회) 및 "출력하기" 3D 출력 트리거를 처리하는 컨트롤러.
 */
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 사용자 메시지(+선택적 이미지)를 전송하고 AI 대화 응답을 받는다(`POST /chats/messages`).
   * 이 엔드포인트는 3D 출력 큐를 건드리지 않으며 응답의 jobId는 항상 null이다.
   */
  @Post('messages')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype));
      },
    }),
  )
  async sendMessage(
    @CurrentUser() user: { userId: string },
    @Body() dto: SendMessageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.chatService.sendMessage(user.userId, dto.message, image);
  }

  /**
   * chatId 기준 커서 페이지네이션으로 채팅 히스토리를 조회한다(`GET /chats/messages`).
   */
  @Get('messages')
  async getHistory(
    @CurrentUser() user: { userId: string },
    @Query() query: GetChatHistoryDto,
  ) {
    return this.chatService.getHistory(user.userId, query.cursor, query.size);
  }

  /**
   * "출력하기" 버튼 클릭 시 호출되는 3D 출력 트리거(`POST /chats/generate`).
   * 이 엔드포인트에서만 3D 출력 파이프라인 큐에 job이 등록된다.
   */
  @Post('generate')
  async generate(
    @CurrentUser() user: { userId: string },
    @Body() dto: ChatGenerateDto,
  ) {
    return this.chatService.generate(user.userId, dto.prompt);
  }
}
