import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

/** MinIO 클라이언트 인스턴스를 주입받기 위한 DI 토큰. */
export const MINIO_CLIENT = 'MINIO_CLIENT';

/**
 * MINIO_ENDPOINT(예: 'http://minio:9000') 설정값을 파싱해 MinIO Client를 생성하는 팩토리 프로바이더.
 */
export const minioClientProvider = {
  provide: MINIO_CLIENT,
  useFactory: (configService: ConfigService): Client => {
    const endpoint = configService.get<string>(
      'MINIO_ENDPOINT',
      'http://localhost:9000',
    );
    const url = new URL(endpoint);
    return new Client({
      endPoint: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      useSSL: url.protocol === 'https:',
      accessKey: configService.get<string>('MINIO_USER'),
      secretKey: configService.get<string>('MINIO_PASSWORD'),
    });
  },
  inject: [ConfigService],
};
