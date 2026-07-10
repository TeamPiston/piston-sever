import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { QueryFailedError } from 'typeorm';
import { UserService } from '../../user/application/user.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { MailService } from '../infrastructure/mail/mail.service';
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
} from '../infrastructure/jwt/jwt-secrets.provider';
import {
  refreshTokenKey,
  verificationCodeKey,
} from '../infrastructure/redis/redis-keys';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.provider';
import { JwtPayload } from '../types/jwt-payload.interface';

const VERIFICATION_CODE_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const BCRYPT_SALT_ROUNDS = 10;

/**
 * 회원가입, 로그인, 아이디/비밀번호 찾기 및 JWT 발급/재발급/폐기를 담당하는 인증 서비스.
 * Redis를 이용해 인증코드와 리프레시 토큰(해시)을 TTL과 함께 관리한다.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(JWT_ACCESS_SECRET) private readonly accessTokenSecret: string,
    @Inject(JWT_REFRESH_SECRET) private readonly refreshTokenSecret: string,
  ) {}

  /**
   * 이메일 가입 여부를 확인한 뒤, 6자리 인증코드를 생성해 Redis에 5분간 저장하고 메일로 발송한다.
   * 이미 가입된 이메일이면 `ConflictException`을 던진다.
   */
  async sendVerificationCode(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const alreadyExists = await this.userService.existsByEmail(email);
    if (alreadyExists) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    const code = randomInt(100000, 1000000).toString();
    await this.redis.set(
      verificationCodeKey(email),
      code,
      'EX',
      VERIFICATION_CODE_TTL_SECONDS,
    );
    await this.mailService.sendVerificationCode(email, code);
  }

  /**
   * 이메일/아이디 중복 및 인증코드 일치 여부를 확인한 뒤 신규 사용자를 생성한다.
   * 검증 실패 시 `ConflictException` 또는 `UnauthorizedException`을 던지며,
   * DB 유니크 제약 위반(동시 가입 등)도 `ConflictException`으로 변환해 던진다.
   * 가입 성공 시 사용한 인증코드는 Redis에서 삭제한다.
   */
  async register(dto: RegisterDto): Promise<void> {
    const email = normalizeEmail(dto.email);
    const [emailExists, idExists] = await Promise.all([
      this.userService.existsByEmail(email),
      this.userService.existsByLoginId(dto.id),
    ]);
    if (emailExists) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    if (idExists) {
      throw new ConflictException('이미 사용 중인 아이디입니다.');
    }

    const storedCode = await this.redis.get(verificationCodeKey(email));
    if (!storedCode || storedCode !== dto.code) {
      throw new UnauthorizedException(
        '인증코드가 일치하지 않거나 만료되었습니다.',
      );
    }

    try {
      await this.userService.create({
        loginId: dto.id,
        email,
        password: dto.password,
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new ConflictException('이미 가입된 이메일 또는 아이디입니다.');
      }
      throw error;
    }
    await this.redis.del(verificationCodeKey(email));
  }

  /**
   * 이메일로 가입된 계정을 조회해 아이디를 메일로 안내한다.
   * 계정이 없으면 `NotFoundException`을 던진다.
   */
  async findId(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('가입된 계정이 없습니다.');
    }

    await this.mailService.sendIdRecovery(email, user.loginId);
  }

  /**
   * 이메일로 가입된 계정을 조회해 비밀번호를 메일로 안내한다.
   * 계정이 없으면 `NotFoundException`을 던진다.
   */
  async findPassword(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('가입된 계정이 없습니다.');
    }

    await this.mailService.sendPasswordRecovery(email, user.password);
  }

  /**
   * 아이디/비밀번호를 검증하여 로그인을 처리하고, 새 세션 ID로 액세스/리프레시 토큰 쌍을 발급한다.
   * 아이디가 없거나 비밀번호가 일치하지 않으면 `UnauthorizedException`을 던진다.
   */
  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userService.findByLoginId(dto.id);
    if (!user) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    if (dto.password !== user.password) {
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    return this.issueTokens({
      sub: user.userId,
      loginId: user.loginId,
      sessionId: randomUUID(),
    });
  }

  /**
   * 기존 페이로드(사용자/세션 정보)로 새 액세스 토큰만 재발급한다.
   */
  async reissue(payload: JwtPayload): Promise<{ accessToken: string }> {
    return { accessToken: await this.signAccessToken(payload) };
  }

  /**
   * 지정한 사용자/세션에 해당하는 리프레시 토큰을 Redis에서 삭제하여 로그아웃 처리한다.
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(refreshTokenKey(userId, sessionId));
  }

  private async issueTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(payload),
      this.jwtService.signAsync(payload, {
        secret: this.refreshTokenSecret,
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );
    await this.redis.set(
      refreshTokenKey(payload.sub, payload.sessionId),
      hashedRefreshToken,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }

  private signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.accessTokenSecret,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDuplicateEntryError(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as unknown as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}
