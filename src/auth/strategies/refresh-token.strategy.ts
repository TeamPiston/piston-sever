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
