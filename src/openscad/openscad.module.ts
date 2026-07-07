import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { FilesModule } from '../files/files.module';
import { OpenscadService } from './application/openscad.service';
import { SCAD_GENERATOR_PORT } from './domain/ports/scad-generator.port';
import { GptScadGenerator } from './infrastructure/adapters/gpt-scad.generator';
import { HardcodedScadGenerator } from './infrastructure/adapters/hardcoded-scad.generator';
import { OPENAI_CLIENT } from '../openai/openai.provider';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [ConfigModule, OpenaiModule, FilesModule],
  providers: [
    {
      provide: SCAD_GENERATOR_PORT,
      useFactory: (configService: ConfigService, openai: OpenAI | null) => {
        if (configService.get('SCAD_GENERATOR') !== 'gpt') {
          return new HardcodedScadGenerator();
        }
        if (!openai) {
          throw new Error(
            'SCAD_GENERATOR=gpt를 사용하려면 OPENAI_API_KEY를 설정해야 합니다.',
          );
        }
        return new GptScadGenerator(openai);
      },
      inject: [ConfigService, OPENAI_CLIENT],
    },
    OpenscadService,
  ],
  exports: [OpenscadService],
})
export class OpenscadModule {}
