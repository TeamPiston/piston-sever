import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrinterService } from './application/printer.service';
import { MoonrakerAdapter } from './infrastructure/moonraker.adapter';

@Module({
  imports: [ConfigModule],
  providers: [MoonrakerAdapter, PrinterService],
  exports: [PrinterService],
})
/**
 * 프린터 출력 기능(Moonraker 연동)을 구성하는 모듈.
 */
export class PrinterModule {}
