import { ConfigService } from '@nestjs/config';

export const JWT_ACCESS_SECRET = 'JWT_ACCESS_SECRET';
export const JWT_REFRESH_SECRET = 'JWT_REFRESH_SECRET';

function requireSecret(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
  }
  return value;
}

export const jwtAccessSecretProvider = {
  provide: JWT_ACCESS_SECRET,
  useFactory: (configService: ConfigService) =>
    requireSecret(configService, 'JWT_ACCESS_SECRET'),
  inject: [ConfigService],
};

export const jwtRefreshSecretProvider = {
  provide: JWT_REFRESH_SECRET,
  useFactory: (configService: ConfigService) =>
    requireSecret(configService, 'JWT_REFRESH_SECRET'),
  inject: [ConfigService],
};
