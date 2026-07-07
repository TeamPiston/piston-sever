import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from '../user/user.module';
import { AuthService } from './application/auth.service';
import { AuthController } from './auth.controller';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import {
  jwtAccessSecretProvider,
  jwtRefreshSecretProvider,
} from './infrastructure/jwt/jwt-secrets.provider';
import { MailService } from './infrastructure/mail/mail.service';
import { redisProvider } from './infrastructure/redis/redis.provider';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    redisProvider,
    jwtAccessSecretProvider,
    jwtRefreshSecretProvider,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    AccessTokenGuard,
    RefreshTokenGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [AccessTokenGuard],
})
export class AuthModule {}
