import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * NestJS 애플리케이션을 부트스트랩한다.
 * 전역 ValidationPipe(whitelist, transform)를 등록하고 PORT 환경변수(기본 3000)로 서버를 실행한다.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // shortcut: CORS_ORIGIN 미설정 시 전체 허용('*'). 쿠키 대신 Bearer 토큰만 쓰므로
  // 당장은 안전하지만, 운영 배포 시 실제 프런트 도메인으로 좁혀야 함.
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*').split(','),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
