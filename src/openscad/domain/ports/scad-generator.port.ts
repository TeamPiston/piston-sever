/** ScadGeneratorPort 구현체를 주입받기 위한 DI 토큰. */
export const SCAD_GENERATOR_PORT = 'SCAD_GENERATOR_PORT';

/**
 * 텍스트 프롬프트로부터 OpenSCAD 코드를 생성하는 포트(추상 인터페이스).
 */
export interface ScadGeneratorPort {
  /** 주어진 프롬프트를 바탕으로 OpenSCAD 소스 코드 문자열을 생성한다. */
  generate(prompt: string): Promise<string>;
}
