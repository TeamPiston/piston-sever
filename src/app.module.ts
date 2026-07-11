import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { UserModule } from './user/user.module';
import { OpenaiModule } from './openai/openai.module';
import { OpenscadModule } from './openscad/openscad.module';
import { PrinterModule } from './printer/printer.module';
import { QueueModule } from './queue/queue.module';
import { SlicerModule } from './slicer/slicer.module';
import { FilesModule } from './files/files.module';
import { MeshyModule } from './meshy/meshy.module';
import { ThreeDModule } from './3d/3d.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    /** Redis 연결 설정을 위한 BullMQ 큐 모듈 (환경변수 기반 비동기 구성). */
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    /** PostgreSQL 연결을 위한 TypeORM 비동기 구성. */
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    OpenaiModule,
    OpenscadModule,
    SlicerModule,
    PrinterModule,
    QueueModule,
    FilesModule,
    MeshyModule,
    ThreeDModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
/**
 * 애플리케이션 루트 모듈.
 *
 * 전역 설정(ConfigModule), 큐(BullModule), 데이터베이스(TypeOrmModule) 연결을
 * 구성하고, 각 도메인 모듈을 애플리케이션에 결합한다.
 */
export class AppModule {}
