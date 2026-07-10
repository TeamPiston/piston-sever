import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';

/**
 * 파일 출력 경로 관련 공통 기능을 제공하는 서비스.
 */
@Injectable()
export class FilesService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 설정된 출력 디렉터리(OUTPUT_DIR, 기본값 './output')를 조회하고,
   * 존재하지 않으면 재귀적으로 생성한 뒤 경로를 반환한다.
   */
  async resolveOutputDir(): Promise<string> {
    const outputDir = this.configService.get<string>('OUTPUT_DIR', './output');
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  }
}
