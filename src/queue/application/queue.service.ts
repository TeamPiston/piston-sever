import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { PrinterService } from '../../printer/application/printer.service';
import { PrintTask } from '../entities/print-task.entity';
import {
  PRINT_PIPELINE_QUEUE,
  PrintJobData,
} from '../infrastructure/print-job.processor';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(PRINT_PIPELINE_QUEUE) private readonly queue: Queue,
    @InjectRepository(PrintTask)
    private readonly printTasks: Repository<PrintTask>,
    private readonly printerService: PrinterService,
  ) {}

  async createPrintTask(
    userId: string,
    artworkName: string,
  ): Promise<PrintTask> {
    const printTask = await this.printTasks.save(
      this.printTasks.create({ userId, artworkName, status: 'PRINTING' }),
    );

    await this.queue.add(
      'print-job',
      {
        printTaskId: printTask.id,
        userId,
        prompt: artworkName,
        stage: 'generate',
      } satisfies PrintJobData,
      {
        jobId: String(printTask.id),
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );

    return printTask;
  }

  async getCurrentPrintTask(userId: string): Promise<PrintTask | null> {
    return this.printTasks.findOne({
      where: { userId, status: 'PRINTING' },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelPrintTask(userId: string, printTaskId: number): Promise<void> {
    const printTask = await this.printTasks.findOne({
      where: { id: printTaskId, userId },
    });
    if (!printTask) {
      throw new NotFoundException(
        `출력 작업 ${printTaskId}를 찾을 수 없습니다.`,
      );
    }
    if (printTask.status !== 'PRINTING') {
      return;
    }

    const job = await this.queue.getJob(String(printTaskId));
    if (job) {
      const state = await job.getState();
      if (state === 'waiting' || state === 'delayed') {
        await job.remove();
      } else if ((job.data as PrintJobData).stage === 'printing') {
        try {
          await this.printerService.cancel();
        } catch (error) {
          this.logger.warn(
            `프린터 취소 요청 실패: ${(error as Error).message}`,
          );
        }
      }
    }

    await this.printTasks.update(printTaskId, {
      status: 'CANCELLED',
      stoppedAt: new Date(),
    });
  }
}
