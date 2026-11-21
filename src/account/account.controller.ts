import {
  Controller,
  Delete,
  Get,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from '../user/application/user.service';
import { AccountService } from './application/account.service';

/** `GET /api/users/me` 응답. 비밀번호 해시 등 민감 필드는 포함하지 않는다. */
export interface MyProfileResponse {
  userId: string;
  loginId: string;
  email: string;
  createdAt: Date;
}

/**
 * 로그인한 사용자 본인 계정을 관리하는 컨트롤러.
 */
@Controller('api/users')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly userService: UserService,
  ) {}

  /**
   * 본인 프로필을 조회한다(`GET /api/users/me`).
   * 토큰은 유효하지만 계정이 삭제된 경우 인증되지 않은 것으로 보고 401을 반환한다.
   */
  @Get('me')
  async getMe(
    @CurrentUser() user: { userId: string },
  ): Promise<MyProfileResponse> {
    const found = await this.userService.findById(user.userId);
    if (!found) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }
    return {
      userId: found.userId,
      loginId: found.loginId,
      email: found.email,
      createdAt: found.createdAt,
    };
  }

  /**
   * 본인 계정과 관련 데이터를 모두 삭제한다(`DELETE /api/users/me`).
   */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: { userId: string }): Promise<void> {
    await this.accountService.deleteAccount(user.userId);
  }
}
