import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { SCAD_GENERATOR_PORT } from '../domain/ports/scad-generator.port';
import type { ScadGeneratorPort } from '../domain/ports/scad-generator.port';

const execAsync = promisify(exec);

@Injectable()
export class OpenscadService {
  private readonly logger = new Logger(OpenscadService.name);

  constructor(
    @Inject(SCAD_GENERATOR_PORT) private readonly generator: ScadGeneratorPort,
    private readonly configService: ConfigService,
  ) {}

  async generateScad(prompt: string, jobId: string): Promise<string> {
    const scadContent = await this.generator.generate(prompt);
    const outputDir = this.configService.get<string>('OUTPUT_DIR', './output');
    await fs.mkdir(outputDir, { recursive: true });
    const scadPath = path.join(outputDir, `${jobId}.scad`);
    await fs.writeFile(scadPath, scadContent, 'utf-8');
    this.logger.log(`SCAD 파일 생성: ${scadPath}`);
    return scadPath;
  }

  async convertToStl(scadPath: string, jobId: string): Promise<string> {
    const outputDir = this.configService.get<string>('OUTPUT_DIR', './output');
    const stlPath = path.join(outputDir, `${jobId}.stl`);
    const openscadBin = this.configService.get<string>(
      'OPENSCAD_BIN',
      '/usr/bin/openscad',
    );
    const cmd = `"${openscadBin}" -o "${stlPath}" "${scadPath}"`;
    this.logger.log(`OpenSCAD 실행: ${cmd}`);
    await execAsync(cmd);
    this.logger.log(`STL 변환 완료: ${stlPath}`);
    return stlPath;
  }
}
