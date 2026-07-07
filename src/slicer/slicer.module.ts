import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from '../files/files.module';
import { SlicerService } from './application/slicer.service';
import { CuraEngineAdapter } from './infrastructure/cura-engine.adapter';

@Module({
  imports: [ConfigModule, FilesModule],
  providers: [CuraEngineAdapter, SlicerService],
  exports: [SlicerService],
})
export class SlicerModule {}
