import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from '../files/files.module';
import { MeshyService } from './application/meshy.service';
import { MeshyApiClient } from './infrastructure/meshy-api.client';
import { MeshyController } from './meshy.controller';

@Module({
  imports: [ConfigModule, FilesModule],
  controllers: [MeshyController],
  providers: [MeshyApiClient, MeshyService],
  exports: [MeshyService],
})
export class MeshyModule {}
