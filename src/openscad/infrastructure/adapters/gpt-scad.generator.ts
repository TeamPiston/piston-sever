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
    return response.choices[0].message.content ?? '';
  }
}
