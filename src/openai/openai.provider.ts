import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

export const openaiProvider = {
  provide: OPENAI_CLIENT,
  useFactory: (configService: ConfigService): OpenAI | null => {
    const apiKey = configService.get<string>('OPENAI_API_KEY');
    return apiKey ? new OpenAI({ apiKey }) : null;
  },
  inject: [ConfigService],
};
