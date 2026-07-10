import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * `jwt-access` 전략을 사용해 액세스 토큰을 검증하는 가드.
 * `@Public()` 데코레이터가 붙은 핸들러/클래스는 인증 검사를 건너뛴다.
 */
@Injectable()
export class AccessTokenGuard extends AuthGuard('jwt-access') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * 요청 대상 핸들러/클래스에 `IS_PUBLIC_KEY` 메타데이터가 설정되어 있으면
   * 즉시 통과시키고, 그렇지 않으면 기본 JWT 인증 로직을 수행한다.
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
