import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import {
  PRINT_PIPELINE_QUEUE,
  PrintJobData,
} from '../infrastructure/print-job.processor';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(PRINT_PIPELINE_QUEUE) private readonly queue: Queue,
  ) {}

  async addJob(prompt: string): Promise<string> {
    const jobId = randomUUID();
    await this.queue.add(
      'print-job',
      { jobId, prompt, stage: 'generate' } satisfies PrintJobData,
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );
    return jobId;
  }

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
