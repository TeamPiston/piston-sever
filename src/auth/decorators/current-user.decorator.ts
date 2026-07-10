import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * HTTP 요청 객체에 인증 가드(Passport 전략)가 설정한 `request.user`를
 * 컨트롤러 핸들러의 파라미터로 주입해주는 커스텀 데코레이터.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
