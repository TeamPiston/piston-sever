import { ScadGeneratorPort } from '../../domain/ports/scad-generator.port';

/**
 * 실제 생성 로직 없이 고정된 SCAD 코드를 반환하는 개발/테스트용 생성기 어댑터.
 */
export class HardcodedScadGenerator implements ScadGeneratorPort {
  /**
   * 프롬프트 내용과 무관하게 20x20x20 큐브를 그리는 고정 SCAD 코드를 반환한다.
   */
  async generate(prompt: string): Promise<string> {
    return `// prompt: ${prompt}\ncube([20, 20, 20]);`;
  }
}
