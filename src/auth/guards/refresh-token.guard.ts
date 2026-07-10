import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * `jwt-refresh` 전략을 사용해 리프레시 토큰을 검증하는 가드.
 */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
