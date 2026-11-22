import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MeshyService } from '../application/meshy.service';
import {
  MESHY_GENERATION_QUEUE,
  MeshyGenerationJobData,
  MeshyGenerationResult,
} from './meshy-generation.queue';

/**
 * 이미 생성된 Meshy 작업의 완료를 기다려 STL을 업로드하고, 끝나면 사용자 잠금을 푼다.
 */
@Processor(MESHY_GENERATION_QUEUE)
export class MeshyGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(MeshyGenerationProcessor.name);

  constructor(private readonly meshyService: MeshyService) {
    super();
  }

  process(job: Job<MeshyGenerationJobData>): Promise<MeshyGenerationResult> {
    return this.meshyService.completeGeneration(job.data);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<MeshyGenerationJobData>): Promise<void> {
    await this.meshyService.releaseActiveLock(job.data.userId, job.id!);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<MeshyGenerationJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    // 재시도가 남아 있으면 아직 진행 중이므로 잠금을 유지한다.
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    this.logger.error(`[${job.id}] Meshy 생성 최종 실패: ${error.message}`);
    await this.meshyService.releaseActiveLock(job.data.userId, job.id!);
  }
}
