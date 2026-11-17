import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { Client } from 'minio';
import { MINIO_CLIENT } from '../infrastructure/minio-client.provider';

/**
 * 파일 출력 경로 및 MinIO 오브젝트 스토리지 업로드 관련 공통 기능을 제공하는 서비스.
 */
@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(MINIO_CLIENT) private readonly minioClient: Client,
  ) {}

  /**
   * 앱 부팅 시 설정된 버킷(MINIO_BUCKET)이 없으면 생성한다(로컬/개발 편의용).
   */
  async onModuleInit(): Promise<void> {
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'piston-files',
    );
    const exists = await this.minioClient.bucketExists(bucket);
    if (!exists) {
      await this.minioClient.makeBucket(bucket);
      this.logger.log(`MinIO 버킷 생성: ${bucket}`);
    }
  }

  /**
   * 설정된 출력 디렉터리(OUTPUT_DIR, 기본값 './output')를 조회하고,
   * 존재하지 않으면 재귀적으로 생성한 뒤 경로를 반환한다.
   */
  async resolveOutputDir(): Promise<string> {
    const outputDir = this.configService.get<string>('OUTPUT_DIR', './output');
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  }

  /**
   * 버퍼 데이터를 MinIO의 지정된 key로 업로드하고 공개 접근 URL을 반환한다.
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'piston-files',
    );
    await this.minioClient.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return this.buildPublicUrl(bucket, key);
  }

  /**
   * 로컬 디스크의 파일을 MinIO의 지정된 key로 업로드하고 공개 접근 URL을 반환한다.
   */
  async uploadFile(key: string, filePath: string): Promise<string> {
    const bucket = this.configService.get<string>(
      'MINIO_BUCKET',
      'piston-files',
    );
    await this.minioClient.fPutObject(bucket, key, filePath);
    return this.buildPublicUrl(bucket, key);
  }

  private buildPublicUrl(bucket: string, key: string): string {
    const publicUrl = this.configService.get<string>(
      'MINIO_PUBLIC_URL',
      'http://localhost:9000',
    );
    return `${publicUrl}/${bucket}/${key}`;
  }
}
