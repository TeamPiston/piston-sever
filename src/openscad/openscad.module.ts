import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { OpenscadService } from './application/openscad.service';
import { SCAD_GENERATOR_PORT } from './domain/ports/scad-generator.port';
import { GptScadGenerator } from './infrastructure/adapters/gpt-scad.generator';
import { HardcodedScadGenerator } from './infrastructure/adapters/hardcoded-scad.generator';
import { OPENAI_CLIENT } from '../openai/openai.provider';
import { OpenaiModule } from '../openai/openai.module';

@Module({
  imports: [ConfigModule, OpenaiModule],
  providers: [
    {
      provide: SCAD_GENERATOR_PORT,
      useFactory: (configService: ConfigService, openai: OpenAI) => {
        return configService.get('SCAD_GENERATOR') === 'gpt'
          ? new GptScadGenerator(openai)
          : new HardcodedScadGenerator();
      },
      inject: [ConfigService, OPENAI_CLIENT],
    },
    OpenscadService,
  ],
  exports: [OpenscadService],
})
export class OpenscadModule {}
