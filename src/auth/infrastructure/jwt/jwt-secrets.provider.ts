import { ConfigService } from '@nestjs/config';

/**
 * 액세스 토큰 시크릿 값을 주입받기 위한 DI 토큰.
 */
export const JWT_ACCESS_SECRET = 'JWT_ACCESS_SECRET';
/**
 * 리프레시 토큰 시크릿 값을 주입받기 위한 DI 토큰.
 */
export const JWT_REFRESH_SECRET = 'JWT_REFRESH_SECRET';

/**
 * 지정한 환경변수 키의 값을 조회하고, 값이 없으면 에러를 던진다.
 */
function requireSecret(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
  }
  return value;
}

/**
 * `JWT_ACCESS_SECRET` 환경변수 값을 `JWT_ACCESS_SECRET` 토큰으로 제공하는 Nest 프로바이더.
 */
export const jwtAccessSecretProvider = {
  provide: JWT_ACCESS_SECRET,
  useFactory: (configService: ConfigService) =>
    requireSecret(configService, 'JWT_ACCESS_SECRET'),
  inject: [ConfigService],
};

/**
 * `JWT_REFRESH_SECRET` 환경변수 값을 `JWT_REFRESH_SECRET` 토큰으로 제공하는 Nest 프로바이더.
 */
export const jwtRefreshSecretProvider = {
  provide: JWT_REFRESH_SECRET,
  useFactory: (configService: ConfigService) =>
    requireSecret(configService, 'JWT_REFRESH_SECRET'),
  inject: [ConfigService],
};
