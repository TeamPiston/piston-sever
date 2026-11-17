import { OpenAI } from 'openai';
import { ScadGeneratorPort } from '../../domain/ports/scad-generator.port';

/**
 * OpenAI GPT 모델을 이용해 프롬프트로부터 OpenSCAD 코드를 생성하는 어댑터.
 */
export class GptScadGenerator implements ScadGeneratorPort {
  constructor(private readonly openai: OpenAI) {}

  /**
   * GPT-4o에 프롬프트를 전달해 OpenSCAD 코드를 생성하고, 응답에서 코드펜스를 제거해 반환한다.
   */
  async generate(prompt: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an OpenSCAD expert. Generate valid OpenSCAD code for the given description. Return only the code, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
    });
    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error('OpenAI로부터 SCAD 코드를 생성하지 못했습니다.');
    }
    return stripCodeFence(content);
  }
}

/**
 * 마크다운 코드펜스(```)로 감싸진 응답 문자열에서 순수 코드 부분만 추출한다.
 */
function stripCodeFence(content: string): string {
  const match = content.trim().match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return match ? match[1] : content;
}
