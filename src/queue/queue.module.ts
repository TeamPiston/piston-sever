import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OpenscadModule } from '../openscad/openscad.module';
import { PrinterModule } from '../printer/printer.module';
import { SlicerModule } from '../slicer/slicer.module';
import { QueueService } from './application/queue.service';
import { GenerateRequestDto } from './dto/generate-request.dto';
import { PRINT_PIPELINE_QUEUE } from './infrastructure/print-job.processor';
import { PrintJobProcessor } from './infrastructure/print-job.processor';
import { QueueController } from './queue.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: PRINT_PIPELINE_QUEUE }),
    OpenscadModule,
    SlicerModule,
    PrinterModule,
  ],
  providers: [QueueService, PrintJobProcessor],
  controllers: [QueueController],
})
export class QueueModule {}
