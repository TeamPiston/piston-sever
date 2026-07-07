import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrinterService } from './application/printer.service';
import { MoonrakerAdapter } from './infrastructure/moonraker.adapter';

@Module({
  imports: [ConfigModule],
  providers: [MoonrakerAdapter, PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
