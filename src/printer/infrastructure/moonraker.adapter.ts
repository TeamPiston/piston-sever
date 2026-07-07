import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class MoonrakerAdapter {
  private readonly logger = new Logger(MoonrakerAdapter.name);
  private readonly moonrakerUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.moonrakerUrl = this.configService.getOrThrow<string>('MOONRAKER_URL');
  }

  async uploadGcode(gcodePath: string): Promise<string> {
    const fileName = path.basename(gcodePath);
    const fileBuffer = await fs.readFile(gcodePath);
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([fileBuffer], { type: 'application/octet-stream' }),
      fileName,
    );
    await axios.post(`${this.moonrakerUrl}/server/files/upload`, formData);
    this.logger.log(`G-code 업로드 완료: ${fileName}`);
    return fileName;
  }

  async startPrint(fileName: string): Promise<void> {
    await axios.post(`${this.moonrakerUrl}/printer/print/start`, {
      filename: fileName,
    });
    this.logger.log(`출력 시작: ${fileName}`);
  }
}
