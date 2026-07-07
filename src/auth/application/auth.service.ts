import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { UserService } from '../../user/application/user.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { MailService } from '../infrastructure/mail/mail.service';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.provider';
import { JwtPayload } from '../types/jwt-payload.interface';

const VERIFICATION_CODE_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET')!;
    this.refreshTokenSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET')!;
  }

  async sendVerificationCode(email: string): Promise<void> {
    const alreadyExists = await this.userService.existsByEmail(email);
    if (alreadyExists) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    const code = randomInt(100000, 1000000).toString();
    await this.redis.set(
      `email-verification:${email}`,
      code,
      'EX',
      VERIFICATION_CODE_TTL_SECONDS,
    );
    await this.mailService.sendVerificationCode(email, code);
  }

  async register(dto: RegisterDto): Promise<void> {
    const [emailExists, idExists] = await Promise.all([
      this.userService.existsByEmail(dto.email),
      this.userService.existsByLoginId(dto.id),
    ]);
    if (emailExists) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    if (idExists) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    const storedCode = await this.redis.get(`email-verification:${dto.email}`);
    if (!storedCode || storedCode !== dto.code) {
      throw new UnauthorizedException(
        '인증코드가 일치하지 않거나 만료되었습니다.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.userService.create({
      loginId: dto.id,
      email: dto.email,
      password: hashedPassword,
    });
    await this.redis.del(`email-verification:${dto.email}`);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userService.findByLoginId(dto.id);
    if (!user) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    return this.issueTokens({ sub: user.userId, loginId: user.loginId });
  }

  async reissue(
    userId: string,
    loginId: string,
  ): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, loginId } satisfies JwtPayload,
      { secret: this.accessTokenSecret, expiresIn: ACCESS_TOKEN_EXPIRES_IN },
    );
    return { accessToken };
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh-token:${userId}`);
  }

  private async issueTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessTokenSecret,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshTokenSecret,
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.redis.set(
      `refresh-token:${payload.sub}`,
      hashedRefreshToken,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }
}
