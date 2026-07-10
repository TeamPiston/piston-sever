import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

/** OpenAI 클라이언트 인스턴스를 주입받기 위한 DI 토큰. */
export const OPENAI_CLIENT = 'OPENAI_CLIENT';

/**
 * OPENAI_API_KEY 설정값으로 OpenAI 클라이언트를 생성하는 팩토리 프로바이더.
 * API 키가 없으면 null을 제공한다.
 */
export const openaiProvider = {
  provide: OPENAI_CLIENT,
  useFactory: (configService: ConfigService): OpenAI | null => {
    const apiKey = configService.get<string>('OPENAI_API_KEY');
    return apiKey ? new OpenAI({ apiKey }) : null;
  },
  inject: [ConfigService],
};
