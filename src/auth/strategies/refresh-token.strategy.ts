import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import Redis from 'ioredis';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_REFRESH_SECRET } from '../infrastructure/jwt/jwt-secrets.provider';
import { refreshTokenKey } from '../infrastructure/redis/redis-keys';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.provider';
import { JwtPayload } from '../types/jwt-payload.interface';

/**
 * 리프레시 토큰(Bearer)을 검증하는 Passport 전략('jwt-refresh').
 * Redis에 저장된 해시와 요청 토큰을 비교하여 유효성을 확인한다.
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(JWT_REFRESH_SECRET) refreshTokenSecret: string,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: refreshTokenSecret,
      passReqToCallback: true,
    });
  }

  /**
   * 요청의 리프레시 토큰과 Redis에 저장된 해시를 bcrypt로 비교해 검증한다.
   * 저장된 해시가 없거나 토큰이 일치하지 않으면 UnauthorizedException을 던진다.
   */
  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const storedHash = await this.redis.get(
      refreshTokenKey(payload.sub, payload.sessionId),
    );
    if (!storedHash || !refreshToken) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    const isMatch = await bcrypt.compare(refreshToken, storedHash);
    if (!isMatch) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    return {
      userId: payload.sub,
      loginId: payload.loginId,
      sessionId: payload.sessionId,
      refreshToken,
    };
  }
}
