import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class CuraEngineAdapter {
  private readonly logger = new Logger(CuraEngineAdapter.name);

  constructor(private readonly configService: ConfigService) {}

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
