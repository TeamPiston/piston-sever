import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterService } from './application/printer.service';
import { Printer } from './entities/printer.entity';
import { PrinterAdapterFactory } from './infrastructure/printer-adapter.factory';
import { PrinterController } from './printer.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Printer])],
  controllers: [PrinterController],
  providers: [PrinterAdapterFactory, PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
