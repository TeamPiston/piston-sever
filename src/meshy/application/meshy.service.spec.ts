import { ConflictException, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { FilesService } from '../../files/application/files.service';
import {
  MeshyApiClient,
  MeshyTaskResult,
} from '../infrastructure/meshy-api.client';
import {
  MeshyGenerationJobData,
  MeshyGenerationResult,
} from '../infrastructure/meshy-generation.queue';
import { MeshyService } from './meshy.service';

/** SET NX/EX, GET, 비교 후 삭제(eval)만 흉내 내는 인메모리 Redis. */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    store,
    set: jest.fn((key: string, value: string, ...args: string[]) => {
      if (args.includes('NX') && store.has(key)) return Promise.resolve(null);
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    eval: jest.fn((_script: string, _n: number, key: string, value: string) => {
      if (store.get(key) !== value) return Promise.resolve(0);
      store.delete(key);
      return Promise.resolve(1);
    }),
  };
}

describe('MeshyService', () => {
  let redis: ReturnType<typeof fakeRedis>;
  let queue: { client: Promise<unknown>; add: jest.Mock; getJob: jest.Mock };
  let meshy: {
    createTextTo3DTask: jest.Mock;
    getTextTo3DTask: jest.Mock;
    downloadModel: jest.Mock;
  };
  let files: { uploadBuffer: jest.Mock };
  let service: MeshyService;

  beforeEach(() => {
    redis = fakeRedis();
    queue = {
      client: Promise.resolve(redis),
      add: jest.fn(() => Promise.resolve()),
      getJob: jest.fn(),
    };
    meshy = {
      createTextTo3DTask: jest.fn(() => Promise.resolve('task-1')),
      getTextTo3DTask: jest.fn(),
      downloadModel: jest.fn(() => Promise.resolve(Buffer.from('stl'))),
    };
    files = {
      uploadBuffer: jest.fn(() => Promise.resolve('http://minio/model.stl')),
    };
    service = new MeshyService(
      meshy as unknown as MeshyApiClient,
      files as unknown as FilesService,
      queue as unknown as Queue<MeshyGenerationJobData, MeshyGenerationResult>,
    );
  });

  it('Meshy 작업을 한 번 만들고 폴링 작업을 큐에 넣은 뒤 taskId를 돌려준다', async () => {
    await expect(service.startFromText('u1', 'cube')).resolves.toEqual({
      taskId: 'task-1',
    });
    expect(meshy.createTextTo3DTask).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      'generate',
      { userId: 'u1', kind: 'text', meshyTaskId: 'task-1' },
      expect.objectContaining({ jobId: 'task-1' }),
    );
    expect(redis.store.get('meshy-active:u1')).toBe('task-1');
  });

  it('진행 중인 생성이 있으면 Meshy를 다시 호출하지 않고 409와 기존 taskId를 준다', async () => {
    await service.startFromText('u1', 'cube');
    const error = await service
      .startFromText('u1', 'another')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      taskId: 'task-1',
    });
    expect(meshy.createTextTo3DTask).toHaveBeenCalledTimes(1);
    // 다른 사용자는 영향을 받지 않는다.
    await expect(service.startFromText('u2', 'cube')).resolves.toBeDefined();
  });

  it('Meshy 작업 생성이 실패하면 잠금을 풀어 다시 시도할 수 있다', async () => {
    meshy.createTextTo3DTask.mockRejectedValueOnce(new Error('no key'));
    await expect(service.startFromText('u1', 'cube')).rejects.toThrow('no key');
    expect(redis.store.has('meshy-active:u1')).toBe(false);
    expect(queue.add).not.toHaveBeenCalled();

    await expect(service.startFromText('u1', 'cube')).resolves.toEqual({
      taskId: 'task-1',
    });
  });

  it('잠금은 해당 생성의 taskId일 때만 풀린다', async () => {
    await service.startFromText('u1', 'cube');
    await service.releaseActiveLock('u1', 'other-task');
    expect(redis.store.get('meshy-active:u1')).toBe('task-1');
    await service.releaseActiveLock('u1', 'task-1');
    expect(redis.store.has('meshy-active:u1')).toBe(false);
  });

  it('작업 상태: 남의 작업은 404, 완료·실패·진행 중을 구분한다', async () => {
    const job = (state: string, extra: object = {}) => ({
      data: { userId: 'u1' },
      getState: () => Promise.resolve(state),
      ...extra,
    });

    queue.getJob.mockResolvedValueOnce(null);
    await expect(service.getTask('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    queue.getJob.mockResolvedValueOnce(job('completed'));
    await expect(service.getTask('u2', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    queue.getJob.mockResolvedValueOnce(
      job('completed', { returnvalue: { modelUrl: 'http://m.stl' } }),
    );
    await expect(service.getTask('u1', 'x')).resolves.toEqual({
      taskId: 'x',
      status: 'SUCCEEDED',
      modelUrl: 'http://m.stl',
    });
    queue.getJob.mockResolvedValueOnce(job('failed', { failedReason: 'bad' }));
    await expect(service.getTask('u1', 'x')).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: 'bad',
    });
    queue.getJob.mockResolvedValueOnce(job('delayed'));
    await expect(service.getTask('u1', 'x')).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('워커는 완료될 때까지 폴링한 뒤 STL을 사용자 경로에 업로드한다', async () => {
    jest
      .spyOn(service as unknown as { sleep: () => Promise<void> }, 'sleep')
      .mockResolvedValue();
    const pending: MeshyTaskResult = { status: 'IN_PROGRESS', progress: 50 };
    const done: MeshyTaskResult = {
      status: 'SUCCEEDED',
      progress: 100,
      modelUrls: { stl: 'https://meshy/x.stl' },
    };
    meshy.getTextTo3DTask
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(done);

    await expect(
      service.completeGeneration({
        userId: 'u1',
        kind: 'text',
        meshyTaskId: 'task-1',
      }),
    ).resolves.toEqual({ modelUrl: 'http://minio/model.stl' });
    expect(meshy.getTextTo3DTask).toHaveBeenCalledTimes(2);
    expect(files.uploadBuffer).toHaveBeenCalledWith(
      'meshy/u1/task-1.stl',
      expect.any(Buffer),
      'model/stl',
    );
  });
});
