import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { FilesService } from '../../files/application/files.service';
import { CuraEngineAdapter } from '../infrastructure/cura-engine.adapter';

@Injectable()
export class SlicerService {
  private readonly logger = new Logger(SlicerService.name);

  constructor(
    private readonly curaEngine: CuraEngineAdapter,
    private readonly filesService: FilesService,
  ) {}

  async slice(stlPath: string, jobId: string): Promise<string> {
    const outputDir = await this.filesService.resolveOutputDir();
    const gcodePath = path.join(outputDir, `${jobId}.gcode`);
    this.logger.log(`슬라이싱 시작: ${stlPath} → ${gcodePath}`);
    await this.curaEngine.slice(stlPath, gcodePath);
    this.logger.log(`슬라이싱 완료: ${gcodePath}`);
    return gcodePath;
  }
}
