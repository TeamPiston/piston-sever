import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS_SECRET } from '../infrastructure/jwt/jwt-secrets.provider';
import { JwtPayload } from '../types/jwt-payload.interface';

/**
 * Authorization 헤더의 Bearer 토큰을 액세스 토큰 시크릿으로 검증하는
 * `jwt-access` passport 전략.
 */
@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(@Inject(JWT_ACCESS_SECRET) accessTokenSecret: string) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessTokenSecret,
    });
  }

  /**
   * 검증된 JWT 페이로드에서 요청 컨텍스트에 담을 사용자 정보를 추출한다.
   */
  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      loginId: payload.loginId,
      sessionId: payload.sessionId,
    };
  }
}
