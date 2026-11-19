import { Controller, Delete, HttpCode } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccountService } from './application/account.service';

/**
 * 로그인한 사용자 본인 계정을 관리하는 컨트롤러.
 */
@Controller('api/users')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /**
   * 본인 계정과 관련 데이터를 모두 삭제한다(`DELETE /api/users/me`).
   */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: { userId: string }): Promise<void> {
    await this.accountService.deleteAccount(user.userId);
  }
}
