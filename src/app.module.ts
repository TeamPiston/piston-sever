import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
