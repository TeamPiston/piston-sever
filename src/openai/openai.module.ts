import { Module } from '@nestjs/common';
import { openaiProvider } from './openai.provider';

/**
 * OpenAI 클라이언트 프로바이더(openaiProvider)를 등록하고 내보내는 모듈.
 */
@Module({
  providers: [openaiProvider],
  exports: [openaiProvider],
})
export class OpenaiModule {}
