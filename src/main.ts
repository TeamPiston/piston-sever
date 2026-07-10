import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * NestJS 애플리케이션을 부트스트랩한다.
 * 전역 ValidationPipe(whitelist, transform)를 등록하고 PORT 환경변수(기본 3000)로 서버를 실행한다.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
