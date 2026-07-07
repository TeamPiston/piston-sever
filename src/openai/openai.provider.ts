import { OpenAI } from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

export const openaiProvider = {
  provide: OPENAI_CLIENT,
  useFactory: () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
};
