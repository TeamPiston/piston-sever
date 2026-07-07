import { Injectable, Logger } from '@nestjs/common';
import { MoonrakerAdapter } from '../infrastructure/moonraker.adapter';

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(private readonly moonraker: MoonrakerAdapter) {}

  async print(gcodePath: string): Promise<void> {
    this.logger.log(`출력 준비: ${gcodePath}`);
    const fileName = await this.moonraker.uploadGcode(gcodePath);
    await this.moonraker.startPrint(fileName);
  }
}
