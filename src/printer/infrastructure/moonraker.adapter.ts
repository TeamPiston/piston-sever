import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Moonraker HTTP API와 통신해 G-code 업로드 및 출력 시작을 수행하는 어댑터.
 */
@Injectable()
export class MoonrakerAdapter {
  private readonly logger = new Logger(MoonrakerAdapter.name);
  private readonly moonrakerUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.moonrakerUrl = this.configService.get<string>('MOONRAKER_URL', '');
  }

  /**
   * G-code 파일을 Moonraker 서버에 업로드하고 업로드된 파일명을 반환한다.
   */
  async uploadGcode(gcodePath: string): Promise<string> {
    const fileName = path.basename(gcodePath);
    const formData = new FormData();
    formData.append('file', fs.createReadStream(gcodePath), fileName);
    await axios.post(
      `${this.getMoonrakerUrl()}/server/files/upload`,
      formData,
      { headers: formData.getHeaders() },
    );
    this.logger.log(`G-code 업로드 완료: ${fileName}`);
    return fileName;
  }

  /**
   * 업로드된 파일명을 지정해 Moonraker에 출력 시작을 요청한다.
   */
  async startPrint(fileName: string): Promise<void> {
    await axios.post(`${this.getMoonrakerUrl()}/printer/print/start`, {
      filename: fileName,
    });
    this.logger.log(`출력 시작: ${fileName}`);
  }

  private getMoonrakerUrl(): string {
    if (!this.moonrakerUrl) {
      throw new Error('MOONRAKER_URL이 설정되지 않았습니다.');
    }
    return this.moonrakerUrl;
  }
}
