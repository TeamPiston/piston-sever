import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CuraEngineAdapter } from '../infrastructure/cura-engine.adapter';

@Injectable()
export class SlicerService {
  private readonly logger = new Logger(SlicerService.name);

  constructor(
    private readonly curaEngine: CuraEngineAdapter,
    private readonly configService: ConfigService,
  ) {}

  async slice(stlPath: string, jobId: string): Promise<string> {
    const outputDir = this.configService.get<string>('OUTPUT_DIR', './output');
    await fs.mkdir(outputDir, { recursive: true });
    const gcodePath = path.join(outputDir, `${jobId}.gcode`);
    this.logger.log(`슬라이싱 시작: ${stlPath} → ${gcodePath}`);
    await this.curaEngine.slice(stlPath, gcodePath);
    this.logger.log(`슬라이싱 완료: ${gcodePath}`);
    return gcodePath;
  }
}
