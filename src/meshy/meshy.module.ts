import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from '../files/files.module';
import { MeshyService } from './application/meshy.service';
import { MeshyApiClient } from './infrastructure/meshy-api.client';
import { MeshyGenerationProcessor } from './infrastructure/meshy-generation.processor';
import { MESHY_GENERATION_QUEUE } from './infrastructure/meshy-generation.queue';
import { MeshyController } from './meshy.controller';

@Module({
  imports: [
    ConfigModule,
    FilesModule,
    BullModule.registerQueue({
      name: MESHY_GENERATION_QUEUE,
      // 상태 조회(GET /meshy/tasks/:taskId)를 위해 결과를 하루 보관한다.
      defaultJobOptions: {
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail: { age: 60 * 60 * 24 },
      },
    }),
  ],
  controllers: [MeshyController],
  providers: [MeshyApiClient, MeshyService, MeshyGenerationProcessor],
  exports: [MeshyService],
})
export class MeshyModule {}
