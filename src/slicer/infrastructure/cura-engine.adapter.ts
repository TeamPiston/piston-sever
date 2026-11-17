import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * CuraEngine CLI 바이너리를 자식 프로세스로 실행하여 슬라이싱을 수행하는 어댑터.
 */
@Injectable()
export class CuraEngineAdapter {
  private readonly logger = new Logger(CuraEngineAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * ConfigService에서 CuraEngine 바이너리 경로, 정의 파일 경로, 프로파일 경로를 읽어
   * `CuraEngine slice` 명령어를 구성하고 실행하여 stlPath를 gcodePath로 슬라이싱한다.
   */
  async slice(stlPath: string, gcodePath: string): Promise<void> {
    const curaBin = this.configService.get<string>(
      'CURA_BIN',
      '/usr/bin/CuraEngine',
    );
    const definitionsPath = this.configService.get<string>(
      'CURA_DEFINITIONS_PATH',
      '/usr/share/cura-engine/resources/definitions',
    );
    const profilePath = this.configService.get<string>(
      'CURA_PROFILE_PATH',
      path.resolve(__dirname, '../../profiles/qidi_max4.def.json'),
    );

    const cmd = [
      `"${curaBin}" slice`,
      `-j "${definitionsPath}/fdmprinter.def.json"`,
      `-j "${profilePath}"`,
      `-l "${stlPath}"`,
      `-o "${gcodePath}"`,
    ].join(' ');

    this.logger.log(`CuraEngine 실행: ${cmd}`);
    await execAsync(cmd);
  }
}
