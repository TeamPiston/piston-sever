import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OPENAI_CLIENT } from '../../openai/openai.provider';
import { ChatMessage } from '../entities/chat-message.entity';

const SYSTEM_PROMPT =
  '당신은 3D 모델 디자인을 도와주는 대화형 어시스턴트입니다. ' +
  '당신은 직접 3D 출력/생성을 트리거할 수 없습니다. ' +
  '사용자가 원하는 디자인에 대해 대화로 구체화하도록 돕고, ' +
  '사용자가 디자인에 만족하면 화면의 "출력하기" 버튼을 눌러 출력을 시작하라고 안내하세요.';

/**
 * 주어진 버퍼를 OpenAI vision 입력용 base64 data URI로 변환한다.
 */
export function toBase64DataUri(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * OpenAI를 이용해 채팅 대화 응답을 생성하는 서비스. tools/function calling은 사용하지 않는다.
 */
@Injectable()
export class ChatAiService {
  constructor(@Inject(OPENAI_CLIENT) private readonly openai: OpenAI | null) {}

  /**
   * 최근 대화 히스토리와 현재 메시지(및 선택적 이미지)를 바탕으로 자연어 응답을 생성한다.
   */
  async generateReply(
    history: ChatMessage[],
    currentMessage: string,
    currentImageDataUri?: string,
  ): Promise<string> {
    if (!this.openai) {
      throw new InternalServerErrorException(
        'OpenAI 클라이언트가 설정되지 않았습니다 (OPENAI_API_KEY 확인 필요).',
      );
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(
        (chat): ChatCompletionMessageParam => ({
          role: chat.role === 'USER' ? 'user' : 'assistant',
          content: chat.message,
        }),
      ),
      {
        role: 'user',
        content: currentImageDataUri
          ? [
              { type: 'text', text: currentMessage },
              { type: 'image_url', image_url: { url: currentImageDataUri } },
            ]
          : currentMessage,
      },
    ];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new InternalServerErrorException(
        'OpenAI로부터 응답을 생성하지 못했습니다.',
      );
    }
    return content;
  }
}
