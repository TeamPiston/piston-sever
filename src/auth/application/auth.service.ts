import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
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
  passwordResetKey,
  passwordResetUserKey,
  refreshTokenKey,
  verificationCodeKey,
} from '../infrastructure/redis/redis-keys';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.provider';
import { JwtPayload } from '../types/jwt-payload.interface';

const VERIFICATION_CODE_TTL_SECONDS = 5 * 60;
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
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
        password: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
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
   * 이메일로 가입된 계정이 있으면 아이디를 메일로 안내한다.
   * 가입 여부가 드러나지 않도록 계정이 없어도 정상 종료하고, 메일은 응답을 기다리지 않고 보낸다.
   */
  async findId(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.userService.findByEmail(email);
    if (!user) return;

    this.sendInBackground('아이디 찾기', () =>
      this.mailService.sendIdRecovery(email, user.loginId),
    );
  }

  /**
   * 이메일로 가입된 계정이 있으면 일회용 비밀번호 재설정 토큰을 발급해 메일로 보낸다.
   * 기존 비밀번호는 바꾸지 않으며, 새 요청이 오면 이전 토큰은 무효가 된다.
   * 가입 여부가 드러나지 않도록 계정이 없어도 정상 종료한다.
   */
  async findPassword(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const user = await this.userService.findByEmail(email);
    if (!user) return;

    const token = randomBytes(24).toString('base64url');
    const tokenHash = hashResetToken(token);
    const previousHash = await this.redis.get(
      passwordResetUserKey(user.userId),
    );
    const tx = this.redis.multi();
    if (previousHash) tx.del(passwordResetKey(previousHash));
    tx.set(
      passwordResetKey(tokenHash),
      user.userId,
      'EX',
      PASSWORD_RESET_TTL_SECONDS,
    );
    tx.set(
      passwordResetUserKey(user.userId),
      tokenHash,
      'EX',
      PASSWORD_RESET_TTL_SECONDS,
    );
    await tx.exec();

    const resetUrl =
      this.configService.get<string>('PASSWORD_RESET_URL') || null;
    this.sendInBackground('비밀번호 재설정', () =>
      this.mailService.sendPasswordReset(email, token, resetUrl),
    );
  }

  /**
   * 재설정 토큰을 한 번만 사용해 비밀번호를 바꾸고, 해당 사용자의 모든 세션을 폐기한다.
   * 토큰이 없거나 만료·사용됐으면 `BadRequestException`을 던진다.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // GETDEL로 꺼내는 동시에 지워 같은 토큰의 동시·재사용을 막는다.
    const userId = await this.redis.getdel(
      passwordResetKey(hashResetToken(token)),
    );
    if (!userId) {
      throw new BadRequestException(
        '재설정 코드가 올바르지 않거나 만료되었습니다.',
      );
    }

    await this.userService.updatePassword(
      userId,
      await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS),
    );
    await this.redis.del(passwordResetUserKey(userId));
    await this.revokeAllSessions(userId);
  }

  private sendInBackground(label: string, send: () => Promise<void>): void {
    send().catch((error: unknown) =>
      this.logger.error(`${label} 메일 발송 실패`, error),
    );
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

    if (!(await bcrypt.compare(dto.password, user.password))) {
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

  /**
   * 해당 사용자의 모든 세션 리프레시 토큰을 Redis에서 삭제한다.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    const stream = this.redis.scanStream({
      match: refreshTokenKey(userId, '*'),
      count: 100,
    });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length > 0) await this.redis.del(...keys);
    }
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

/** Redis가 유출돼도 토큰을 쓸 수 없도록 원문 대신 해시를 키로 저장한다. */
function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** PostgreSQL unique 제약 위반(SQLSTATE 23505)인지 판별한다. */
export function isDuplicateEntryError(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as unknown as { code?: string }).code === '23505'
  );
}
