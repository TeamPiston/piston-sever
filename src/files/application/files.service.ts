import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';

@Injectable()
export class FilesService {
  constructor(private readonly configService: ConfigService) {}

  async resolveOutputDir(): Promise<string> {
    const outputDir = this.configService.get<string>('OUTPUT_DIR', './output');
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  }
}
