import { ScadGeneratorPort } from '../../domain/ports/scad-generator.port';

export class HardcodedScadGenerator implements ScadGeneratorPort {
  async generate(prompt: string): Promise<string> {
    return `// prompt: ${prompt}\ncube([20, 20, 20]);`;
  }
}
