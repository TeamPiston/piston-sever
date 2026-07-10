import { Injectable, Logger } from '@nestjs/common';
import { MoonrakerAdapter } from '../infrastructure/moonraker.adapter';

/**
 * Moonraker를 통해 G-code 업로드 및 출력 시작을 담당하는 서비스.
 */
@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(private readonly moonraker: MoonrakerAdapter) {}

  /**
   * 지정한 경로의 G-code 파일을 Moonraker에 업로드한 뒤 해당 파일로 출력을 시작한다.
   */
  async print(gcodePath: string): Promise<void> {
    this.logger.log(`출력 준비: ${gcodePath}`);
    const fileName = await this.moonraker.uploadGcode(gcodePath);
    await this.moonraker.startPrint(fileName);
  }
}
