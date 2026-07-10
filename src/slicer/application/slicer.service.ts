import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { FilesService } from '../../files/application/files.service';
import { CuraEngineAdapter } from '../infrastructure/cura-engine.adapter';

/**
 * STL 파일을 CuraEngine을 통해 G-code로 슬라이싱하는 서비스.
 */
@Injectable()
export class SlicerService {
  private readonly logger = new Logger(SlicerService.name);

  constructor(
    private readonly curaEngine: CuraEngineAdapter,
    private readonly filesService: FilesService,
  ) {}

  /**
   * 주어진 STL 파일을 슬라이싱하여 jobId 기준 파일명의 G-code를 출력 디렉터리에 생성하고,
   * 생성된 G-code 파일 경로를 반환한다.
   */
  async slice(stlPath: string, jobId: string): Promise<string> {
    const outputDir = await this.filesService.resolveOutputDir();
    const gcodePath = path.join(outputDir, `${jobId}.gcode`);
    this.logger.log(`슬라이싱 시작: ${stlPath} → ${gcodePath}`);
    await this.curaEngine.slice(stlPath, gcodePath);
    this.logger.log(`슬라이싱 완료: ${gcodePath}`);
    return gcodePath;
  }
}
