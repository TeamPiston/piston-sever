import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { FilesService } from '../../files/application/files.service';
import {
  MeshyApiClient,
  MeshyTaskResult,
} from '../infrastructure/meshy-api.client';
import {
  MESHY_GENERATION_QUEUE,
  MeshyGenerationJobData,
  MeshyGenerationResult,
} from '../infrastructure/meshy-generation.queue';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;
/** 시도 3회 × 폴링 최대 10분 + 여유. 워커가 죽어도 이 시간이 지나면 잠금이 풀린다. */
const ACTIVE_LOCK_TTL_SECONDS = 35 * 60;
const PENDING_PREFIX = 'pending:';

/** 값이 일치할 때만 잠금을 지운다(다른 생성의 잠금을 지우지 않도록). */
const RELEASE_IF_MATCHES = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`;

export type MeshyGenerationStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface MeshyGenerationTaskResponse {
  taskId: string;
  status: MeshyGenerationStatus;
  modelUrl?: string;
  failureReason?: string;
}

function activeKey(userId: string): string {
  return `meshy-active:${userId}`;
}

/**
 * Meshy 3D 생성을 비동기로 처리한다. 요청 안에서는 Meshy 작업 생성(과금 시점)만 하고,
 * 폴링과 STL 업로드는 BullMQ 작업에서 처리한다. 사용자당 진행 중인 생성은 1개로 제한해
 * 중복 요청으로 유료 작업이 여러 번 만들어지지 않게 한다.
 */
@Injectable()
export class MeshyService {
  private readonly logger = new Logger(MeshyService.name);

  constructor(
    private readonly meshyApiClient: MeshyApiClient,
    private readonly filesService: FilesService,
    @InjectQueue(MESHY_GENERATION_QUEUE)
    private readonly queue: Queue<
      MeshyGenerationJobData,
      MeshyGenerationResult
    >,
  ) {}

  startFromText(userId: string, prompt: string): Promise<{ taskId: string }> {
    return this.start(userId, 'text', () =>
      this.meshyApiClient.createTextTo3DTask(prompt),
    );
  }

  startFromImage(
    userId: string,
    image: Buffer,
    mimeType: string,
  ): Promise<{ taskId: string }> {
    const imageUrl = `data:${mimeType};base64,${image.toString('base64')}`;
    return this.start(userId, 'image', () =>
      this.meshyApiClient.createImageTo3DTask(imageUrl),
    );
  }

  /**
   * 본인 생성 작업의 상태를 조회한다. 없거나 남의 작업이면 404.
   */
  async getTask(
    userId: string,
    taskId: string,
  ): Promise<MeshyGenerationTaskResponse> {
    const job = await this.queue.getJob(taskId);
    if (!job || job.data.userId !== userId) {
      throw new NotFoundException('생성 작업을 찾을 수 없습니다.');
    }
    const state = await job.getState();
    if (state === 'completed') {
      return {
        taskId,
        status: 'SUCCEEDED',
        modelUrl: job.returnvalue.modelUrl,
      };
    }
    if (state === 'failed') {
      return { taskId, status: 'FAILED', failureReason: job.failedReason };
    }
    return { taskId, status: 'PENDING' };
  }

  /**
   * (워커) Meshy 작업이 끝날 때까지 폴링하고 결과 STL을 MinIO에 올린다.
   */
  async completeGeneration(
    data: MeshyGenerationJobData,
  ): Promise<MeshyGenerationResult> {
    const fetchTask =
      data.kind === 'text'
        ? () => this.meshyApiClient.getTextTo3DTask(data.meshyTaskId)
        : () => this.meshyApiClient.getImageTo3DTask(data.meshyTaskId);
    const task = await this.pollTask(fetchTask);
    return this.uploadResult(data.userId, data.meshyTaskId, task);
  }

  /** (워커) 생성이 끝나거나 최종 실패하면 그 생성이 잡고 있던 잠금을 푼다. */
  async releaseActiveLock(userId: string, taskId: string): Promise<void> {
    const redis = await this.redis();
    await redis.eval(RELEASE_IF_MATCHES, 1, activeKey(userId), taskId);
  }

  private async start(
    userId: string,
    kind: MeshyGenerationJobData['kind'],
    createMeshyTask: () => Promise<string>,
  ): Promise<{ taskId: string }> {
    const redis = await this.redis();
    const key = activeKey(userId);
    const marker = `${PENDING_PREFIX}${randomUUID()}`;
    const acquired = await redis.set(
      key,
      marker,
      'EX',
      ACTIVE_LOCK_TTL_SECONDS,
      'NX',
    );
    if (!acquired) {
      const current = await redis.get(key);
      throw new ConflictException({
        statusCode: 409,
        message: '이미 진행 중인 3D 생성이 있습니다.',
        taskId: current && !current.startsWith(PENDING_PREFIX) ? current : null,
      });
    }

    let meshyTaskId: string;
    try {
      meshyTaskId = await createMeshyTask();
    } catch (error) {
      await redis.eval(RELEASE_IF_MATCHES, 1, key, marker);
      throw error;
    }
    this.logger.log(`Meshy ${kind} 작업 생성: ${meshyTaskId}`);

    await redis.set(key, meshyTaskId, 'EX', ACTIVE_LOCK_TTL_SECONDS);
    // 과금은 위에서 끝났으므로, 재시도는 폴링만 다시 해서 이중 과금이 없다.
    await this.queue.add(
      'generate',
      { userId, kind, meshyTaskId },
      {
        jobId: meshyTaskId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    return { taskId: meshyTaskId };
  }

  /** 큐의 Redis 연결을 재사용한다(BullMQ 내장 ioredis 타입을 프로젝트 타입으로 맞춤). */
  private async redis(): Promise<Redis> {
    return (await this.queue.client) as unknown as Redis;
  }

  private async uploadResult(
    userId: string,
    taskId: string,
    task: MeshyTaskResult,
  ): Promise<MeshyGenerationResult> {
    const stlUrl = task.modelUrls?.stl;
    if (!stlUrl) {
      throw new InternalServerErrorException(
        'Meshy 작업 결과에 STL 파일이 없습니다.',
      );
    }
    const stlBuffer = await this.meshyApiClient.downloadModel(stlUrl);
    const modelUrl = await this.filesService.uploadBuffer(
      `meshy/${userId}/${taskId}.stl`,
      stlBuffer,
      'model/stl',
    );
    this.logger.log(`Meshy STL 업로드 완료: ${modelUrl}`);
    return { modelUrl };
  }

  private async pollTask(
    fetchTask: () => Promise<MeshyTaskResult>,
  ): Promise<MeshyTaskResult> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const task = await fetchTask();
      if (task.status === 'SUCCEEDED') {
        return task;
      }
      if (task.status === 'FAILED' || task.status === 'EXPIRED') {
        throw new BadRequestException(
          task.taskError ?? `Meshy 작업이 실패했습니다: ${task.status}`,
        );
      }
      await this.sleep(POLL_INTERVAL_MS);
    }
    throw new RequestTimeoutException(
      'Meshy 3D 모델 생성이 10분 내에 완료되지 않았습니다.',
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
