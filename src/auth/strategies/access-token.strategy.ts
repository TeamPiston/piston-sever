import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS_SECRET } from '../infrastructure/jwt/jwt-secrets.provider';
import { JwtPayload } from '../types/jwt-payload.interface';

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

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      loginId: payload.loginId,
      sessionId: payload.sessionId,
    };
  }
}
