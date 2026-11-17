import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import { FilesService } from '../../files/application/files.service';
import {
  MeshyApiClient,
  MeshyTaskResult,
} from '../infrastructure/meshy-api.client';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

@Injectable()
export class MeshyService {
  private readonly logger = new Logger(MeshyService.name);

  constructor(
    private readonly meshyApiClient: MeshyApiClient,
    private readonly filesService: FilesService,
  ) {}

  async generateFromText(
    userId: string,
    prompt: string,
  ): Promise<{ modelUrl: string }> {
    const taskId = await this.meshyApiClient.createTextTo3DTask(prompt);
    this.logger.log(`Text-to-3D 작업 생성: ${taskId}`);
    const task = await this.pollTask(() =>
      this.meshyApiClient.getTextTo3DTask(taskId),
    );
    return this.uploadResult(userId, taskId, task);
  }

  async generateFromImage(
    userId: string,
    image: Buffer,
    mimeType: string,
  ): Promise<{ modelUrl: string }> {
    const imageUrl = `data:${mimeType};base64,${image.toString('base64')}`;
    const taskId = await this.meshyApiClient.createImageTo3DTask(imageUrl);
    this.logger.log(`Image-to-3D 작업 생성: ${taskId}`);
    const task = await this.pollTask(() =>
      this.meshyApiClient.getImageTo3DTask(taskId),
    );
    return this.uploadResult(userId, taskId, task);
  }

  private async uploadResult(
    userId: string,
    taskId: string,
    task: MeshyTaskResult,
  ): Promise<{ modelUrl: string }> {
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
