import { Module } from '@nestjs/common';
import { FilesService } from './application/files.service';
import { minioClientProvider } from './infrastructure/minio-client.provider';

/**
 * FilesService를 제공하고 다른 모듈에서 사용할 수 있도록 내보내는 모듈.
 */
@Module({
  providers: [minioClientProvider, FilesService],
  exports: [FilesService],
})
export class FilesModule {}
