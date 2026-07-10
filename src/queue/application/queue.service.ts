import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  PRINT_PIPELINE_QUEUE,
  PrintJobData,
} from '../infrastructure/print-job.processor';

/**
 * BullMQ 출력 파이프라인 큐에 작업을 등록하고 작업 상태를 조회하는 서비스.
 */
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(PRINT_PIPELINE_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * 고유 jobId를 발급해 'generate' 단계의 출력 파이프라인 작업을 큐에 등록하고 jobId를 반환한다.
   */
  async addJob(prompt: string): Promise<string> {
    const jobId = randomUUID();
    await this.queue.add(
      'print-job',
      { jobId, prompt, stage: 'generate' } satisfies PrintJobData,
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );
    return jobId;
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
}
