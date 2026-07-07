import { OpenAI } from 'openai';
import { ScadGeneratorPort } from '../../domain/ports/scad-generator.port';

export class GptScadGenerator implements ScadGeneratorPort {
  constructor(private readonly openai: OpenAI) {}

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

function stripCodeFence(content: string): string {
  const match = content.trim().match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return match ? match[1] : content;
}
