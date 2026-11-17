import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './application/auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { FindIdDto } from './dto/find-id.dto';
import { FindPasswordDto } from './dto/find-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';

/**
 * 회원가입, 로그인, 아이디/비밀번호 찾기, 토큰 재발급 및 로그아웃을 처리하는 인증 컨트롤러.
 * 클래스 전체가 `@Public()`으로 지정되어 있어 기본적으로 액세스 토큰 인증을 요구하지 않는다.
 */
@Controller()
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 이메일로 회원가입용 인증코드를 발송한다(`POST /send`, 1분당 3회 제한).
   */
  @Post('send')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(204)
  async sendCode(@Body() dto: SendCodeDto): Promise<void> {
    await this.authService.sendVerificationCode(dto.email);
  }

  /**
   * 인증코드 검증 후 신규 회원을 등록한다(`POST /signup`).
   */
  @Post('signup')
  @HttpCode(204)
  async signup(@Body() dto: RegisterDto): Promise<void> {
    await this.authService.register(dto);
  }

  /**
   * 아이디/비밀번호로 로그인하여 액세스/리프레시 토큰을 발급한다(`POST /login`).
   */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * 가입된 이메일로 아이디를 조회하여 메일로 안내한다(`POST /find-id`, 1분당 3회 제한).
   */
  @Post('find-id')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(204)
  async findId(@Body() dto: FindIdDto): Promise<void> {
    await this.authService.findId(dto.email);
  }

  /**
   * 가입된 이메일로 비밀번호를 조회하여 메일로 안내한다(`POST /find-password`, 1분당 3회 제한).
   */
  @Post('find-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(204)
  async findPassword(@Body() dto: FindPasswordDto): Promise<void> {
    await this.authService.findPassword(dto.email);
  }

  /**
   * 유효한 리프레시 토큰을 가진 사용자에게 새 액세스 토큰을 발급한다(`POST /reissue`).
   * `RefreshTokenGuard`로 보호되며, 인증된 사용자 정보는 `@CurrentUser()`로 주입받는다.
   */
  @Post('reissue')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(200)
  reissue(
    @CurrentUser()
    user: {
      userId: string;
      loginId: string;
      sessionId: string;
    },
  ) {
    return this.authService.reissue({
      sub: user.userId,
      loginId: user.loginId,
      sessionId: user.sessionId,
    });
  }

  /**
   * 현재 세션의 리프레시 토큰을 폐기하여 로그아웃 처리한다(`POST /logout`).
   * `RefreshTokenGuard`로 보호된다.
   */
  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(204)
  async logout(
    @CurrentUser() user: { userId: string; sessionId: string },
  ): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
  }
}
