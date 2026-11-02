import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OpenscadModule } from '../openscad/openscad.module';
import { PrinterModule } from '../printer/printer.module';
import { SlicerModule } from '../slicer/slicer.module';
import { QueueService } from './application/queue.service';
import { PrintTask } from './entities/print-task.entity';
import {
  PRINT_PIPELINE_QUEUE,
  PrintJobProcessor,
} from './infrastructure/print-job.processor';
import { PrintTasksController } from './print-tasks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrintTask]),
    BullModule.registerQueue({
      name: PRINT_PIPELINE_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 60 * 60 * 24 * 7 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      },
    }),
    OpenscadModule,
    SlicerModule,
    PrinterModule,
  ],
  providers: [QueueService, PrintJobProcessor],
  controllers: [PrintTasksController],
})
export class QueueModule {}
