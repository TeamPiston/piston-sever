import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type MeshyTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED';

export interface MeshyModelUrls {
  stl?: string;
  glb?: string;
  fbx?: string;
  obj?: string;
  usdz?: string;
}

export interface MeshyTaskResult {
  status: MeshyTaskStatus;
  progress: number;
  modelUrls?: MeshyModelUrls;
  taskError?: string;
}

interface RawMeshyTask {
  status: MeshyTaskStatus;
  progress: number;
  model_urls?: MeshyModelUrls;
  task_error?: { message?: string };
}

const MESHY_BASE_URL = 'https://api.meshy.ai';

@Injectable()
export class MeshyApiClient {
  constructor(private readonly configService: ConfigService) {}

  async createTextTo3DTask(prompt: string): Promise<string> {
    const response = await axios.post<{ result: string }>(
      `${MESHY_BASE_URL}/openapi/v2/text-to-3d`,
      { mode: 'preview', prompt },
      { headers: this.authHeaders() },
    );
    return response.data.result;
  }

  async getTextTo3DTask(taskId: string): Promise<MeshyTaskResult> {
    const response = await axios.get<RawMeshyTask>(
      `${MESHY_BASE_URL}/openapi/v2/text-to-3d/${taskId}`,
      { headers: this.authHeaders() },
    );
    return this.toTaskResult(response.data);
  }

  async createImageTo3DTask(imageUrl: string): Promise<string> {
    const response = await axios.post<{ result: string }>(
      `${MESHY_BASE_URL}/openapi/v1/image-to-3d`,
      { image_url: imageUrl },
      { headers: this.authHeaders() },
    );
    return response.data.result;
  }

  async getImageTo3DTask(taskId: string): Promise<MeshyTaskResult> {
    const response = await axios.get<RawMeshyTask>(
      `${MESHY_BASE_URL}/openapi/v1/image-to-3d/${taskId}`,
      { headers: this.authHeaders() },
    );
    return this.toTaskResult(response.data);
  }

  async downloadModel(url: string): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  private toTaskResult(raw: RawMeshyTask): MeshyTaskResult {
    return {
      status: raw.status,
      progress: raw.progress,
      modelUrls: raw.model_urls,
      taskError: raw.task_error?.message,
    };
  }

  private authHeaders(): Record<string, string> {
    const apiKey = this.configService.get<string>('MESHY_API_KEY', '');
    if (!apiKey) {
      throw new Error('MESHY_API_KEY가 설정되지 않았습니다.');
    }
    return { Authorization: `Bearer ${apiKey}` };
  }
}
