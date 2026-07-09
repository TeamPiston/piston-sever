import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './application/auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { RefreshTokenGuard } from './guards/refresh-token.guard';

@Controller()
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(204)
  async sendCode(@Body() dto: SendCodeDto): Promise<void> {
    await this.authService.sendVerificationCode(dto.email);
  }

  @Post('signup')
  @HttpCode(204)
  async signup(@Body() dto: RegisterDto): Promise<void> {
    await this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

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

  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(204)
  async logout(
    @CurrentUser() user: { userId: string; sessionId: string },
  ): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
  }
}
