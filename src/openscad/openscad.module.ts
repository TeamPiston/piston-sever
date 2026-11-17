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
/**
 * OpenSCAD 코드 생성 기능을 구성하는 모듈.
 * SCAD_GENERATOR 환경변수 값에 따라 GPT 기반 생성기 또는 하드코딩된 생성기를 SCAD_GENERATOR_PORT로 주입한다.
 */
export class OpenscadModule {}
