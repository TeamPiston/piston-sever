import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { PrinterService } from '../../printer/application/printer.service';
import { PrintTask } from '../entities/print-task.entity';
import {
  PRINT_PIPELINE_QUEUE,
  PrintJobData,
} from '../infrastructure/print-job.processor';

/**
 * BullMQ 출력 파이프라인 큐에 작업을 등록하고, PrintTask(DB)와 작업 상태를
 * 동기화하여 조회/취소를 제공하는 서비스.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(PRINT_PIPELINE_QUEUE) private readonly queue: Queue,
    @InjectRepository(PrintTask)
    private readonly printTasks: Repository<PrintTask>,
    private readonly printerService: PrinterService,
  ) {}

  /**
   * PrintTask 행을 생성하고, 고유 jobId로 'generate' 단계의 출력 파이프라인
   * 작업을 큐에 등록한다. jobId는 채팅 등 기존 소비자와의 호환을 위해 별도로 반환한다.
   */
  async createPrintTask(
    userId: string,
    artworkName: string,
  ): Promise<{ printTask: PrintTask; jobId: string }> {
    const jobId = randomUUID();
    const printTask = await this.printTasks.save(
      this.printTasks.create({
        userId,
        artworkName,
        jobId,
        status: 'PRINTING',
      }),
    );

    await this.queue.add(
      'print-job',
      {
        printTaskId: printTask.id,
        userId,
        prompt: artworkName,
        stage: 'generate',
      } satisfies PrintJobData,
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );

    return { printTask, jobId };
  }

  /**
   * jobId로 큐 작업을 조회해 현재 상태와 진행 단계, 실패 사유를 반환한다.
   * 작업이 존재하지 않으면 NotFoundException을 던진다.
   */
  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId}를 찾을 수 없습니다.`);
    const status = await job.getState();
    return {
      jobId,
      status,
      stage: (job.data as PrintJobData).stage ?? 'generate',
      failedReason: job.failedReason ?? null,
    };
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

    const job = printTask.jobId
      ? await this.queue.getJob(printTask.jobId)
      : null;
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
