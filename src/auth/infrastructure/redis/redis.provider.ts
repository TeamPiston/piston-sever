import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 클라이언트 인스턴스를 주입받기 위한 DI 토큰.
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * `REDIS_HOST`, `REDIS_PORT` 환경변수(미설정 시 localhost:6379)로 ioredis
 * 클라이언트를 생성해 `REDIS_CLIENT` 토큰으로 제공하는 Nest 프로바이더.
 */
export const redisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
    }),
  inject: [ConfigService],
};
