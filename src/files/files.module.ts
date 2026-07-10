import { Module } from '@nestjs/common';
import { FilesService } from './application/files.service';

/**
 * FilesService를 제공하고 다른 모듈에서 사용할 수 있도록 내보내는 모듈.
 */
@Module({
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
