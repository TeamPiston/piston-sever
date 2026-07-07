export const SCAD_GENERATOR_PORT = 'SCAD_GENERATOR_PORT';

export interface ScadGeneratorPort {
  generate(prompt: string): Promise<string>;
}
